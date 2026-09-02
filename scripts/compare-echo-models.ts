/**
 * เทียบโมเดลผู้เดา (candidate) สำหรับงาน Echo Score โดยเฉพาะ — objective 2 จาก session ทดสอบ:
 * หาโมเดลที่ถูกกว่าโดยยัง "เข้าใจแก่นเรื่องจริง ๆ" ไม่ใช่แค่ JSON parse ผ่าน
 * -----------------------------------------------------------------------
 *
 * v3: ยิงทุก candidate ผ่าน OpenRouter เท่านั้น (รวม Gemini ด้วย) — เครื่องนี้ไม่มี
 * GEMINI_API_KEY/TYPHOON_API_KEY ใน .env เลย เดินตาม fallback chain จริงของ echo-score
 * ([ai-features.ts:103](../lib/ai-features.ts)) ก็ตกไปที่ openrouter/deepseek อยู่ดี — เรียก
 * Gemini ผ่าน OpenRouter แทน direct Google API เพื่อเทียบใต้ transport เดียวกันหมด ตัดโค้ด
 * สองพาธ (GoogleGenAI SDK + OpenAI-compatible) เหลือพาธเดียว
 *
 * เพิ่ม "referee judge" — ทุก candidate เดางานเดาของตัวเอง (self-judge, ตัวเลขต้นทุน/latency จริง
 * ถ้าจะเอาโมเดลนี้ขึ้น production) แต่ยังมี **โมเดลกลางตัวเดียว (REFEREE_MODEL) ตัดสินซ้ำแบบไม่รู้ว่า
 * เดามาจากโมเดลไหน** ให้คะแนนความเข้าใจที่ไม่มี bias ของแต่ละโมเดลตัดสินเข้าข้างตัวเอง — ต้นทุน referee
 * ไม่นับรวมในต้นทุน/การ์ดของ candidate เพราะเป็นค่าใช้จ่ายของการทดลองครั้งนี้ ไม่ใช่ของ production จริง
 *
 * เกณฑ์อ่านผล: ถ้า self hits >> referee hits แปลว่าโมเดลนั้น "ปล่อยผ่านให้ตัวเองง่าย" ไม่ใช่โมเดลที่แย่กว่า
 * ตัวอื่นเสมอไป — ดูช่องว่างนี้ประกอบ ไม่ใช่ดูแค่ self hits เพียว ๆ
 *
 * เรียก provider ตรง ๆ ไม่ผ่าน lib/ai-gateway.ts เพราะไฟล์นั้น import "server-only"
 * (บล็อกไม่ให้รันนอก Next.js) — สคริปต์นี้จึงยิง HTTP เองแบบย่อ ซ้ำ logic ของ
 * chatOpenAiCompatible เล็กน้อย ยอมรับได้เพราะเป็นสคริปต์ทดสอบครั้งเดียว ไม่ใช่โค้ด production
 *
 *   npx tsx scripts/compare-echo-models.ts
 */
import { config } from "dotenv";
import {
    ECHO_K,
    ECHO_GUESS_SCHEMA,
    ECHO_JUDGE_SCHEMA,
    buildGuessPrompt,
    buildJudgePrompt,
    parseGuessResponse,
    parseJudgeResponse,
    type EchoPrompt,
} from "../lib/echo-score.ts";

config({ path: ".env" });

// ─── Candidates round 2 — ตัด Qwen3.5-Flash/GLM-4.5-Air/MiniMax M2 ทิ้ง (parse fail 0/3 ทุกเคส
// รอบก่อน) และ Mistral Small 3.2 ทิ้ง (self>>referee — ตอบมีขยะภาษาอื่นปนจริง ไม่ใช่แค่ noise)
// เลือกใหม่คนละ vendor กันหมด กัน family bias เดียวกับที่ทำให้ตกม้าตายรอบแรก — ราคาเช็คจาก
// openrouter.ai ตอนเขียนสคริปต์นี้ อาจเปลี่ยนได้ไว ───────────────────────────────────
const CANDIDATES = [
    { label: "Gemini 2.5 Flash", model: "google/gemini-2.5-flash", inPerM: 0.30, outPerM: 2.50 },
    { label: "DeepSeek V3.2", model: "deepseek/deepseek-v3.2", inPerM: 0.21, outPerM: 0.31 },
    { label: "GPT-4o-mini", model: "openai/gpt-4o-mini", inPerM: 0.15, outPerM: 0.60 },
    { label: "Gemini 2.5 Flash Lite", model: "google/gemini-2.5-flash-lite", inPerM: 0.10, outPerM: 0.40 },
    { label: "Qwen3-30B-A3B", model: "qwen/qwen3-30b-a3b", inPerM: 0.08, outPerM: 0.24 },
    { label: "Llama 3.3 70B", model: "meta-llama/llama-3.3-70b-instruct", inPerM: 0.12, outPerM: 0.30 },
];

