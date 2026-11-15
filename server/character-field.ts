'use server';

// Character Design v2: field ที่ผู้เขียนตั้งเองระดับนิยาย — ค่าอยู่ที่ characters.custom_values
// ลบ field แล้วค่าที่ค้างใน custom_values ถูกเพิกเฉย (ไม่ไล่ลบ = ไม่มีข้อมูลตัวละครหาย ถ้าสร้าง field ชื่อเดิมใหม่ก็เป็น id ใหม่)

import { db } from "@/db/drizzle";
import { characterFieldDefs, chapters } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireNovelAccess, authErrorMessage } from "@/lib/authz";
import { FIELD_TYPES } from "@/lib/character-profile";

const fieldInput = z.object({
    label: z.string().trim().min(1).max(100),
    type: z.enum(FIELD_TYPES).default("text"),
    options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
    group: z.string().trim().max(100).optional(),
    position: z.number().int().min(0).optional(),
});

const revalidate = (novelId: string) => revalidatePath(`/dashboard/project/${novelId}/characters`, "layout");

async function ownerOf(fieldId: string) {
    const [row] = await db
        .select({ novelId: characterFieldDefs.novelId })
        .from(characterFieldDefs)
        .where(eq(characterFieldDefs.id, fieldId))
        .limit(1);
    if (!row) throw new Error("Field not found");
    await requireNovelAccess(row.novelId);
    return row.novelId;
}

export async function getCharacterFieldDefs(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const data = await db
            .select()
            .from(characterFieldDefs)
            .where(eq(characterFieldDefs.novelId, novelId))
            .orderBy(asc(characterFieldDefs.position), asc(characterFieldDefs.createdAt));
        return { success: true, data };
    } catch (error) {
        console.error("Error fetching character field defs:", error);
        return { success: false, error: authErrorMessage(error, "Failed to fetch fields") };
    }
}

export async function createCharacterFieldDef(novelId: string, input: unknown) {
    try {
        await requireNovelAccess(novelId);
        const parsed = fieldInput.safeParse(input);
        if (!parsed.success) return { success: false, error: "Invalid data", issues: parsed.error.issues };
        const [row] = await db
            .insert(characterFieldDefs)
            .values({ ...parsed.data, novelId })
            .returning();
        revalidate(novelId);
        return { success: true, data: row };
    } catch (error) {
        console.error("Error creating character field def:", error);
        return { success: false, error: authErrorMessage(error, "Failed to create field") };
    }
}

export async function updateCharacterFieldDef(fieldId: string, input: unknown) {
    try {
        const novelId = await ownerOf(fieldId);
        const parsed = fieldInput.partial().safeParse(input);
        if (!parsed.success) return { success: false, error: "Invalid data", issues: parsed.error.issues };
        const [row] = await db
            .update(characterFieldDefs)
            .set(parsed.data)
            .where(eq(characterFieldDefs.id, fieldId))
            .returning();
        revalidate(novelId);
        return { success: true, data: row };
    } catch (error) {
        console.error("Error updating character field def:", error);
        return { success: false, error: authErrorMessage(error, "Failed to update field") };
    }
}

/** ลบเฉพาะนิยาม field — ค่าใน characters.custom_values ไม่ถูกแตะ */
export async function deleteCharacterFieldDef(fieldId: string) {
    try {
        const novelId = await ownerOf(fieldId);
        await db.delete(characterFieldDefs).where(eq(characterFieldDefs.id, fieldId));
        revalidate(novelId);
        return { success: true };
    } catch (error) {
        console.error("Error deleting character field def:", error);
        return { success: false, error: authErrorMessage(error, "Failed to delete field") };
    }
}

/** รายชื่อบท (id/ชื่อ/ลำดับ) สำหรับกราฟ arc และเลือกบทเฉลยความลับ — ไม่ดึงเนื้อหา */
export async function getChapterOptions(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const data = await db
            .select({ id: chapters.id, title: chapters.title, orderIndex: chapters.orderIndex })
            .from(chapters)
            .where(eq(chapters.novelId, novelId))
            .orderBy(asc(chapters.orderIndex));
        return { success: true, data };
    } catch (error) {
        console.error("Error fetching chapter options:", error);
        return { success: false, error: authErrorMessage(error, "Failed to fetch chapters"), data: [] };
    }
}

// ponytail: ไม่มี endpoint นับว่าตัวละครกี่ตัวใช้ field นี้ — เพิ่มตอน UI ต้องเตือนก่อนลบ
