"use server";

import { db } from "@/db/drizzle";
import { aiFeatures, aiUsageLog, aiActiveRuns } from "@/db/schema";
import { desc, gte, eq, and, ne, sql } from "drizzle-orm";
import { isGuest } from "@/lib/guest";
import { requireUser } from "@/lib/authz";
import { AI_FEATURES, ACTIVE_STALE_MS } from "@/lib/ai-gateway";

/**
 * AI Control Board — ตัวโหลดข้อมูลหน้า /dashboard/ai-control (read-only)
 * การแก้ flag/quota ทำผ่าน CLI เท่านั้น: `npm run ai list|on|off|quota|reset`
 *
 * ทุกตัวเลขที่หน้านี้โชว์เป็น "ของผู้ใช้ที่ล็อกอินอยู่" เท่านั้น — ยอดรัน โทเคน
 * และประวัติล่าสุด กรองด้วย userId ทุกก้อน
 *
 * เหตุผลสองชั้น: หน้านี้เปิดได้ทุกคนที่ล็อกอิน ไม่ได้กันเฉพาะแอดมิน ถ้าไม่กรอง
 * ผู้ใช้คนหนึ่งจะเห็น errorDetail และยอดใช้งานของอีกคน · และ dailyLimit เป็นโควตา
 * "ต่อคน" อยู่แล้ว ยอดที่เอามาเทียบจึงต้องเป็นของคนเดียวกัน ไม่งั้นสองเลขคนละฐาน
 */

export interface AiModelStepView {
    order: string; // "หลัก" | "สำรอง 1" | "ภายใน Python"
    provider: string;
    model: string;
    temperature: number | null;
    maxTokens: number | null;
}

export interface AiFeatureView {
    key: string;
    label: string;
    description: string;
    enabled: boolean; // merged (override ?? default true)
    dailyLimit: number | null; // merged
    defaultDailyLimit: number | null;
    isOverridden: boolean;
    steps: AiModelStepView[]; // chain เต็มสำหรับแผนผังโมเดล
    usedToday: number;
    /** ISO timestamp ถ้ากำลังทำงานอยู่ตอนนี้ (heartbeat สดภายใน ACTIVE_STALE_MS), null = ไม่ได้ทำงาน */
    activeSince: string | null;
}

export interface AiOverviewData {
    isGuest: boolean;
    features: AiFeatureView[];
    totalsToday: { runs: number; promptTokens: number; completionTokens: number };
    recentRuns: Array<{
        id: string;
        feature: string;
        provider: string;
        model: string;
        status: string;
        promptTokens: number;
        completionTokens: number;
        latencyMs: number | null;
        errorDetail: string | null;
        /** คำตอบดิบจากโมเดล — มีเฉพาะแถวที่ status = "parse_error" */
        rawResponse: string | null;
        createdAt: string;
    }>;
}

const EMPTY_TOTALS = { runs: 0, promptTokens: 0, completionTokens: 0 };