// โมเดลกลางตัดสิน — ตั้งใจเลือกให้แรง+คนละตระกูลจาก candidate ส่วนใหญ่ กัน family bias
// เช็ค slug จริงบน openrouter.ai ก่อนรัน อาจเปลี่ยนชื่อ/เลิกให้บริการได้
const REFEREE_MODEL = "anthropic/claude-sonnet-4.5";

import { getRealCases } from "./real-echo-samples";

// ห่อ ECHO_GUESS_SCHEMA (root เป็น array) เป็น object — บาง backend structured-output ผ่าน
// OpenRouter (OpenAI strict mode reject ตรงๆ 400, Qwen3-30B-A3B ดีเจนเนอเรตเป็นเลขทศนิยมซ้ำ)
// ไม่รองรับ JSON schema ที่ root เป็น array ตรงๆ — parseGuessResponse (regex หา [...] ในข้อความ)
// ยังใช้ได้เหมือนเดิมไม่ต้องแก้ ไม่กระทบ ECHO_GUESS_SCHEMA ของ production (ยังเป็น array เหมือนเดิม)
const WRAPPED_GUESS_SCHEMA = {
    type: "object",
    properties: { guesses: ECHO_GUESS_SCHEMA },
    required: ["guesses"],
    additionalProperties: false, // OpenAI strict mode บังคับ field นี้ทุก object level ไม่งั้น 400
} as const;

// สำเนา ECHO_JUDGE_SCHEMA + additionalProperties:false ทุก object level — ใช้แทนตัวจริงเฉพาะ
// self-judge call ในสคริปต์นี้เท่านั้น (semantics เดียวกันเป๊ะ แค่ strict มากพอ OpenAI ไม่ 400)
// ไม่แก้ ECHO_JUDGE_SCHEMA ตัวจริงเพราะ production ยังไม่เคยเรียก OpenAI ผ่าน gateway
const SELF_JUDGE_SCHEMA = {
    type: "object",
    properties: {
        matched: {
            type: "array",
            items: {
                type: "object",
                properties: { index: { type: "integer" }, reason: { type: "string" } },
                required: ["index", "reason"],
                additionalProperties: false,
            },
        },
    },
    required: ["matched"],
    additionalProperties: false,
} as const;

// ─── Referee-only: เพิ่ม confidence ต่อรายการที่ตัดสินว่า "ตรง" — ไม่แตะ ECHO_JUDGE_SCHEMA
// ของ production เพราะ field นี้มีไว้ช่วยกรอง noise ของ referee เองในการทดลองนี้เท่านั้น
// (self-judge ยังคงใช้ schema เดิมเป๊ะ — จำลองต้นทุน/พฤติกรรม production จริง) ────────────
const REFEREE_JUDGE_SCHEMA = {
    type: "object",
    properties: {
        matched: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    index: { type: "integer" },
                    reason: { type: "string" },
                    confidence: { type: "number" }, // 0.0-1.0 — มั่นใจแค่ไหนว่าข้อนี้ตรงจริง
                },
                required: ["index", "reason", "confidence"],
                additionalProperties: false,
            },
        },
    },
    required: ["matched"],
    additionalProperties: false,
} as const;

function buildRefereeJudgePrompt(prefixText: string, cardText: string, guesses: string[]): EchoPrompt {
    const base = buildJudgePrompt(prefixText, cardText, guesses);
    return {
        system: `${base.system}\n\nเพิ่มเติม: ใส่ "confidence" (0.0-1.0) ต่อรายการที่ตรงด้วย — มั่นใจแค่ไหนว่าข้อนี้ตรงจริง ไม่ใช่แค่ใกล้เคียง`,
        user: base.user,
    };
}

function parseRefereeJudgeResponse(raw: string): { hits: number; matched: { index: number; reason: string; confidence: number }[] } | null {
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.matched)) return null;
        const matched = parsed.matched.filter(
            (m: any) => typeof m?.index === "number" && typeof m?.reason === "string" && typeof m?.confidence === "number",
        );
        return { hits: matched.length, matched };
    } catch {
        return null;
    }
}

