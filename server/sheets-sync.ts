"use server";

import { google } from "googleapis";
import { db } from "@/db/drizzle";
import {
    novels,
    locations,
    items,
    loreEntries,
    loreGroups,
    eras,
    entities,
    driveSettings,
    characters
} from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { oauth2Client } from "@/lib/google-drive";
import { setupGoogleAuth, initializeDriveSync } from "./drive-sync";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-config";

const sheets = google.sheets({ version: "v4", auth: oauth2Client });
const drive = google.drive({ version: "v3", auth: oauth2Client });

function getCellValue(row: any[] | undefined, index: number): string | null {
    if (!row || index === -1 || index >= row.length) return null;
    const val = row[index];
    return val !== undefined && val !== null ? String(val) : null;
}

function stripHtml(html: string | null | undefined): string {
    if (!html) return "";
    let text = html.replace(/<[^>]*>/g, "");
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    return text.trim();
}

function textToHtml(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .split("\n")
        .map(p => p.trim() ? `<p>${p.trim()}</p>` : "")
        .filter(Boolean)
        .join("");
}

function parseArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
        return val.split(",").map(s => s.trim()).filter(Boolean);
    }
    return [];
}

async function getRootFolder(fileId: string) {
    const file = await drive.files.get({
        fileId: fileId,
        fields: "parents",
    });
    return file.data.parents?.[0] || "";
}

