"use server";

import { db } from "@/db/drizzle";
import { novels, notes, driveSettings, driveSync, driveCredentials } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setCredentials, createDriveFolder, createDoc, getDocMetadata, getDocContent, updateDocContent } from "@/lib/google-drive";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Helper สำหรับดึง Access Token ปัจจุบันของ User
async function setupGoogleAuth() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    // ดึง Token จาก driveCredentials (แยกออกจาก better-auth)
    // รองรับกรณีที่ user ใช้ Google account ต่าง email กับ login
    const creds = await db.query.driveCredentials.findFirst({
        where: eq(driveCredentials.userId, session.user.id)
    });

    if (!creds?.accessToken) {
        throw new Error("Google Drive is not connected");
    }

    setCredentials(creds.accessToken, creds.refreshToken ?? undefined);
    return session.user;
}

export async function checkGoogleConnected(): Promise<{ connected: boolean; googleEmail?: string }> {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user) return { connected: false };

        const creds = await db.query.driveCredentials.findFirst({
            where: eq(driveCredentials.userId, session.user.id)
        });

        if (!creds?.accessToken) return { connected: false };

        return { connected: true, googleEmail: creds.googleEmail };
    } catch {
        return { connected: false };
    }
}

// ==========================================
// 1. เริ่มต้นเชื่อมต่อ Drive สำหรับนิยายเรื่องนี้
// ==========================================
export async function initializeDriveSync(novelId: string) {
    await setupGoogleAuth();

    // 1. เช็คว่าเปิดใช้งานเรื่องนี้หรือยัง
    const novel = await db.query.novels.findFirst({
        where: eq(novels.id, novelId)
    });

    if (!novel) throw new Error("Novel not found");

    // 2. ถ้ายังไม่เคยเชื่อมต่อ ให้สร้าง Folder ใหม่ชื่อเดียวกับนิยายในหน้าแรกของ Drive
    let settings = await db.query.driveSettings.findFirst({
        where: eq(driveSettings.novelId, novelId)
    });

    if (!settings || !settings.rootFolderId) {
        // เรียกคำสั่งสร้างโฟลเดอร์ใน Drive จาก Utility ของเรา
        const folderName = `Mythoria: ${novel.title}`;
        const newFolderId = await createDriveFolder(folderName);

        // บันทึก Folder ID เก็บไว้ใน DB (driveSettings)
        if (!settings) {
            await db.insert(driveSettings).values({
                novelId: novelId,
                rootFolderId: newFolderId,
                isEnabled: true,
            });
        } else {
            await db.update(driveSettings)
                .set({ rootFolderId: newFolderId, isEnabled: true })
                .where(eq(driveSettings.id, settings.id));
        }

        settings = await db.query.driveSettings.findFirst({
            where: eq(driveSettings.novelId, novelId)
        });
    }

    return { success: true, folderId: settings?.rootFolderId };
}