interface ProviderResult {
    guesses: string[];
    guessLatencyMs: number;
    guessParsedOk: boolean;
    // self-judge — โมเดลเดียวกับที่เดา ตัดสินเอง (ตัวเลขจริงถ้าเอาโมเดลนี้ขึ้น production)
    selfHits: number | null;
    selfMatched: number[];
    judgeLatencyMs: number;
    judgeParsedOk: boolean;
    // referee-judge — REFEREE_MODEL ตัดสินแบบไม่รู้ว่าเดามาจากโมเดลไหน (de-biased)
    refHits: number | null;
    refMatched: number[];
    refConfidences: number[]; // confidence (0-1) ของแต่ละรายการใน refMatched — เรียงคู่กัน
    refLatencyMs: number;
    refParsedOk: boolean;
    inTokens: number;  // เฉพาะ guess call ของ candidate เอง — ต้นทุน production จริง
    outTokens: number;
    error?: string;
}

type Chat = (p: EchoPrompt, temperature: number, maxTokens: number, schema: object) => Promise<{ text: string; inTokens: number; outTokens: number }>;

function makeOpenRouterChat(model: string): Chat {
    return async (p, temperature, maxTokens, schema) => {
        const key = process.env.OPENROUTER_API_KEY;
        if (!key) throw new Error("OPENROUTER_API_KEY not set");
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model,
                messages: [{ role: "system", content: p.system }, { role: "user", content: p.user }],
                temperature,
                max_tokens: maxTokens,
                response_format: { type: "json_schema", json_schema: { name: "response", strict: true, schema } },
            }),
        });
        if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const data = await res.json();
        return {
            text: data.choices?.[0]?.message?.content?.trim() ?? "",
            inTokens: data.usage?.prompt_tokens ?? 0,
            outTokens: data.usage?.completion_tokens ?? 0,
        };
    };
}

async function runOne(chat: Chat, refereeChat: Chat, prefixText: string, cardText: string): Promise<ProviderResult> {
    const result: ProviderResult = {
        guesses: [], guessLatencyMs: 0, guessParsedOk: false,
        selfHits: null, selfMatched: [], judgeLatencyMs: 0, judgeParsedOk: false,
        refHits: null, refMatched: [], refConfidences: [], refLatencyMs: 0, refParsedOk: false,
        inTokens: 0, outTokens: 0,
    };
    try {
        const guessPrompt = buildGuessPrompt(prefixText, ECHO_K);
        const t0 = Date.now();
        const g = await chat(guessPrompt, 1.0, 512, WRAPPED_GUESS_SCHEMA);
        result.guessLatencyMs = Date.now() - t0;
        result.inTokens += g.inTokens;
        result.outTokens += g.outTokens;
        const guesses = parseGuessResponse(g.text);
        result.guessParsedOk = guesses !== null;
        result.guesses = guesses ?? [];
        if (!guesses || guesses.length === 0) {
            result.error = `guess parse failed — raw: ${g.text.slice(0, 1500)}`;
            return result;
        }

        const judgePrompt = buildJudgePrompt(prefixText, cardText, guesses);

        // self-judge — ต้นทุน/latency จริงถ้าโมเดลนี้ตัดสินงานตัวเองใน production
        const t1 = Date.now();
        const j = await chat(judgePrompt, 0.0, 512, SELF_JUDGE_SCHEMA);
        result.judgeLatencyMs = Date.now() - t1;
        result.inTokens += j.inTokens;
        result.outTokens += j.outTokens;
        const selfJudged = parseJudgeResponse(j.text);
        result.judgeParsedOk = selfJudged !== null;
        if (selfJudged) {
            result.selfHits = selfJudged.hits;
            result.selfMatched = selfJudged.matched.map(m => m.index);
        } else {
            result.error = `self-judge parse failed — raw: ${j.text.slice(0, 1500)}`;
        }

        // referee-judge — ค่าใช้จ่ายของการทดลองนี้เท่านั้น ไม่นับใน inTokens/outTokens ของ candidate
        // ใช้ prompt/schema แยก (มี confidence เพิ่ม) — ไม่ใช่ ECHO_JUDGE_SCHEMA ของ production
        const refereePrompt = buildRefereeJudgePrompt(prefixText, cardText, guesses);
        const t2 = Date.now();
        const rj = await refereeChat(refereePrompt, 0.0, 512, REFEREE_JUDGE_SCHEMA);
        result.refLatencyMs = Date.now() - t2;
        const refJudged = parseRefereeJudgeResponse(rj.text);
        result.refParsedOk = refJudged !== null;
        if (refJudged) {
            result.refHits = refJudged.hits;
            result.refMatched = refJudged.matched.map(m => m.index);
            result.refConfidences = refJudged.matched.map(m => m.confidence);
        }
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
    }
    return result;
}

