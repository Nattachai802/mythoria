'use server';

import { db } from "@/db/drizzle";
import { powerRules, powers, PowerRule } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireNovelAccess } from "@/lib/authz";

export const RULE_KINDS = ["cost", "limit", "forbidden", "condition"] as const;
export const RULE_SEVERITIES = ["hard", "soft"] as const;

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
        powerIds: data.powerIds ?? [],
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
            .where(eq(powerRules.id, id))
            .returning();

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
        await db.delete(powerRules).where(eq(powerRules.id, id));
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
 */
export async function importLimitationsAsRules(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const [all, existing] = await Promise.all([
            db.select().from(powers).where(eq(powers.novelId, novelId)),
            db.select().from(powerRules).where(eq(powerRules.novelId, novelId)),
        ]);

        const seen = new Set(existing.map((r) => r.title));
        const rows = all.flatMap((p) =>
            ((p.limitations as string[] | null) ?? [])
                .map((t) => t?.trim())
                .filter((t): t is string => !!t && !seen.has(t) && (seen.add(t), true))
                .map((title) => ({
                    novelId,
                    title,
                    kind: "limit",
                    severity: "hard",
                    powerIds: [p.id],
                })),
        );

        if (rows.length) await db.insert(powerRules).values(rows);

        revalidatePath(`/dashboard/project/${novelId}/powers`);
        return { success: true, imported: rows.length };
    } catch (error) {
        console.error("Error importing limitations:", error);
        return { success: false, error: "Failed to import limitations" };
    }
}
