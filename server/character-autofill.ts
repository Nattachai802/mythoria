'use server';

// AI แตกข้อความแท็บภาพรวม → เติมช่องว่างในแท็บข้อมูลพื้นฐาน (เบื้องหลังด้วย after())
// เรียกจากหน้าตัวละครตอนผู้ใช้คลิกออกจากช่องภาพรวมที่แก้ (ไม่เรียกทุกครั้งที่หยุดพิมพ์)

import { after } from "next/server";
import { db } from "@/db/drizzle";
import { characters } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callAi, logParseFailure } from "@/lib/ai-gateway";
import { requireNovelAccess, authErrorMessage } from "@/lib/authz";
import {
    AUTOFILL_FIELDS, OVERVIEW_SOURCES, emptyPaths, planAutofill,
    type AutofillPath, type AutofillSuggestion,
} from "@/lib/character-autofill";

const SCHEMA = {
    type: "object",
    properties: {
        fields: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    path: { type: "string", enum: Object.keys(AUTOFILL_FIELDS) },
                    value: { type: "string" },
                    quote: { type: "string" },
                },
                required: ["path", "value", "quote"],
                additionalProperties: false,
            },
        },
    },
    required: ["fields"],
    additionalProperties: false,
};

/** ผู้ใช้แก้ภาพรวมเสร็จ — คืนทันที งาน AI วิ่งต่อหลังส่งคำตอบ */
export async function requestProfileAutofill(characterId: string) {
    try {
        const [c] = await db.select({ novelId: characters.novelId }).from(characters).where(eq(characters.id, characterId)).limit(1);
        if (!c) return { success: false, error: "Character not found" };
        await requireNovelAccess(c.novelId);
        // ponytail: ไม่มีคิว/กันซ้ำ — คลิกออกหลายช่องติดกันเรียกได้หลายครั้ง แต่ละรอบเติมแค่ช่องที่ยังว่าง จึงไม่ทับกัน
        after(() => runProfileAutofill(characterId, c.novelId));
        return { success: true };
    } catch (error) {
        return { success: false, error: authErrorMessage(error, "Failed to start autofill") };
    }
}

/** ปุ่ม "ให้ AI เติมจากภาพรวม" — รอผลจริง คืนจำนวนช่องที่เติม (ใช้กับตัวละครที่ภาพรวมเขียนไว้ก่อนแล้ว) */
export async function runProfileAutofillNow(characterId: string) {
    try {
        const [c] = await db.select({ novelId: characters.novelId }).from(characters).where(eq(characters.id, characterId)).limit(1);
        if (!c) return { success: false, error: "ไม่พบตัวละคร" };
        await requireNovelAccess(c.novelId);
        const r = await runProfileAutofill(characterId, c.novelId, true);
        return r.error ? { success: false, error: r.error } : { success: true, filled: r.filled, reason: r.reason };
    } catch (error) {
        return { success: false, error: authErrorMessage(error, "เติมข้อมูลไม่สำเร็จ") };
    }
}

type RunResult = { filled: number; reason?: "no-empty" | "no-overview"; error?: string };

async function runProfileAutofill(characterId: string, novelId: string, surfaceErrors = false): Promise<RunResult> {
    try {
        const [c] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
        if (!c) return { filled: 0 };
        const profile = (c.profile ?? {}) as Record<string, unknown>;
        const empty = emptyPaths(profile);
        const sources = OVERVIEW_SOURCES
            .map((k) => [k, (c[k] ?? "").trim()] as const)
            .filter(([, v]) => v.length > 0);
        if (empty.length === 0) return { filled: 0, reason: "no-empty" };
        if (sources.length === 0) return { filled: 0, reason: "no-overview" };

        const label = { description: "สรุป", appearance: "รูปลักษณ์", personality: "บุคลิกภาพ", backstory: "ปูมหลัง" } as const;
        const resp = await callAi({
            feature: "character-autofill",
            novelId,
            system: "คุณช่วยนักเขียนนิยายจัดข้อมูลตัวละครให้เป็นช่อง ตอบเป็น JSON ตาม schema เท่านั้น",
            prompt: `ด้านล่างคือข้อความที่นักเขียนเขียนอธิบายตัวละคร "${c.name}" เอง
ให้ดึงข้อมูลที่ระบุไว้ชัดในข้อความ มาเติมช่องที่ยังว่าง

กฎ:
- ใช้เฉพาะสิ่งที่ข้อความบอกไว้ ห้ามเดา ห้ามแต่งเพิ่ม ถ้าไม่มีให้ข้ามช่องนั้น
- quote = ข้อความต้นฉบับที่เป็นหลักฐาน คัดมาตรงตัว สั้นที่สุดที่พอเข้าใจ
- value สั้น กระชับ ภาษาเดียวกับต้นฉบับ · ช่องตัวเลข (อายุ ส่วนสูง) ใส่ตัวเลขอย่างเดียว

ช่องที่ยังว่าง:
${empty.map((p) => `- ${p} = ${AUTOFILL_FIELDS[p as AutofillPath].label}`).join("\n")}

ข้อความของนักเขียน:
${sources.map(([k, v]) => `[${label[k]}]\n${v.slice(0, 4000)}`).join("\n\n")}`,
            responseSchema: SCHEMA,
        });

        let parsed: { fields?: AutofillSuggestion[] };
        try {
            parsed = JSON.parse(resp.text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
        } catch {
            await logParseFailure(resp.logId, resp.text);
            return { filled: 0, error: surfaceErrors ? "AI ตอบกลับผิดรูปแบบ ลองใหม่อีกครั้ง" : undefined };
        }

        // อ่าน profile ล่าสุดอีกรอบ — ผู้ใช้อาจกรอกช่องเองระหว่างรอ AI
        const [fresh] = await db.select({ profile: characters.profile }).from(characters).where(eq(characters.id, characterId)).limit(1);
        const plan = planAutofill((fresh?.profile ?? {}) as Record<string, unknown>, parsed.fields ?? []);
        if (plan.count === 0) return { filled: 0 };
        await db.update(characters)
            .set({ profile: sql`coalesce(${characters.profile}, '{}'::jsonb) || ${JSON.stringify(plan.patch)}::jsonb` })
            .where(eq(characters.id, characterId));
        revalidatePath(`/dashboard/project/${novelId}/characters/${characterId}`);
        return { filled: plan.count };
    } catch (error) {
        // เบื้องหลัง: โควตาเต็ม/AI ล่ม = ข้ามเงียบ ๆ · กดปุ่ม: บอกผู้ใช้
        console.error("[Autofill] error:", error);
        return { filled: 0, error: surfaceErrors ? (error instanceof Error ? error.message : "AI ใช้งานไม่ได้ตอนนี้") : undefined };
    }
}
