'use server';

import { db } from "@/db/drizzle";
import { powerRules, powers, PowerRule } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireNovelAccess } from "@/lib/authz";

// ห้าม export — ไฟล์ 'use server' export ได้แค่ async function ค่าคงที่จะทำ build พัง
const RULE_KINDS = ["cost", "limit", "forbidden", "condition"] as const;
const RULE_SEVERITIES = ["hard", "soft"] as const;

type RuleInput = {
    title: string;
    description?: string | null;
    kind?: string;
    severity?: string;
    powerIds?: string[];
};

// กัน kind/severity แปลกปลอมหลุดลง DB — คอลัมน์เป็น text เปล่า ไม่มี enum คุมให้
function clean(data: RuleInput) {
    return {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        kind: (RULE_KINDS as readonly string[]).includes(data.kind ?? "") ? data.kind! : "limit",
        severity: (RULE_SEVERITIES as readonly string[]).includes(data.severity ?? "") ? data.severity! : "hard",
        // ไม่ส่ง powerIds มา = ไม่ได้ตั้งใจแก้ขอบเขต — ตอน update ต้องไม่ล้างเป็นกฎทั้งเล่มเงียบ ๆ
        ...(data.powerIds ? { powerIds: data.powerIds } : {}),
    };
}

export async function getPowerRules(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const rules = await db
            .select()
            .from(powerRules)
            .where(eq(powerRules.novelId, novelId))
            .orderBy(asc(powerRules.orderIndex), asc(powerRules.createdAt));
        return { success: true, data: rules as PowerRule[] };
    } catch (error) {
        console.error("Error fetching power rules:", error);
        return { success: false, error: "Failed to fetch power rules", data: [] as PowerRule[] };
    }
}

export async function createPowerRule(novelId: string, data: RuleInput) {
    try {
        await requireNovelAccess(novelId);
        if (!data.title?.trim()) return { success: false, error: "ต้องมีชื่อกฎ" };

        const [rule] = await db
            .insert(powerRules)
            .values({ novelId, ...clean(data) })
            .returning();

        revalidatePath(`/dashboard/project/${novelId}/powers`);
        return { success: true, data: rule };
    } catch (error) {
        console.error("Error creating power rule:", error);
        return { success: false, error: "Failed to create power rule" };
    }
}

export async function updatePowerRule(id: string, novelId: string, data: RuleInput) {
    try {
        await requireNovelAccess(novelId);
        if (!data.title?.trim()) return { success: false, error: "ต้องมีชื่อกฎ" };

        const [rule] = await db
            .update(powerRules)
            .set(clean(data))
            // ผูก novelId ด้วย — requireNovelAccess เช็คแค่ว่ามีสิทธิ์ในเรื่องที่ส่งมา
            // ไม่ได้เช็คว่ากฎ id นี้อยู่ในเรื่องนั้นจริง
            .where(and(eq(powerRules.id, id), eq(powerRules.novelId, novelId)))
            .returning();
        if (!rule) return { success: false, error: "ไม่พบกฎนี้ในเรื่อง" };

        revalidatePath(`/dashboard/project/${novelId}/powers`);
        return { success: true, data: rule };
    } catch (error) {
        console.error("Error updating power rule:", error);
        return { success: false, error: "Failed to update power rule" };
    }
}

export async function deletePowerRule(id: string, novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const deleted = await db
            .delete(powerRules)
            .where(and(eq(powerRules.id, id), eq(powerRules.novelId, novelId)))
            .returning({ id: powerRules.id });
        // ลบ 0 แถวไม่ใช่ความสำเร็จ — ไม่งั้น UI ขึ้น "ลบแล้ว" แต่กฎยังอยู่ตรงนั้น
        if (!deleted.length) return { success: false, error: "ไม่พบกฎนี้ในเรื่อง" };

        revalidatePath(`/dashboard/project/${novelId}/powers`);
        return { success: true };
    } catch (error) {
        console.error("Error deleting power rule:", error);
        return { success: false, error: "Failed to delete power rule" };
    }
}

/**
 * ย้าย powers.limitations (array ข้อความเปล่า ๆ ของเดิม) ขึ้นมาเป็นกฎที่มีโครงสร้าง
 * ข้ามอันที่ชื่อซ้ำกับกฎที่มีอยู่แล้ว → กดซ้ำได้ไม่สร้างซ้ำ
 *
 * ข้อความเดียวกันที่อยู่ในหลายพลัง (เช่น "ใช้ได้เฉพาะตอนกลางคืน" ซึ่งซ้ำกันง่ายมาก)
 * รวมเป็นกฎเดียวที่ผูกทุกพลังนั้น ไม่ใช่กฎของพลังแรกแล้วทิ้งที่เหลือ
 */
export async function importLimitationsAsRules(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const [all, existing] = await Promise.all([
            db.select().from(powers).where(eq(powers.novelId, novelId)),
            db.select().from(powerRules).where(eq(powerRules.novelId, novelId)),
        ]);

        const alreadyRules = new Set(existing.map((r) => r.title));
        const byTitle = new Map<string, string[]>(); // ข้อความกฎ → พลังทุกตัวที่มีข้อความนี้
        for (const p of all) {
            for (const raw of (p.limitations as string[] | null) ?? []) {
                const title = raw?.trim();
                if (!title || alreadyRules.has(title)) continue;
                byTitle.set(title, [...(byTitle.get(title) ?? []), p.id]);
            }
        }

        const rows = [...byTitle].map(([title, powerIds]) => ({
            novelId,
            title,
            kind: "limit",
            severity: "hard",
            powerIds,
        }));

        if (rows.length) await db.insert(powerRules).values(rows);

        revalidatePath(`/dashboard/project/${novelId}/powers`);
        return { success: true, imported: rows.length };
    } catch (error) {
        console.error("Error importing limitations:", error);
        return { success: false, error: "Failed to import limitations" };
    }
}