export async function getAiOverview(): Promise<AiOverviewData> {
    if (await isGuest()) {
        return { isGuest: true, features: [], totalsToday: EMPTY_TOTALS, recentRuns: [] };
    }

    // ไม่มี session = ไม่มีอะไรให้ดู — ใช้หน้าจอเดียวกับ guest
    let userId: string;
    try {
        userId = await requireUser();
    } catch {
        return { isGuest: true, features: [], totalsToday: EMPTY_TOTALS, recentRuns: [] };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const mine = eq(aiUsageLog.userId, userId);

    try {
        const staleCutoff = new Date(Date.now() - ACTIVE_STALE_MS);

        const [overrides, todayRows, recent, active] = await Promise.all([
            db.select().from(aiFeatures),
            db
                .select({
                    feature: aiUsageLog.feature,
                    runs: sql<number>`count(*)::int`,
                })
                .from(aiUsageLog)
                .where(and(mine, gte(aiUsageLog.createdAt, startOfDay), ne(aiUsageLog.status, "blocked")))
                .groupBy(aiUsageLog.feature),
            db
                .select({
                    id: aiUsageLog.id,
                    feature: aiUsageLog.feature,
                    provider: aiUsageLog.provider,
                    model: aiUsageLog.model,
                    status: aiUsageLog.status,
                    promptTokens: aiUsageLog.promptTokens,
                    completionTokens: aiUsageLog.completionTokens,
                    latencyMs: aiUsageLog.latencyMs,
                    errorDetail: aiUsageLog.errorDetail,
                    rawResponse: aiUsageLog.rawResponse, // มีเฉพาะแถว parse_error
                    createdAt: aiUsageLog.createdAt,
                })
                .from(aiUsageLog)
                .where(mine)
                .orderBy(desc(aiUsageLog.createdAt))
                .limit(40),
            db
                .select({ feature: aiActiveRuns.feature, startedAt: aiActiveRuns.startedAt })
                .from(aiActiveRuns)
                .where(and(eq(aiActiveRuns.userId, userId), gte(aiActiveRuns.lastSeenAt, staleCutoff))),
        ]);

        const [totals] = await db
            .select({
                runs: sql<number>`count(*)::int`,
                promptTokens: sql<number>`coalesce(sum(${aiUsageLog.promptTokens}),0)::int`,
                completionTokens: sql<number>`coalesce(sum(${aiUsageLog.completionTokens}),0)::int`,
            })
            .from(aiUsageLog)
            .where(and(mine, gte(aiUsageLog.createdAt, startOfDay)));

        const overrideMap = new Map(overrides.map((o) => [o.key, o]));
        const usedMap = new Map(todayRows.map((r) => [r.feature, r.runs]));
        const activeMap = new Map(active.map((a) => [a.feature, a.startedAt.toISOString()]));

        const features: AiFeatureView[] = Object.values(AI_FEATURES).map((def) => {
            const o = overrideMap.get(def.key);
            const steps: AiModelStepView[] = def.chain.map((s, i) => ({
                order: i === 0 ? "หลัก" : `สำรอง ${i}`,
                provider: s.provider,
                model: s.model,
                temperature: s.temperature,
                maxTokens: s.maxTokens ?? null,
            }));
            for (const m of def.pythonModels ?? []) {
                const [provider, model] = m.split("/");
                steps.push({ order: "ภายใน Python", provider, model, temperature: null, maxTokens: null });
            }
            return {
                key: def.key,
                label: def.label,
                description: def.description,
                enabled: o ? o.enabled : true,
                dailyLimit: o ? o.dailyLimitPerUser : def.defaultDailyLimit,
                defaultDailyLimit: def.defaultDailyLimit,
                isOverridden: !!o,
                steps,
                usedToday: usedMap.get(def.key) ?? 0,
                activeSince: activeMap.get(def.key) ?? null,
            };
        });

        return {
            isGuest: false,
            features,
            totalsToday: {
                runs: totals?.runs ?? 0,
                promptTokens: totals?.promptTokens ?? 0,
                completionTokens: totals?.completionTokens ?? 0,
            },
            recentRuns: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        };
    } catch (e) {
        console.error("[ai-control] getAiOverview:", e);
        return { isGuest: false, features: [], totalsToday: EMPTY_TOTALS, recentRuns: [] };
    }
}

/**
 * ให้ตัว poll ฝั่ง client (ทุก ~4 วิ) เรียกเบาๆ — ไม่ต้องรื้อ query ก้อนใหญ่ของ getAiOverview ทั้งชุด
 * คืน { [featureKey]: startedAtISO } เฉพาะฟีเจอร์ที่ยังไม่ stale ของผู้ใช้คนนี้
 */
export async function getActiveFeatureKeys(): Promise<Record<string, string>> {
    if (await isGuest()) return {};
    let userId: string;
    try {
        userId = await requireUser();
    } catch {
        return {};
    }
    try {
        const staleCutoff = new Date(Date.now() - ACTIVE_STALE_MS);
        const active = await db
            .select({ feature: aiActiveRuns.feature, startedAt: aiActiveRuns.startedAt })
            .from(aiActiveRuns)
            .where(and(eq(aiActiveRuns.userId, userId), gte(aiActiveRuns.lastSeenAt, staleCutoff)));
        return Object.fromEntries(active.map((a) => [a.feature, a.startedAt.toISOString()]));
    } catch (e) {
        console.error("[ai-control] getActiveFeatureKeys:", e);
        return {};
    }
}
