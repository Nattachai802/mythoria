/**
 * Idea Vault — คัดลอกไอเดียเดิมที่ "ไม่ใช่การ์ดในฉาก" จาก ideas → idea_vault
 *
 * - ไม่ลบ/ไม่แก้ตาราง ideas แม้แต่แถวเดียว (อ่านอย่างเดียว)
 * - การ์ดที่อยู่บน canvas_data ของฉาก = การ์ดฉากย่อย → ข้าม (อยู่ที่เดิม)
 * - รันซ้ำได้: ข้ามแถวที่เคยคัดลอกแล้ว (idea_vault.legacy_idea_id unique) + ลิงก์ onConflictDoNothing
 * - ลิงก์: ideas.linked_lore_ids → about lore · factions.linked_idea_ids → about faction
 *
 * Usage:
 *   npx tsx scripts/migrate-idea-vault.ts           # dry-run (ค่าเริ่มต้น) นับอย่างเดียว ไม่เขียน
 *   npx tsx scripts/migrate-idea-vault.ts --apply   # เขียนจริง
 *
 * ต้องรัน migrations/0019_idea_vault.sql ก่อน
 */

import { db } from "../db/drizzle";
import { ideas, ideaVault, ideaVaultLinks, timelineEvents, factions, loreEntries } from "../db/schema";
import { scopesFromCategory } from "../lib/idea-scopes";

const APPLY = process.argv.includes("--apply");

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

async function main() {
    console.log(APPLY ? "== APPLY (เขียนจริง) ==" : "== DRY-RUN (ไม่เขียน) — ใส่ --apply เพื่อเขียนจริง ==");

    const allIdeas = await db.select().from(ideas);
    const events = await db.select({ canvasData: timelineEvents.canvasData }).from(timelineEvents);
    const onCanvas = new Set<string>();
    for (const e of events) {
        for (const it of Array.isArray(e.canvasData) ? (e.canvasData as { type?: string; referenceId?: string }[]) : []) {
            if (it?.type === "idea" && it.referenceId) onCanvas.add(it.referenceId);
        }
    }

    const existing = await db.select({ id: ideaVault.id, legacy: ideaVault.legacyIdeaId }).from(ideaVault);
    const vaultIdByLegacy = new Map(existing.filter(r => r.legacy).map(r => [r.legacy!, r.id]));

    const candidates = allIdeas.filter(i => !onCanvas.has(i.id));
    const toInsert = candidates.filter(i => !vaultIdByLegacy.has(i.id));

    console.log({
        ideasTotal: allIdeas.length,
        beatsOnCanvas: allIdeas.filter(i => onCanvas.has(i.id)).length,
        candidates: candidates.length,
        alreadyCopied: candidates.length - toInsert.length,
        toInsert: toInsert.length,
        toInsertDetected: toInsert.filter(i => i.isDetected).length,
    });

    if (APPLY && toInsert.length) {
        const inserted = await db.insert(ideaVault).values(toInsert.map(i => ({
            novelId: i.novelId,
            text: i.title.trim().slice(0, 500) || "(ไม่มีหัวข้อ)",
            body: i.content?.trim() || null,
            summary: i.summary?.trim() || null,
            summarySource: i.summary?.trim() ? "user" : null,
            scopes: scopesFromCategory(i.category),
            isDetected: i.isDetected ?? false,
            isArchived: i.isArchived ?? false,
            legacyIdeaId: i.id,
            createdAt: i.createdAt, // คงวันที่จดเดิม
            updatedAt: i.updatedAt,
        }))).onConflictDoNothing().returning({ id: ideaVault.id, legacy: ideaVault.legacyIdeaId });
        for (const r of inserted) vaultIdByLegacy.set(r.legacy!, r.id);
        console.log(`inserted notes: ${inserted.length}`);
    }

    // ลิงก์ — นับจากแถวที่จะอยู่ในคลัง (ทั้งที่เพิ่งคัดลอกและเคยคัดลอก)
    const novelOfIdea = new Map(allIdeas.map(i => [i.id, i.novelId]));
    const loreRows = await db.select({ id: loreEntries.id, novelId: loreEntries.novelId }).from(loreEntries);
    const loreNovel = new Map(loreRows.map(r => [r.id, r.novelId]));
    const links: (typeof ideaVaultLinks.$inferInsert)[] = [];
    let skippedLinks = 0;

    for (const i of candidates) {
        for (const loreId of ids(i.linkedLoreIds)) {
            if (loreNovel.get(loreId) !== i.novelId) { skippedLinks++; continue; } // lore ถูกลบ / คนละนิยาย
            links.push({ novelId: i.novelId, noteId: vaultIdByLegacy.get(i.id) ?? `(new:${i.id})`, targetType: "lore", targetId: loreId, relation: "about" });
        }
    }
    for (const f of await db.select({ id: factions.id, novelId: factions.novelId, linkedIdeaIds: factions.linkedIdeaIds }).from(factions)) {
        for (const ideaId of ids(f.linkedIdeaIds)) {
            if (onCanvas.has(ideaId) || novelOfIdea.get(ideaId) !== f.novelId) { skippedLinks++; continue; } // การ์ดในฉาก / ไอเดียถูกลบ
            links.push({ novelId: f.novelId, noteId: vaultIdByLegacy.get(ideaId) ?? `(new:${ideaId})`, targetType: "faction", targetId: f.id, relation: "about" });
        }
    }
    console.log({ links: links.length, loreLinks: links.filter(l => l.targetType === "lore").length, factionLinks: links.filter(l => l.targetType === "faction").length, skippedLinks });

    if (APPLY && links.length) {
        const real = links.filter(l => !l.noteId.startsWith("(new:"));
        const done = await db.insert(ideaVaultLinks).values(real).onConflictDoNothing().returning({ id: ideaVaultLinks.id });
        console.log(`inserted links: ${done.length} (ที่เหลือมีอยู่แล้ว)`);
    }

    const after = await db.select({ id: ideas.id }).from(ideas);
    if (after.length !== allIdeas.length) throw new Error(`จำนวนแถว ideas เปลี่ยน ${allIdeas.length} → ${after.length} — หยุดและตรวจ`);
    console.log(`ideas ไม่เปลี่ยน: ${after.length} แถว ✓`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