// ==========================================
// 2. การผลักข้อมูลครั้งแรก (หรือ 1-way ส่งไปกูเกิลแบบง่ายๆก่อน)
// ==========================================
export async function syncNoteToDrive(noteId: string, forceContent?: string) {
    await setupGoogleAuth();

    const note = await db.query.notes.findFirst({
        where: eq(notes.id, noteId)
    });

    if (!note) throw new Error("Note not found");

    // หากโฟลเดอร์ของนิยาย
    const settings = await db.query.driveSettings.findFirst({
        where: eq(driveSettings.novelId, note.novelId)
    });

    if (!settings?.rootFolderId || !settings.isEnabled) {
        throw new Error("Drive sync is not enabled for this novel");
    }

    // หาว่า Note นี้เคยมี Google Docs จับคู่ไว้รึยัง
    let syncRecord = await db.query.driveSync.findFirst({
        where: eq(driveSync.noteId, noteId)
    });

    // ถ้ายังไม่เคยมี ให้สร้าง Google Docs ใหม่เอี่ยม
    if (!syncRecord) {
        // 1. สร้าง Doc เปล่าในโฟลเดอร์นิยายนั้น
        const newDocId = await createDoc(note.title, settings.rootFolderId);

        // Guard: ถ้า createDoc คืนค่า null/undefined ให้หยุดทำงาน
        if (!newDocId) {
            throw new Error("Failed to create Google Doc — createDoc returned no ID");
        }

        // 2. จำคู่การผูกมิตรนี้ลง DB พร้อมเตรียมฐาน (Base) สำหรับ 3-way merge
        await db.insert(driveSync).values({
            noteId: noteId,
            novelId: note.novelId,
            googleDocId: newDocId,
            googleDriveFolderId: settings.rootFolderId,
            baseContent: note.content, // จำไว้เป็นจุดอ้างอิงล่าสุด!
            lastSyncedAt: new Date(),
            lastLocalModifiedAt: note.updatedAt,
            syncStatus: "synced"
        });

        syncRecord = await db.query.driveSync.findFirst({
            where: eq(driveSync.noteId, noteId)
        });
    }

    if (!syncRecord) {
        throw new Error("Failed to initialize or retrieve drive sync record.");
    }
    
    // ==========================================
    // THE COORDINATOR LOGIC (Phase 1)
    // ==========================================

    const localModifiedAt = new Date(note.updatedAt).getTime();
    const lastSyncedAtTime = syncRecord.lastSyncedAt ? new Date(syncRecord.lastSyncedAt).getTime() : 0;
    
    // 1. Get Remote Metadata
    let remoteModifiedAtStr: string | null | undefined = null;
    try {
        remoteModifiedAtStr = await getDocMetadata(syncRecord.googleDocId);
    } catch (e) {
        console.warn("Could not get Google Doc metadata", e);
    }
    
    const remoteModifiedAt = remoteModifiedAtStr ? new Date(remoteModifiedAtStr).getTime() : 0;

    // Buffer 5 วินาที เคลียร์ความคลาดเคลื่อนของเวลาเซิร์ฟเวอร์
    const TIME_BUFFER = 5000; 
    
    const isLocalNewer = localModifiedAt > lastSyncedAtTime + TIME_BUFFER;
    const isRemoteNewer = remoteModifiedAt > lastSyncedAtTime + TIME_BUFFER;

    // -- ดึง HTML ของเว็บ (ที่เราแก้ไขปัจจุบัน) --
    let htmlContent = forceContent || "";
    if (!forceContent && note.content) {
        if (typeof note.content === "string") {
            htmlContent = note.content;
        } else if (typeof note.content === "object" && (note.content as any).text) {
            htmlContent = (note.content as any).text;
        }
    }

    if (!forceContent) {
        // [Phase 2 & 3] Conflict! ทั้งคู่แก้มา
        if (isLocalNewer && isRemoteNewer) {
            console.log("Both newer. Attempting Auto-Merge (3-Way Merge)...");
            
            const docContent = await getDocContent(syncRecord.googleDocId);
            const { googleDocToHtml, diffAndMerge } = await import("./drive-converter");
            
            const remoteHtml = googleDocToHtml(docContent);
            const localHtml = htmlContent;
            let baseHtml = "";
            
            if (syncRecord.baseContent) {
                if (typeof syncRecord.baseContent === "string") {
                    baseHtml = syncRecord.baseContent;
                } else if (typeof syncRecord.baseContent === "object" && (syncRecord.baseContent as any).text) {
                    baseHtml = (syncRecord.baseContent as any).text;
                }
            }

            const { mergedText, hasConflict } = diffAndMerge(baseHtml, localHtml, remoteHtml);

            if (hasConflict) {
                console.warn("SYNC CONFLICT DETECTED!");
                return { 
                    success: false, 
                    conflict: true, 
                    docId: syncRecord.googleDocId,
                    localContent: localHtml,
                    remoteContent: remoteHtml 
                };
            } else {
                console.log("Merge Successful! Pushing to DB and Drive.");
                // push merged to drive
                await updateDocContent(syncRecord.googleDocId, mergedText);

                // save to db
                const updatedContent = { text: mergedText };
                await db.update(notes)
                    .set({
                        content: updatedContent,
                        updatedAt: new Date()
                    })
                    .where(eq(notes.id, noteId));

                await db.update(driveSync)
                    .set({ 
                        lastSyncedAt: new Date(),
                        lastRemoteModifiedAt: new Date(remoteModifiedAt),
                        lastLocalModifiedAt: new Date(),
                        baseContent: updatedContent,
                        syncStatus: "synced"
                    })
                    .where(eq(driveSync.id, syncRecord.id));

                return { success: true, merged: true, docId: syncRecord.googleDocId };
            }
        } 
        
        if (isRemoteNewer && !isLocalNewer) {
            // ==========================================
            // FAST-FORWARD PULL
            // ==========================================
        console.log("Drive is newer. Pulling to local...");
        const docContent = await getDocContent(syncRecord.googleDocId);
        
        // TODO: ใน Phase 2 เราจะเรียก restoreFromSnapshot ที่นี่
        // ตอนนี้เอา Plain text/HTML กลับมาก่อนแบบหยาบๆ 
        const { googleDocToHtml } = await import("./drive-converter");
        const pulledHtml = googleDocToHtml(docContent);

        // เซฟลง Database
        const updatedContent = { text: pulledHtml };
        await db.update(notes)
            .set({ 
                content: updatedContent,
                updatedAt: new Date() 
            })
            .where(eq(notes.id, noteId));

        await db.update(driveSync)
            .set({ 
                lastSyncedAt: new Date(),
                lastRemoteModifiedAt: new Date(remoteModifiedAt),
                syncStatus: "synced",
                baseContent: updatedContent
            })
            .where(eq(driveSync.id, syncRecord.id));

        return { success: true, pulled: true, docId: syncRecord.googleDocId };
    }
}

    // ==========================================
    // FAST-FORWARD PUSH (หรือกรณี Force Resolve ทับทั้งผอง)
    // ==========================================
    if (forceContent) {
        console.log("Force Override with explicit content!");
    } else {
        console.log("Local is newer or equal. Pushing to Drive...");
    }
    
    if (htmlContent && syncRecord?.googleDocId) {
        await updateDocContent(syncRecord.googleDocId, htmlContent);
        
        await db.update(driveSync)
            .set({ 
                lastSyncedAt: new Date(),
                lastLocalModifiedAt: new Date(localModifiedAt),
                baseContent: note.content,
                syncStatus: "synced"
            })
            .where(eq(driveSync.id, syncRecord.id));
    }

    return { success: true, pushed: true, docId: syncRecord?.googleDocId };
}
