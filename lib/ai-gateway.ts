import "server-only";

/**
 * AI Gateway — จุดผ่านเดียว (choke point) ของทุกการเรียก AI ใน Mythoria
 * ---------------------------------------------------------------------
 * ทุกฟีเจอร์ประกาศตัวใน AI_FEATURES registry ด้านล่าง แล้วเรียกผ่าน callAi()
 * gateway จะจัดการให้ครบทุกขั้น: flag เปิด/ปิด → guest → quota รายวัน →
 * เดิน fallback chain ตามลำดับ → retry → log usage/token/latency ลง ai_usage_log
 *
 * หลักการ:
 * - ไม่มีแถวใน ai_features = ใช้ default จาก registry (เปิด, quota ตาม registry)
 * - log ทำแบบ best-effort — DB ล้มต้องไม่ทำให้ฟีเจอร์ AI ล้มตาม
 * - ห้ามเก็บ prompt/เนื้อหาผู้ใช้ใน log (privacy) — เก็บแค่ metadata
 */

import { db } from "@/db/drizzle";
import { aiFeatures, aiUsageLog, aiActiveRuns } from "@/db/schema";
import { eq, gte, and, ne, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { isGuest, GUEST_AI_MESSAGE } from "@/lib/guest";
import {
    AI_FEATURES,
    resolvePythonFeature,
    type AiProvider,
    type AiProviderStep,
    type AiFeatureDef,
    type AiFeatureKey,
} from "@/lib/ai-features";

/**
 * registry + python path mapping อยู่ที่ lib/ai-features.ts (pure module — CLI ใช้ร่วมกัน)
 * re-export ต่อให้ call sites เดิม import จาก gateway ที่เดียวเหมือนเดิม
 */
export { AI_FEATURES, resolvePythonFeature };
export type { AiProvider, AiProviderStep, AiFeatureDef, AiFeatureKey };

// ============================================
// Errors
// ============================================

export type AiBlockReason = "disabled" | "guest" | "quota" | "all-failed" | "unknown-feature";

export class AiControlError extends Error {
    reason: AiBlockReason;
    constructor(reason: AiBlockReason, message: string) {
        super(message);
        this.name = "AiControlError";
        this.reason = reason;
    }
}

// ============================================
// Flag + quota (cache override 15 วิ กัน query ทุก call)
// ============================================

interface FeatureOverride {
    enabled: boolean;
    dailyLimitPerUser: number | null;
}

type OverrideCacheEntry = { value: FeatureOverride | null; expires: number };
const overrideCache = new Map<string, OverrideCacheEntry>();
const OVERRIDE_TTL_MS = 15_000;

async function getOverride(key: string): Promise<FeatureOverride | null> {
    const hit = overrideCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    try {
        const [row] = await db.select().from(aiFeatures).where(eq(aiFeatures.key, key)).limit(1);
        const value: FeatureOverride | null = row
            ? { enabled: row.enabled, dailyLimitPerUser: row.dailyLimitPerUser }
            : null;
        overrideCache.set(key, { value, expires: Date.now() + OVERRIDE_TTL_MS });
        return value;
    } catch {
        return null; // DB ล้ม = ใช้ default (fail-open ที่ flag แต่ quota ก็เช็คไม่ได้ — tradeoff ที่รับได้)
    }
}

function invalidateOverrideCache(key?: string) {
    if (key) overrideCache.delete(key);
    else overrideCache.clear();
}

// ============================================
// Identity helpers — ใช้ได้ทั้งใน request scope และ background (ไม่มี request = ข้าม)
// ============================================

async function safeGuestCheck(): Promise<boolean> {
    try {
        return await isGuest();
    } catch {
        return false;
    }
}

async function resolveUserId(explicit?: string): Promise<string | null> {
    if (explicit) return explicit;
    try {
        const { requireUser } = await import("@/lib/authz");
        return await requireUser();
    } catch {
        return null; // background context ไม่มี session — caller ควรส่ง userId มาเอง
    }
}

// ============================================
// Live activity — heartbeat "กำลังทำงานอยู่ไหม" แยกจาก ai_usage_log (นั่นคือ log ประวัติ)
// แถวเดียวต่อ (userId, feature) ถูก upsert ทับซ้ำเรื่อยๆ — "active" ตัดสินตอนอ่านด้วย
// lastSeenAt สดพอไหม ไม่ต้องมี job ลบทิ้ง (แอปนี้ไม่มี cron infra)
// ============================================

export const ACTIVE_STALE_MS = 8_000; // server/ai-control.ts อ่านค่าเดียวกันตอนกรอง "active"

export async function markFeatureActive(featureKey: string, userId: string | null, novelId?: string) {
    if (!userId) return; // background context ไม่มี session — ไม่มีอะไรให้ระบุเจ้าของ
    try {
        await db.insert(aiActiveRuns)
            .values({ userId, feature: featureKey, novelId: novelId ?? null })
            .onConflictDoUpdate({
                target: [aiActiveRuns.userId, aiActiveRuns.feature],
                set: {
                    lastSeenAt: sql`now()`,
                    novelId: novelId ?? null,
                    // รอบเก่า stale ไปแล้ว (เกิน ACTIVE_STALE_MS) → ถือเป็นรอบใหม่ รีเซ็ต startedAt
                    startedAt: sql`case when ${aiActiveRuns.lastSeenAt} < now() - interval '${sql.raw(String(ACTIVE_STALE_MS))} milliseconds'
                                    then now() else ${aiActiveRuns.startedAt} end`,
                },
            });
    } catch (e) {
        console.error("[ai-gateway] markFeatureActive failed:", e instanceof Error ? e.message : e);
    }
}

// ============================================
// Gate — เช็คทั้งหมดก่อนยิง AI (flag → guest → quota)
// ============================================

export interface GateContext {
    userId?: string;
    /** ข้าม guest check (เฉพาะ flow ที่ระบบเรียกเอง เช่น seed demo) — ปกติไม่ต้องส่ง */
    skipGuestCheck?: boolean;
}

async function ensureAiAllowed(featureKey: string, ctx: GateContext = {}): Promise<void> {
    const def = AI_FEATURES[featureKey];
    if (!def) throw new AiControlError("unknown-feature", `Unknown AI feature: ${featureKey}`);

    const override = await getOverride(featureKey);
    if (override && !override.enabled) {
        throw new AiControlError(
            "disabled",
            `ฟีเจอร์ "${def.label}" ถูกปิดใช้งานโดยผู้ดูแลระบบ`,
        );
    }

    if (!ctx.skipGuestCheck && (await safeGuestCheck())) {
        throw new AiControlError("guest", GUEST_AI_MESSAGE);
    }

    const limit = override?.dailyLimitPerUser ?? def.defaultDailyLimit;
    if (limit === null) return;

    const userId = await resolveUserId(ctx.userId);
    if (!userId) return; // ระบุตัวตนไม่ได้ — บังคับ quota ไม่ได้ (background job)

    const used = await countTodayRuns(featureKey, userId);
    if (used >= limit) {
        throw new AiControlError(
            "quota",
            `ใช้ฟีเจอร์ "${def.label}" ครบโควตา ${used}/${limit} ครั้งวันนี้แล้ว — โควตารีเซ็ตเที่ยงคืน`,
        );
    }
}

async function countTodayRuns(featureKey: string, userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    try {
        const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(aiUsageLog)
            .where(
                and(
                    eq(aiUsageLog.feature, featureKey),
                    eq(aiUsageLog.userId, userId),
                    gte(aiUsageLog.createdAt, startOfDay),
                    ne(aiUsageLog.status, "blocked"),
                ),
            );
        return row?.count ?? 0;
    } catch {
        return 0;
    }
}

/** เช็คอย่างเดียวไม่ยิง AI — ใช้บรรทัดแรกของ action/route ที่ต้อง fail-fast ก่อนทำงานหนัก */
export async function assertAiAllowed(featureKey: string, ctx: GateContext = {}): Promise<void> {
    await ensureAiAllowed(featureKey, ctx);
}

// ============================================
// Usage log — best-effort
// ============================================

interface UsageRow {
    feature: string;
    provider: AiProvider;
    model: string;
    status: "success" | "error" | "blocked";
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
    errorDetail?: string;
}

/** คืน id ของแถวที่บันทึก — ผู้เรียกเก็บไว้เผื่อต้อง update ทีหลัง (ดู logParseFailure) · null = บันทึกไม่สำเร็จ */
async function logUsage(row: UsageRow, ctx: GateContext & { novelId?: string } = {}): Promise<string | null> {
    try {
        const userId = await resolveUserId(ctx.userId);
        const [inserted] = await db.insert(aiUsageLog).values({
            userId: userId ?? null,
            novelId: ctx.novelId ?? null,
            feature: row.feature,
            provider: row.provider,
            model: row.model,
            status: row.status,
            promptTokens: row.promptTokens ?? 0,
            completionTokens: row.completionTokens ?? 0,
            latencyMs: row.latencyMs ?? null,
            errorDetail: row.errorDetail?.slice(0, 300) ?? null,
        }).returning({ id: aiUsageLog.id });
        return inserted?.id ?? null;
    } catch (e) {
        console.error("[ai-gateway] logUsage failed:", e instanceof Error ? e.message : e);
        return null;
    }
}

/** ยาวสุดที่ยอมเก็บ — พอให้เห็นว่าโมเดลพ่นรูปอะไรมา โดยไม่ทำให้ตารางบวม */
const RAW_RESPONSE_MAX = 4000;

/**
 * provider ตอบกลับมาแล้ว แต่ผู้เรียก parse ไม่ผ่าน — เก็บคำตอบดิบไว้ดีบัก
 *
 * update แถวเดิม ไม่ insert ใหม่: countTodayRuns() นับโควตาจาก "จำนวนแถว" ที่ status != blocked
 * ถ้าแทรกแถวเพิ่มจะหักโควตาผู้ใช้ซ้ำสองครั้งทั้งที่ยิง provider ไปครั้งเดียว
 */
export async function logParseFailure(logId: string | null | undefined, raw: string) {
    if (!logId) return;
    try {
        await db.update(aiUsageLog)
            .set({ status: "parse_error", rawResponse: raw.slice(0, RAW_RESPONSE_MAX) })
            .where(eq(aiUsageLog.id, logId));
    } catch (e) {
        console.error("[ai-gateway] logParseFailure failed:", e instanceof Error ? e.message : e);
    }
}

// ============================================
// Provider adapters
// ============================================

const OPENAI_COMPATIBLE_URLS: Record<"groq" | "typhoon" | "openrouter", string> = {
    groq: "https://api.groq.com/openai/v1/chat/completions",
    typhoon: "https://api.opentyphoon.ai/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

const PROVIDER_KEYS: Record<AiProvider, string | undefined> = {
    groq: process.env.GROQ_API_KEY,
    typhoon: process.env.TYPHOON_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    python: undefined,
};

interface ProviderReply {
    text: string;
    promptTokens: number;
    completionTokens: number;
    /** เฉพาะ OpenAI-compatible — message ดิบสำหรับ caller ที่ต้องใช้ tool_calls */
    rawMessage?: OpenAiMessage;
}

export interface OpenAiToolCall {
    id?: string;
    type?: string;
    function: { name: string; arguments: string };
}

export interface OpenAiMessage {
    role: string;
    content: string | null;
    tool_calls?: OpenAiToolCall[];
}

interface ChatRequest {
    model: string;
    temperature: number;
    maxTokens?: number;
    messages: Array<{ role: string; content: string }>;
    extraBody?: Record<string, unknown>;
    /** บังคับให้ตอบ JSON ตาม schema นี้ที่ระดับ API ไม่ใช่แค่ขอด้วยคำพูดใน prompt — ลด parse failure ที่ต้นตอ */
    responseSchema?: object;
}

async function chatOpenAiCompatible(
    provider: "groq" | "typhoon" | "openrouter",
    req: ChatRequest,
): Promise<ProviderReply> {
    const key = PROVIDER_KEYS[provider];
    if (!key) throw new Error(`${provider}: API key not configured`);

    const res = await fetch(OPENAI_COMPATIBLE_URLS[provider], {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            ...(req.maxTokens != null ? { max_tokens: req.maxTokens } : {}),
            ...(req.responseSchema
                ? { response_format: { type: "json_schema", json_schema: { name: "response", strict: true, schema: req.responseSchema } } }
                : {}),
            ...(req.extraBody ?? {}),
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${provider} API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const message: OpenAiMessage | undefined = data.choices?.[0]?.message;
    const text = message?.content?.trim() ?? "";
    if (!text && !message?.tool_calls?.length) throw new Error(`${provider}: empty response`);
    return {
        text,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        rawMessage: message,
    };
}

let geminiClient: GoogleGenAI | null | undefined;

async function chatGemini(req: ChatRequest): Promise<ProviderReply> {
    const key = PROVIDER_KEYS.gemini;
    if (!key) throw new Error("gemini: GEMINI_API_KEY not configured");
    if (req.extraBody) console.warn("[ai-gateway] extraBody ignored for gemini");

    geminiClient ??= new GoogleGenAI({ apiKey: key });

    // แยก system message → systemInstruction · รวม consecutive same-role กัน Gemini งอแงเรื่อง turn order
    const systemParts: string[] = [];
    const turns: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
    for (const m of req.messages) {
        if (m.role === "system") {
            systemParts.push(m.content);
            continue;
        }
        const role = m.role === "assistant" ? "model" : "user";
        const last = turns[turns.length - 1];
        if (last && last.role === role) last.parts.push({ text: m.content });
        else turns.push({ role, parts: [{ text: m.content }] });
    }

    const response = await geminiClient.models.generateContent({
        model: req.model,
        contents: turns.map((t) => ({ role: t.role, parts: t.parts })),
        config: {
            temperature: req.temperature,
            // Gemini 2.5 เปิด "thinking" มาโดย default และหักโควตาจาก maxOutputTokens เดียวกับคำตอบจริง —
            // ไม่ปิดไว้ เจอเคสที่ thinking กินโควตาหมดก่อนตอบ (finishReason=MAX_TOKENS, ข้อความว่างเปล่า)
            // ทั้งที่โจทย์ของทุกฟีเจอร์ในนี้ (สรุป/แปลง/ให้คะแนน) ไม่ได้ต้องการ step-by-step reasoning โผล่ในผลลัพธ์
            thinkingConfig: { thinkingBudget: 0 },
            ...(req.maxTokens != null ? { maxOutputTokens: req.maxTokens } : {}),
            ...(systemParts.length ? { systemInstruction: systemParts.join("\n\n") } : {}),
            // responseJsonSchema (ไม่ใช่ responseSchema) — รับ JSON Schema มาตรฐานตรงๆ
            // เดียวกับที่ OpenAI-compatible ใช้ (chatOpenAiCompatible ด้านบน) ไม่ต้องแปลง type เป็น
            // enum ตัวพิมพ์ใหญ่แบบ Google's Schema object เดิม — schema เดียวใช้ได้ทั้งสองฝั่ง
            ...(req.responseSchema
                ? { responseMimeType: "application/json", responseJsonSchema: req.responseSchema }
                : {}),
        },
    });

    const text = response.text?.trim() ?? "";
    if (!text) throw new Error("gemini: empty response");
    return {
        text,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
}

// ============================================
// Provider cooldown — เจอ 429/quota จาก provider ไหน ถอย provider นั้น 60 วิ
// (รวม logic rate-limit-backoff ที่เดิมกระจายในแต่ละไฟล์)
// ============================================

const PROVIDER_COOLDOWN_MS = 60_000;
const providerCooldownUntil = new Map<AiProvider, number>();

function isCoolingDown(provider: AiProvider): boolean {
    const until = providerCooldownUntil.get(provider);
    return !!until && until > Date.now();
}

function markCooldownIfRateLimited(provider: AiProvider, errorDetail: string) {
    if (/429|quota|rate.?limit/i.test(errorDetail)) {
        providerCooldownUntil.set(provider, Date.now() + PROVIDER_COOLDOWN_MS);
    }
}

// ============================================
// callAi — entry point หลัก
// ============================================

export interface AiCallOptions extends GateContext {
    feature: string;
    /** ส่ง prompt เดียว = user message เดียว (shorthand) */
    prompt?: string;
    system?: string;
    messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    /** ทับ temperature ของ step แรก (เช่น echo-score ใช้ temp ต่างกันระหว่าง guess/judge) */
    temperature?: number;
    maxTokens?: number;
    /** passthrough เฉพาะ OpenAI-compatible (tools, response_format ฯลฯ) */
    extraBody?: Record<string, unknown>;
    /** บังคับ JSON schema ที่ระดับ API — ใช้ได้ทั้ง gemini (responseSchema) และ OpenAI-compatible (response_format.json_schema) */
    responseSchema?: object;
    novelId?: string;
    /** false = ไม่ mark provider cooldown เมื่อโดน rate limit (caller จัดการ retry เอง) — default true */
    useCooldown?: boolean;
}

export interface AiCallResult extends ProviderReply {
    provider: AiProvider;
    model: string;
    latencyMs: number;
    /** id แถวใน ai_usage_log — ส่งกลับให้ logParseFailure() ตอนอ่านคำตอบไม่ออก · null = บันทึก log ไม่สำเร็จ */
    logId?: string | null;
}

type AiCallContext = GateContext & { novelId?: string };

/** ยิง step เดียว (provider ตัวเดียว) + log — ใช้ทั้งจาก callAi (loop) และ callAiProvider (voting) */
async function executeStep(
    featureKey: string,
    ctx: AiCallContext,
    step: AiProviderStep,
    req: ChatRequest,
    /** false = ไม่ mark cooldown เมื่อโดน rate limit (caller จัดการ retry เอง เช่น bible-import) */
    opts: { markRateLimitCooldown?: boolean } = {},
): Promise<AiCallResult> {
    const startedAt = Date.now();
    try {
        let reply: ProviderReply;
        if (step.provider === "gemini") {
            reply = await chatGemini(req);
        } else if (step.provider === "groq" || step.provider === "typhoon" || step.provider === "openrouter") {
            reply = await chatOpenAiCompatible(step.provider, req);
        } else {
            throw new Error(`${step.provider}: ไม่ใช่ LLM provider ที่ gateway เรียกเองได้`);
        }

        const latencyMs = Date.now() - startedAt;
        const logId = await logUsage(
            {
                feature: featureKey,
                provider: step.provider,
                model: step.model,
                status: "success",
                promptTokens: reply.promptTokens,
                completionTokens: reply.completionTokens,
                latencyMs,
            },
            ctx,
        );

        return { ...reply, provider: step.provider, model: step.model, latencyMs, logId };
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error(`[ai-gateway:${featureKey}] ${detail}`);
        if (opts.markRateLimitCooldown !== false) markCooldownIfRateLimited(step.provider, detail);
        await logUsage(
            {
                feature: featureKey,
                provider: step.provider,
                model: step.model,
                status: "error",
                latencyMs: Date.now() - startedAt,
                errorDetail: detail,
            },
            ctx,
        );
        throw new Error(`${step.provider}/${step.model}: ${detail}`);
    }
}

function buildChatRequest(step: AiProviderStep, options: AiCallOptions): ChatRequest {
    const messages: ChatRequest["messages"] = options.messages ?? [
        ...(options.system ? [{ role: "system", content: options.system }] : []),
        { role: "user", content: options.prompt ?? "" },
    ];
    return {
        model: step.model,
        temperature: options.temperature ?? step.temperature,
        maxTokens: options.maxTokens ?? step.maxTokens,
        messages,
        extraBody: options.extraBody,
        responseSchema: options.responseSchema,
    };
}

export async function callAi(options: AiCallOptions): Promise<AiCallResult> {
    const { feature: featureKey } = options;
    const def = AI_FEATURES[featureKey];
    if (!def) throw new AiControlError("unknown-feature", `Unknown AI feature: ${featureKey}`);

    const ctx: AiCallContext = {
        userId: options.userId,
        skipGuestCheck: options.skipGuestCheck,
        novelId: options.novelId,
    };

    await ensureAiAllowed(featureKey, ctx);
    await markFeatureActive(featureKey, await resolveUserId(ctx.userId), ctx.novelId);

    if (def.chain.length === 0) {
        throw new AiControlError("all-failed", `ฟีเจอร์ "${def.label}" ไม่มี LLM provider (ฝั่ง Python)`);
    }

    const errors: string[] = [];
    for (const step of def.chain) {
        if (isCoolingDown(step.provider)) {
            const waitSec = Math.ceil((providerCooldownUntil.get(step.provider)! - Date.now()) / 1000);
            errors.push(`${step.provider}: cooling down ${waitSec}s (rate limited earlier)`);
            continue;
        }
        try {
            return await executeStep(featureKey, ctx, step, buildChatRequest(step, options), {
                markRateLimitCooldown: options.useCooldown !== false,
            });
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e));
        }
    }

    throw new AiControlError(
        "all-failed",
        `ทุก provider ล้มหมด (${def.label}) — ${errors[errors.length - 1] ?? "no provider configured"}`,
    );
}

/**
 * ยิง provider "ตัวที่ระบุ" จาก chain ของ feature — ไม่เดิน fallback
 * ใช้กับ pattern ที่ต้องถามหลาย provider พร้อมกันแล้วเทียบ/โหวตผล (เช่น character-state extractor)
 */
export async function callAiProvider(
    featureKey: string,
    provider: AiProvider,
    options: Omit<AiCallOptions, "feature"> = {},
): Promise<AiCallResult> {
    const def = AI_FEATURES[featureKey];
    if (!def) throw new AiControlError("unknown-feature", `Unknown AI feature: ${featureKey}`);

    const step = def.chain.find((s) => s.provider === provider);
    if (!step) throw new AiControlError("unknown-feature", `${provider} is not a provider of "${featureKey}"`);

    const ctx: AiCallContext = {
        userId: options.userId,
        skipGuestCheck: options.skipGuestCheck,
        novelId: options.novelId,
    };

    await ensureAiAllowed(featureKey, ctx);
    await markFeatureActive(featureKey, await resolveUserId(ctx.userId), ctx.novelId);

    if (isCoolingDown(provider)) {
        throw new AiControlError("all-failed", `${provider} cooling down (rate limited earlier)`);
    }

    return executeStep(featureKey, ctx, step, buildChatRequest(step, options as AiCallOptions), {
        markRateLimitCooldown: options.useCooldown !== false,
    });
}

// ============================================
// Admin actions helper — set/unset override (ใช้จาก server action หน้า ai-control)
// ============================================

export async function setFeatureOverride(
    key: string,
    patch: { enabled?: boolean; dailyLimitPerUser?: number | null },
): Promise<{ success: boolean; error?: string }> {
    if (!AI_FEATURES[key]) return { success: false, error: "unknown feature" };
    try {
        const [existing] = await db.select().from(aiFeatures).where(eq(aiFeatures.key, key)).limit(1);
        if (existing) {
            await db
                .update(aiFeatures)
                .set(patch)
                .where(eq(aiFeatures.key, key));
        } else {
            await db.insert(aiFeatures).values({
                key,
                enabled: patch.enabled ?? true,
                dailyLimitPerUser: patch.dailyLimitPerUser ?? null,
            });
        }
        invalidateOverrideCache(key);
        return { success: true };
    } catch (e) {
        console.error("[ai-gateway] setFeatureOverride:", e);
        return { success: false, error: "บันทึกไม่สำเร็จ" };
    }
}

export async function resetFeatureOverride(key: string): Promise<{ success: boolean; error?: string }> {
    try {
        await db.delete(aiFeatures).where(eq(aiFeatures.key, key));
        invalidateOverrideCache(key);
        return { success: true };
    } catch (e) {
        console.error("[ai-gateway] resetFeatureOverride:", e);
        return { success: false, error: "รีเซ็ตไม่สำเร็จ" };
    }
}