export async function syncWorldBuilding2Way(novelId: string): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
    try {
        console.log(`[SHEETS_SYNC] Starting 2-way sync for novel: ${novelId}`);
        await setupGoogleAuth();

        const novel = await db.query.novels.findFirst({
            where: eq(novels.id, novelId),
            with: {
                characters: true,
                locations: true,
            }
        });

        if (!novel) {
            return { success: false, error: "Novel not found" };
        }

        // 1. Get/Initialize Drive Settings
        let settings = await db.query.driveSettings.findFirst({
            where: eq(driveSettings.novelId, novelId)
        });

        if (!settings || !settings.rootFolderId) {
            const initRes = await initializeDriveSync(novelId);
            if (!initRes.success || !initRes.folderId) {
                return { success: false, error: "Failed to initialize Google Drive folder" };
            }
            settings = await db.query.driveSettings.findFirst({
                where: eq(driveSettings.novelId, novelId)
            });
        }

        if (!settings || !settings.rootFolderId) {
            return { success: false, error: "Google Drive folder settings not initialized" };
        }

        // 2. Get or Create Google Sheets File
        let spreadsheetId = settings.worldbuildingSpreadsheetId;
        let isNewSpreadsheet = false;

        if (spreadsheetId) {
            try {
                // Verify the spreadsheet still exists
                await sheets.spreadsheets.get({ spreadsheetId });
            } catch (err: any) {
                if (err.status === 404 || err.code === 404) {
                    console.log("[SHEETS_SYNC] Spreadsheet not found, creating a new one...");
                    spreadsheetId = null;
                } else {
                    throw err;
                }
            }
        }

        if (!spreadsheetId) {
            const response = await sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title: `Mythoria Worldbuilding: ${novel.title}`,
                    },
                },
            });

            spreadsheetId = response.data.spreadsheetId;
            isNewSpreadsheet = true;

            if (!spreadsheetId) {
                return { success: false, error: "Failed to create Google Spreadsheet" };
            }

            // Move spreadsheet to novel drive folder
            try {
                const currentParents = await getRootFolder(spreadsheetId);
                await drive.files.update({
                    fileId: spreadsheetId,
                    addParents: settings.rootFolderId,
                    removeParents: currentParents || undefined,
                });
            } catch (moveErr) {
                console.warn("[SHEETS_SYNC] Failed to move spreadsheet to novel folder:", moveErr);
            }

            // Save Spreadsheet ID in db
            await db.update(driveSettings)
                .set({ worldbuildingSpreadsheetId: spreadsheetId })
                .where(eq(driveSettings.id, settings.id));
        }

        // 3. Ensure the 4 Sheets/Tabs exist
        const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
        const existingTabs = spreadsheetMeta.data.sheets?.map(s => s.properties?.title) || [];
        const requiredTabs = ["Locations", "Items", "Lore", "Entities"];
        const addSheetRequests: any[] = [];

        for (const title of requiredTabs) {
            if (!existingTabs.includes(title)) {
                addSheetRequests.push({
                    addSheet: {
                        properties: { title }
                    }
                });
            }
        }

        if (addSheetRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: addSheetRequests },
            });
        }

        // 4. Fetch all existing entities from DB
        const dbLocations = await db.query.locations.findMany({ where: eq(locations.novelId, novelId) });
        const dbItems = await db.query.items.findMany({ where: eq(items.novelId, novelId) });
        const dbLore = await db.query.loreEntries.findMany({ where: eq(loreEntries.novelId, novelId) });
        const dbEntities = await db.query.entities.findMany({ where: eq(entities.novelId, novelId) });
        const dbEras = await db.query.eras.findMany({ where: eq(eras.novelId, novelId) });
        const dbGroups = await db.query.loreGroups.findMany({ where: eq(loreGroups.novelId, novelId) });
        const dbCharacters = await db.query.characters.findMany({ where: eq(characters.novelId, novelId) });

        // Helper readers
        const readSheetValues = async (range: string) => {
            try {
                const res = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId!, range });
                return res.data.values || [];
            } catch {
                return [];
            }
        };

        // Only pull changes if the spreadsheet is NOT newly created
        if (!isNewSpreadsheet) {
            console.log("[SHEETS_SYNC] Pulling updates from Google Sheets...");

            // ==========================================
            // PULL LOCATIONS
            // ==========================================
            const sheetLocs = await readSheetValues("Locations!A1:Z");
            if (sheetLocs.length > 1) {
                const headers = sheetLocs[0];
                const idIdx = headers.indexOf("ID");
                const nameIdx = headers.indexOf("ชื่อสถานที่ (Name)");
                const typeIdx = headers.indexOf("ประเภท (Type)");
                const descIdx = headers.indexOf("คำอธิบายสถานที่ (Description)");
                const atmosIdx = headers.indexOf("บรรยากาศ (Atmosphere)");
                const climIdx = headers.indexOf("สภาพอากาศ (Climate)");
                const inhabIdx = headers.indexOf("ผู้อยู่อาศัยหลัก (Inhabitants)");
                const histIdx = headers.indexOf("ประวัติความเป็นมา (History)");
                const secIdx = headers.indexOf("ความลับสถานที่ (Secrets)");

                const rows = sheetLocs.slice(1);
                for (const row of rows) {
                    const id = getCellValue(row, idIdx);
                    const name = getCellValue(row, nameIdx);
                    const type = getCellValue(row, typeIdx);
                    const description = getCellValue(row, descIdx);
                    const atmosphere = getCellValue(row, atmosIdx);
                    const climate = getCellValue(row, climIdx);
                    const inhabitants = getCellValue(row, inhabIdx);
                    const history = getCellValue(row, histIdx);
                    const secrets = getCellValue(row, secIdx);

                    if (!name || !name.trim()) continue;

                    const locData = {
                        name: name.trim(),
                        type: type?.trim() || null,
                        description: description?.trim() || null,
                        atmosphere: atmosphere?.trim() || null,
                        climate: climate?.trim() || null,
                        inhabitants: inhabitants?.trim() || null,
                        history: history?.trim() || null,
                        secrets: secrets?.trim() || null,
                    };

                    if (id && id.trim()) {
                        const existing = dbLocations.find(l => l.id === id.trim());
                        if (existing) {
                            // Update only if changed
                            if (existing.name !== locData.name ||
                                existing.type !== locData.type ||
                                existing.description !== locData.description ||
                                existing.atmosphere !== locData.atmosphere ||
                                existing.climate !== locData.climate ||
                                existing.inhabitants !== locData.inhabitants ||
                                existing.history !== locData.history ||
                                existing.secrets !== locData.secrets
                            ) {
                                await db.update(locations).set(locData).where(eq(locations.id, existing.id));
                            }
                        } else {
                            // ID exists in sheet but not in DB -> insert it with the sheet's ID!
                            await db.insert(locations).values({
                                id: id.trim(),
                                ...locData,
                                novelId,
                            });
                        }
                    } else {
                        // Create Location
                        await db.insert(locations).values({
                            ...locData,
                            novelId,
                        });
                    }
                }
            }

            // Refresh dbLocations for relationship resolving next
            const updatedDbLocations = await db.query.locations.findMany({ where: eq(locations.novelId, novelId) });

            // ==========================================
            // PULL ITEMS
            // ==========================================
            const sheetItems = await readSheetValues("Items!A1:Z");
            if (sheetItems.length > 1) {
                const headers = sheetItems[0];
                const idIdx = headers.indexOf("ID");
                const nameIdx = headers.indexOf("ชื่อไอเทม (Name)");
                const typeIdx = headers.indexOf("ประเภท (Type)");
                const rarityIdx = headers.indexOf("ระดับความหายาก (Rarity)");
                const descIdx = headers.indexOf("คำอธิบายความสามารถ (Description)");
                const loreIdx = headers.indexOf("ประวัติไอเทม (Lore)");
                const ownerIdx = headers.indexOf("ผู้ครอบครองปัจจุบัน (Current Owner)");
                const locationIdx = headers.indexOf("สถานที่เก็บรักษา (Location)");

                const rows = sheetItems.slice(1);
                for (const row of rows) {
                    const id = getCellValue(row, idIdx);
                    const name = getCellValue(row, nameIdx);
                    const type = getCellValue(row, typeIdx);
                    const rarity = getCellValue(row, rarityIdx);
                    const description = getCellValue(row, descIdx);
                    const loreVal = getCellValue(row, loreIdx);
                    const ownerName = getCellValue(row, ownerIdx);
                    const locationName = getCellValue(row, locationIdx);

                    if (!name || !name.trim()) continue;

                    // Resolve Owner
                    let ownerId: string | null = null;
                    if (ownerName && ownerName.trim()) {
                        const matchedChar = dbCharacters.find(c => c.name.toLowerCase() === ownerName.trim().toLowerCase());
                        if (matchedChar) ownerId = matchedChar.id;
                    }

                    // Resolve Location
                    let itemLocId: string | null = null;
                    if (locationName && locationName.trim()) {
                        const matchedLoc = updatedDbLocations.find(l => l.name.toLowerCase() === locationName.trim().toLowerCase());
                        if (matchedLoc) itemLocId = matchedLoc.id;
                    }

                    const itemData = {
                        name: name.trim(),
                        type: type?.trim() || "artifact",
                        rarity: rarity?.trim() || "common",
                        description: description?.trim() || null,
                        lore: loreVal?.trim() || null,
                        currentOwnerId: ownerId,
                        locationId: itemLocId,
                    };

                    if (id && id.trim()) {
                        const existing = dbItems.find(i => i.id === id.trim());
                        if (existing) {
                            if (existing.name !== itemData.name ||
                                existing.type !== itemData.type ||
                                existing.rarity !== itemData.rarity ||
                                existing.description !== itemData.description ||
                                existing.lore !== itemData.lore ||
                                existing.currentOwnerId !== itemData.currentOwnerId ||
                                existing.locationId !== itemData.locationId
                            ) {
                                await db.update(items).set(itemData).where(eq(items.id, existing.id));
                            }
                        } else {
                            // ID exists in sheet but not in DB -> insert it with the sheet's ID!
                            await db.insert(items).values({
                                id: id.trim(),
                                ...itemData,
                                novelId,
                            });
                        }
                    } else {
                        await db.insert(items).values({
                            ...itemData,
                            novelId,
                        });
                    }
                }
            }

            // Refresh dbItems
            const updatedDbItems = await db.query.items.findMany({ where: eq(items.novelId, novelId) });

            // ==========================================
            // PULL LORE
            // ==========================================
            const sheetLores = await readSheetValues("Lore!A1:Z");
            if (sheetLores.length > 1) {
                const headers = sheetLores[0];
                const idIdx = headers.indexOf("ID");
                const titleIdx = headers.indexOf("ชื่อ (Title)");
                const typeIdx = headers.indexOf("ประเภท (Type)");
                const importanceIdx = headers.indexOf("ระดับความสำคัญ (Importance)");
                const eraIdx = headers.indexOf("ยุคสมัย (Era)");
                const groupIdx = headers.indexOf("กลุ่มของ Lore (Group)");
                const scopeIdx = headers.indexOf("ขอบเขต (Scope)");
                const locationIdx = headers.indexOf("สถานที่หลัก (Location)");
                const parentLoreIdx = headers.indexOf("Lore หลัก (Parent Lore)");
                const contentIdx = headers.indexOf("เนื้อหา (Content)");
                const charsIdx = headers.indexOf("ตัวละครที่เกี่ยวข้อง (Related Characters)");
                const locsIdx = headers.indexOf("สถานที่ที่เกี่ยวข้อง (Locations)");
                const itemsIdx = headers.indexOf("ไอเทมที่เกี่ยวข้อง (Items)");

                const rows = sheetLores.slice(1);
                for (const row of rows) {
                    const id = getCellValue(row, idIdx);
                    const title = getCellValue(row, titleIdx);
                    const type = getCellValue(row, typeIdx);
                    const importance = getCellValue(row, importanceIdx);
                    const eraName = getCellValue(row, eraIdx);
                    const groupName = getCellValue(row, groupIdx);
                    const scope = getCellValue(row, scopeIdx);
                    const locationName = getCellValue(row, locationIdx);
                    const parentLoreTitle = getCellValue(row, parentLoreIdx);
                    const content = getCellValue(row, contentIdx);
                    const relCharsStr = getCellValue(row, charsIdx);
                    const relLocsStr = getCellValue(row, locsIdx);
                    const relItemsStr = getCellValue(row, itemsIdx);

                    if (!title || !title.trim()) continue;

                    // Resolve Era
                    let eraId: string | null = null;
                    if (eraName && eraName.trim()) {
                        const matchedEra = dbEras.find(e => e.name.toLowerCase() === eraName.trim().toLowerCase());
                        if (matchedEra) eraId = matchedEra.id;
                    }

                    // Resolve Group
                    let groupId: string | null = null;
                    if (groupName && groupName.trim()) {
                        const matchedGroup = dbGroups.find(g => g.name.toLowerCase() === groupName.trim().toLowerCase());
                        if (matchedGroup) groupId = matchedGroup.id;
                    }

                    // Resolve Location
                    let loreLocId: string | null = null;
                    if (scope === "location" && locationName && locationName.trim()) {
                        const matchedLoc = updatedDbLocations.find(l => l.name.toLowerCase() === locationName.trim().toLowerCase());
                        if (matchedLoc) loreLocId = matchedLoc.id;
                    }

                    // Resolve Related Arrays (Comma Separated Names -> IDs)
                    const charIds: string[] = [];
                    if (relCharsStr && relCharsStr.trim()) {
                        const names = relCharsStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
                        names.forEach(n => {
                            const found = dbCharacters.find(c => c.name.toLowerCase() === n);
                            if (found) charIds.push(found.id);
                        });
                    }

                    const locIds: string[] = [];
                    if (relLocsStr && relLocsStr.trim()) {
                        const names = relLocsStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
                        names.forEach(n => {
                            const found = updatedDbLocations.find(l => l.name.toLowerCase() === n);
                            if (found) locIds.push(found.id);
                        });
                    }

                    const itemIds: string[] = [];
                    if (relItemsStr && relItemsStr.trim()) {
                        const names = relItemsStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
                        names.forEach(n => {
                            const found = updatedDbItems.find(i => i.name.toLowerCase() === n);
                            if (found) itemIds.push(found.id);
                        });
                    }

                    const importanceNum = importance ? parseInt(importance, 10) : 5;

                    if (id && id.trim()) {
                        const existing = dbLore.find(l => l.id === id.trim());
                        if (existing) {
                            // Check content change
                            const strippedDbContent = stripHtml(existing.content);
                            const sheetContent = content?.trim() || "";
                            const contentHtml = (sheetContent === strippedDbContent)
                                ? existing.content  // Preserve original HTML
                                : textToHtml(sheetContent);

                            // Compare relations
                            const isCharsChanged = JSON.stringify(existing.relatedCharacterIds || []) !== JSON.stringify(charIds);
                            const isLocsChanged = JSON.stringify(existing.relatedLocationIds || []) !== JSON.stringify(locIds);
                            const isItemsChanged = JSON.stringify(existing.relatedItemIds || []) !== JSON.stringify(itemIds);

                            if (existing.title !== title.trim() ||
                                existing.type !== (type?.trim() || "event") ||
                                existing.importance !== importanceNum ||
                                existing.eraId !== eraId ||
                                existing.groupId !== groupId ||
                                existing.scope !== (scope?.trim() || "world") ||
                                existing.locationId !== loreLocId ||
                                existing.content !== contentHtml ||
                                isCharsChanged ||
                                isLocsChanged ||
                                isItemsChanged
                            ) {
                                await db.update(loreEntries)
                                    .set({
                                        title: title.trim(),
                                        type: type?.trim() || "event",
                                        importance: importanceNum,
                                        eraId,
                                        groupId,
                                        scope: scope?.trim() || "world",
                                        locationId: loreLocId,
                                        content: contentHtml,
                                        relatedCharacterIds: charIds.length > 0 ? charIds : null,
                                        relatedLocationIds: locIds.length > 0 ? locIds : null,
                                        relatedItemIds: itemIds.length > 0 ? itemIds : null,
                                    })
                                    .where(eq(loreEntries.id, existing.id));
                            }
                        } else {
                            // ID exists in sheet but not in DB -> insert it with the sheet's ID!
                            const contentHtml = textToHtml(content?.trim() || "");
                            await db.insert(loreEntries).values({
                                id: id.trim(),
                                title: title.trim(),
                                type: type?.trim() || "event",
                                importance: importanceNum,
                                eraId,
                                groupId,
                                scope: scope?.trim() || "world",
                                locationId: loreLocId,
                                content: contentHtml,
                                relatedCharacterIds: charIds.length > 0 ? charIds : null,
                                relatedLocationIds: locIds.length > 0 ? locIds : null,
                                relatedItemIds: itemIds.length > 0 ? itemIds : null,
                                novelId,
                            });
                        }
                    } else {
                        // Create Lore Entry
                        const contentHtml = textToHtml(content?.trim() || "");
                        await db.insert(loreEntries).values({
                            title: title.trim(),
                            type: type?.trim() || "event",
                            importance: importanceNum,
                            eraId,
                            groupId,
                            scope: scope?.trim() || "world",
                            locationId: loreLocId,
                            content: contentHtml,
                            relatedCharacterIds: charIds.length > 0 ? charIds : null,
                            relatedLocationIds: locIds.length > 0 ? locIds : null,
                            relatedItemIds: itemIds.length > 0 ? itemIds : null,
                            novelId,
                        });
                    }
                }

                // Second Pass: Resolve parent-child (sub-lore) relationships
                if (parentLoreIdx !== -1) {
                    const updatedDbLore = await db.query.loreEntries.findMany({ where: eq(loreEntries.novelId, novelId) });
                    for (const row of rows) {
                        const id = getCellValue(row, idIdx);
                        const title = getCellValue(row, titleIdx);
                        const parentLoreTitle = getCellValue(row, parentLoreIdx);

                        if (!title || !title.trim()) continue;

                        const childEntry = updatedDbLore.find(l => id && id.trim() ? l.id === id.trim() : l.title.toLowerCase() === title.trim().toLowerCase());
                        if (!childEntry) continue;

                        let targetParentId: string | null = null;
                        if (parentLoreTitle && parentLoreTitle.trim()) {
                            const parentEntry = updatedDbLore.find(l => l.title.toLowerCase() === parentLoreTitle.trim().toLowerCase());
                            if (parentEntry && parentEntry.id !== childEntry.id) {
                                targetParentId = parentEntry.id;
                            }
                        }

                        if (childEntry.parentLoreId !== targetParentId) {
                            await db.update(loreEntries)
                                .set({ parentLoreId: targetParentId })
                                .where(eq(loreEntries.id, childEntry.id));
                        }
                    }
                }
            }

            // ==========================================
            // PULL ENTITIES
            // ==========================================
            const sheetEntities = await readSheetValues("Entities!A1:Z");
            if (sheetEntities.length > 1) {
                const headers = sheetEntities[0];
                const idIdx = headers.indexOf("ID");
                const nameIdx = headers.indexOf("ชื่อ (Name)");
                const typeIdx = headers.indexOf("ประเภท (Type)");
                const threatIdx = headers.indexOf("ระดับความเป็นอันตราย (Threat Level)");
                const appIdx = headers.indexOf("รูปร่างลักษณะ (Appearance)");
                const abIdx = headers.indexOf("ความสามารถพิเศษ (Abilities)");
                const weakIdx = headers.indexOf("จุดอ่อน (Weaknesses)");
                const habIdx = headers.indexOf("ถิ่นที่อยู่อาศัย (Habitat)");
                const descIdx = headers.indexOf("คำอธิบายทั่วไป (Description)");

                const rows = sheetEntities.slice(1);
                for (const row of rows) {
                    const id = getCellValue(row, idIdx);
                    const name = getCellValue(row, nameIdx);
                    const type = getCellValue(row, typeIdx);
                    const threatLevel = getCellValue(row, threatIdx);
                    const appearance = getCellValue(row, appIdx);
                    const abilitiesVal = getCellValue(row, abIdx);
                    const weaknessesVal = getCellValue(row, weakIdx);
                    const habitat = getCellValue(row, habIdx);
                    const description = getCellValue(row, descIdx);

                    if (!name || !name.trim()) continue;

                    const entityData = {
                        name: name.trim(),
                        type: type?.trim() || "creature",
                        threatLevel: threatLevel?.trim() || "harmless",
                        appearance: appearance?.trim() || null,
                        abilities: parseArray(abilitiesVal),
                        weaknesses: parseArray(weaknessesVal),
                        habitat: habitat?.trim() || null,
                        description: description?.trim() || null,
                    };

                    if (id && id.trim()) {
                        const existing = dbEntities.find(e => e.id === id.trim());
                        if (existing) {
                            const isAbilitiesChanged = JSON.stringify(existing.abilities || []) !== JSON.stringify(entityData.abilities);
                            const isWeaknessesChanged = JSON.stringify(existing.weaknesses || []) !== JSON.stringify(entityData.weaknesses);

                            if (existing.name !== entityData.name ||
                                existing.type !== entityData.type ||
                                existing.threatLevel !== entityData.threatLevel ||
                                existing.appearance !== entityData.appearance ||
                                existing.habitat !== entityData.habitat ||
                                existing.description !== entityData.description ||
                                isAbilitiesChanged ||
                                isWeaknessesChanged
                            ) {
                                await db.update(entities).set(entityData).where(eq(entities.id, existing.id));
                            }
                        } else {
                            // ID exists in sheet but not in DB -> insert it with the sheet's ID!
                            await db.insert(entities).values({
                                id: id.trim(),
                                ...entityData,
                                novelId,
                            });
                        }
                    } else {
                        await db.insert(entities).values({
                            ...entityData,
                            novelId,
                        });
                    }
                }
            }
        }

        // ==========================================
        // 5. PUSH BACK LATEST DB DATA TO GOOGLE SHEET
        // ==========================================
        console.log("[SHEETS_SYNC] Pushing latest database state back to Google Sheets...");

        // Fetch fresh copies of everything
        const freshLocs = await db.query.locations.findMany({
            where: eq(locations.novelId, novelId),
            orderBy: [asc(locations.createdAt)],
        });
        const freshItems = await db.query.items.findMany({
            where: eq(items.novelId, novelId),
            orderBy: [asc(items.createdAt)],
            with: {
                owner: true,
                location: true,
            }
        });
        const freshLore = await db.query.loreEntries.findMany({
            where: eq(loreEntries.novelId, novelId),
            orderBy: [asc(loreEntries.orderIndex), asc(loreEntries.createdAt)],
            with: {
                era: true,
                group: true,
                location: true,
                parentLore: true,
            }
        });
        const freshEntities = await db.query.entities.findMany({
            where: eq(entities.novelId, novelId),
            orderBy: [asc(entities.createdAt)],
        });

        const writeSheetValues = async (sheetTitle: string, header: string[], rows: any[][]) => {
            await sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId!,
                range: `${sheetTitle}!A1:Z`,
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId!,
                range: `${sheetTitle}!A1`,
                valueInputOption: "RAW",
                requestBody: {
                    values: [header, ...rows]
                }
            });
        };

        // Write Locations Sheet
        const locHeader = ["ID", "ชื่อสถานที่ (Name)", "ประเภท (Type)", "คำอธิบายสถานที่ (Description)", "บรรยากาศ (Atmosphere)", "สภาพอากาศ (Climate)", "ผู้อยู่อาศัยหลัก (Inhabitants)", "ประวัติความเป็นมา (History)", "ความลับสถานที่ (Secrets)"];
        const locRows = freshLocs.map(l => [
            l.id,
            l.name,
            l.type || "",
            l.description || "",
            l.atmosphere || "",
            l.climate || "",
            l.inhabitants || "",
            l.history || "",
            l.secrets || ""
        ]);
        await writeSheetValues("Locations", locHeader, locRows);

        // Write Items Sheet
        const itemHeader = ["ID", "ชื่อไอเทม (Name)", "ประเภท (Type)", "ระดับความหายาก (Rarity)", "คำอธิบายความสามารถ (Description)", "ประวัติไอเทม (Lore)", "ผู้ครอบครองปัจจุบัน (Current Owner)", "สถานที่เก็บรักษา (Location)"];
        const itemRows = freshItems.map(i => [
            i.id,
            i.name,
            i.type || "",
            i.rarity || "",
            i.description || "",
            i.lore || "",
            i.owner?.name || "",
            i.location?.name || ""
        ]);
        await writeSheetValues("Items", itemHeader, itemRows);

        // Write Lore Sheet
        const loreHeader = ["ID", "ชื่อ (Title)", "ประเภท (Type)", "ระดับความสำคัญ (Importance)", "ยุคสมัย (Era)", "กลุ่มของ Lore (Group)", "ขอบเขต (Scope)", "สถานที่หลัก (Location)", "Lore หลัก (Parent Lore)", "เนื้อหา (Content)", "ตัวละครที่เกี่ยวข้อง (Related Characters)", "สถานที่ที่เกี่ยวข้อง (Locations)", "ไอเทมที่เกี่ยวข้อง (Items)"];
        const loreRows = freshLore.map(l => {
            // Map character IDs to names
            const charNames: string[] = [];
            const idsChar = (l.relatedCharacterIds as string[]) || [];
            idsChar.forEach(id => {
                const char = dbCharacters.find(c => c.id === id);
                if (char) charNames.push(char.name);
            });

            // Map Location IDs to names
            const locNames: string[] = [];
            const idsLoc = (l.relatedLocationIds as string[]) || [];
            idsLoc.forEach(id => {
                const loc = freshLocs.find(loc => loc.id === id);
                if (loc) locNames.push(loc.name);
            });

            // Map Item IDs to names
            const itemNames: string[] = [];
            const idsItem = (l.relatedItemIds as string[]) || [];
            idsItem.forEach(id => {
                const item = freshItems.find(item => item.id === id);
                if (item) itemNames.push(item.name);
            });

            return [
                l.id,
                l.title,
                l.type || "",
                l.importance || 5,
                l.era?.name || "",
                l.group?.name || "",
                l.scope || "world",
                l.location?.name || "",
                l.parentLore?.title || "",
                stripHtml(l.content),
                charNames.join(", "),
                locNames.join(", "),
                itemNames.join(", ")
            ];
        });
        await writeSheetValues("Lore", loreHeader, loreRows);

        // Write Entities Sheet
        const entityHeader = ["ID", "ชื่อ (Name)", "ประเภท (Type)", "ระดับความเป็นอันตราย (Threat Level)", "รูปร่างลักษณะ (Appearance)", "ความสามารถพิเศษ (Abilities)", "จุดอ่อน (Weaknesses)", "ถิ่นที่อยู่อาศัย (Habitat)", "คำอธิบายทั่วไป (Description)"];
        const entityRows = freshEntities.map(e => {
            const abilitiesStr = Array.isArray(e.abilities) ? e.abilities.join(", ") : "";
            const weaknessesStr = Array.isArray(e.weaknesses) ? e.weaknesses.join(", ") : "";
            return [
                e.id,
                e.name,
                e.type || "",
                e.threatLevel || "",
                e.appearance || "",
                abilitiesStr,
                weaknessesStr,
                e.habitat || "",
                e.description || ""
            ];
        });
        await writeSheetValues("Entities", entityHeader, entityRows);

        // Revalidate Cache tags
        try {
            revalidateTag(CACHE_TAGS.locations(novelId), "default");
            revalidateTag(CACHE_TAGS.ideas(novelId), "default");
            revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);
        } catch (revalidateErr) {
            console.log("[SHEETS_SYNC] Cache revalidation skipped (running outside Next.js request scope)");
        }

        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        console.log(`[SHEETS_SYNC] Completed 2-way sync successfully for novel: ${novelId}. URL: ${spreadsheetUrl}`);

        return { success: true, spreadsheetUrl };

    } catch (error: any) {
        console.error("[SHEETS_SYNC] Error in 2-way sync server action:", error);
        return { success: false, error: error?.message || "Failed to sync with Google Sheets" };
    }
}
