/**
 * เขียนชื่อที่ AI สกัดได้ (ยังไม่มีในนิยาย) ลงคลังไอเดียเป็น "รออนุมัติ" — ใช้ร่วมระหว่าง
 * lore extractor เบื้องหลัง และ route extract-entities
 *
 * ไม่ใช่ server action (ไม่มี "use server") — ผู้เรียกต้องเช็คสิทธิ์นิยายก่อนแล้ว
 * (งานเบื้องหลังไม่มี session ให้ requireNovelAccess)
 */

import { db } from "@/db/drizzle";
import { ideaVault, ideaVaultLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headlineOf, isDocText, scopesFromCategory, type IdeaScope } from "@/lib/idea-scopes";

export interface DetectedName { title: string; category: "character" | "worldbuilding" }

/**
 * ชื่อที่ตรงกับโน้ตเดิม (ไม่สนตัวพิมพ์) = ใช้โน้ตเดิม ไม่สร้างซ้ำ · ส่ง loreId มา = ผูก about lore ให้ทุกตัว
 * คืนรายการในรูปเดิมที่หน้า lore ใช้ ({ id, title, category })
 */
export async function upsertDetectedNotes(novelId: string, names: DetectedName[], loreId?: string) {
    if (names.length === 0) return [];
    const existing = await db.select({ id: ideaVault.id, text: ideaVault.text }).from(ideaVault).where(eq(ideaVault.novelId, novelId));
    const byText = new Map(existing.map(n => [n.text.toLowerCase(), n.id]));

    const out: { id: string; title: string; category: string }[] = [];
    const seen = new Set<string>();
    for (const n of names) {
        const key = n.title.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        let id = byText.get(key);
        if (!id) {
            const scopes: IdeaScope[] = [n.category === "character" ? "character" : "worldbuilding"];
            const [row] = await db.insert(ideaVault).values({
                novelId,
                text: n.title.trim().slice(0, 500),
                summary: n.category === "character" ? "ตัวละครที่พบใน Lore" : "สถานที่/สิ่งของที่พบใน Lore",
                source: "สกัดอัตโนมัติจาก Lore",
                scopes,
                isDetected: true,
            }).returning({ id: ideaVault.id });
            id = row.id;
            byText.set(key, id);
        }
        if (loreId) {
            await db.insert(ideaVaultLinks)
                .values({ novelId, noteId: id, targetType: "lore", targetId: loreId, relation: "about" })
                .onConflictDoNothing();
        }
        out.push({ id, title: n.title.trim(), category: n.category });
    }
    return out;
}

/** ไอเดียจาก Discord → คลังไอเดีย (ไม่ revalidate เพราะถูกเรียกระหว่าง render หน้า /idea) */
export async function insertDiscordNote(input: { novelId: string; title: string | null; content: string | null; category: string | null }) {
    const title = input.title?.trim() || "";
    const content = input.content?.trim() || "";
    // ไม่มีหัวข้อ + ข้อความสั้น = เป็นโน้ตสั้นเลย · ข้อความยาว = เอกสาร (หัวเรื่องจากบรรทัดแรก)
    const asJot = !title && content && !isDocText(content);
    const [row] = await db.insert(ideaVault).values({
        novelId: input.novelId,
        text: (title || (asJot ? content : headlineOf(content)) || "ไอเดียจาก Discord").slice(0, 500),
        body: asJot ? null : content || null,
        source: "Discord",
        scopes: scopesFromCategory(input.category),
    }).returning({ id: ideaVault.id });
    return row;
}