function printResult(label: string, r: ProviderResult) {
    console.log(`\n  ── ${label} ──`);
    if (r.error) console.log(`  ⚠ ${r.error}`);
    console.log(`  guess: ${r.guessParsedOk ? "OK" : "PARSE FAIL"} (${r.guessLatencyMs}ms, ${r.guesses.length} เดา)`);
    r.guesses.forEach((g, i) => console.log(`    ${i}: ${g}`));
    console.log(`  self-judge:    ${r.judgeParsedOk ? "OK" : "PARSE FAIL"} (${r.judgeLatencyMs}ms) → hits=${r.selfHits} matched=[${r.selfMatched.join(",")}]`);
    const confStr = r.refConfidences.length > 0 ? ` conf=[${r.refConfidences.map(c => c.toFixed(2)).join(",")}]` : "";
    console.log(`  referee-judge: ${r.refParsedOk ? "OK" : "PARSE FAIL"} (${r.refLatencyMs}ms) → hits=${r.refHits} matched=[${r.refMatched.join(",")}]${confStr}`);
    console.log(`  tokens (guess+self-judge เท่านั้น): in=${r.inTokens} out=${r.outTokens}`);
}

function costPerCard(inTokens: number, outTokens: number, inPerM: number, outPerM: number): number {
    return (inTokens / 1_000_000) * inPerM + (outTokens / 1_000_000) * outPerM;
}

async function main() {
    const refereeChat = makeOpenRouterChat(REFEREE_MODEL);
    const allResults: Record<string, ProviderResult[]> = {};

    const CASES = await getRealCases(15);
    if (CASES.length === 0) throw new Error("ไม่พบฉากจริงที่มี beat >= 2 ใบใน DB");

    for (const c of CASES) {
        console.log(`\n=== ${c.name} ===`);
        console.log(`เหตุการณ์จริง: "${c.cardText}"`);

        for (const cand of CANDIDATES) {
            const r = await runOne(makeOpenRouterChat(cand.model), refereeChat, c.prefixText, c.cardText);
            printResult(cand.label, r);
            (allResults[cand.label] ??= []).push(r);
        }
    }

    // ─── สรุปราคา/ความสำเร็จ/ช่องว่าง self vs referee รวมทุกเคส ─────────────
    console.log(`\n\n=== สรุป ===`);
    console.log(
        `${"โมเดล".padEnd(20)} ${"parse OK".padEnd(9)} ${"self hits/K".padEnd(13)} ${"referee hits/K".padEnd(16)} ${"ref conf".padEnd(9)} ${"latency".padEnd(10)} ต้นทุน/การ์ด (บาท ≈ ×36)`
    );
    for (const cand of CANDIDATES) {
        const results = allResults[cand.label] ?? [];
        const okCount = results.filter(r => r.guessParsedOk && r.judgeParsedOk).length;
        const validSelf = results.filter(r => r.selfHits !== null);
        const validRef = results.filter(r => r.refHits !== null);
        const avgSelfHits = validSelf.reduce((s, r) => s + (r.selfHits ?? 0), 0) / (validSelf.length || 1);
        const avgRefHits = validRef.reduce((s, r) => s + (r.refHits ?? 0), 0) / (validRef.length || 1);
        const allConfidences = results.flatMap(r => r.refConfidences);
        const avgRefConf = allConfidences.length > 0 ? allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length : null;
        const avgLatency = results.reduce((s, r) => s + r.guessLatencyMs + r.judgeLatencyMs, 0) / results.length;
        const avgCostUsd = results.reduce((s, r) => s + costPerCard(r.inTokens, r.outTokens, cand.inPerM, cand.outPerM), 0) / results.length;
        const gapFlag = avgSelfHits - avgRefHits >= 1 ? " ⚠ self>>referee" : "";
        const confStr = avgRefConf !== null ? avgRefConf.toFixed(2) : "—";
        console.log(
            `${cand.label.padEnd(20)} ${`${okCount}/${results.length}`.padEnd(9)} ${`${avgSelfHits.toFixed(1)}/${ECHO_K}`.padEnd(13)} ${`${avgRefHits.toFixed(1)}/${ECHO_K}`.padEnd(16)} ${confStr.padEnd(9)} ${`${avgLatency.toFixed(0)}ms`.padEnd(10)} $${avgCostUsd.toFixed(6)} (≈฿${(avgCostUsd * 36).toFixed(4)})${gapFlag}`
        );
    }
    console.log(`\nreferee: ${REFEREE_MODEL} (ต้นทุน referee ไม่รวมในตาราง — เป็นค่าใช้จ่ายของการทดลองนี้เท่านั้น)`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
