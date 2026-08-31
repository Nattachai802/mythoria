/**
 * เทียบ Gemini 2.5 Flash vs 5 candidate จาก OpenRouter สำหรับงาน Echo Score โดยเฉพาะ
 * -----------------------------------------------------------------------
 * เป้าหมาย: หาโมเดลที่ราคาถูกกว่าโดยผลลัพธ์ (JSON ใช้ได้, guesses อ่านรู้เรื่อง, judge สมเหตุผล)
 * ไม่เปลี่ยนไปมาก — ยังไม่ตัดสินใจเลื่อนใครขึ้นเป็นตัวหลักใน lib/ai-features.ts
 *
 * v2: prompt แบบใหม่ที่แยก system/user + บังคับ JSON schema ที่ API แทนขอด้วยคำพูดอย่างเดียว
 *
 * เรียก provider ตรง ๆ ไม่ผ่าน lib/ai-gateway.ts เพราะไฟล์นั้น import "server-only"
 * (บล็อกไม่ให้รันนอก Next.js) — สคริปต์นี้จึงยิง SDK/HTTP เองแบบย่อ ซ้ำ logic
 * ของ chatGemini/chatOpenAiCompatible เล็กน้อย ยอมรับได้เพราะเป็นสคริปต์ทดสอบครั้งเดียว
 * ไม่ใช่โค้ด production — ห้ามเอา pattern นี้ไปใช้ในแอปจริง
 *
 *   npx tsx scripts/compare-echo-models.ts
 */
import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
    ECHO_K,
    ECHO_MODEL,
    ECHO_GUESS_SCHEMA,
    ECHO_JUDGE_SCHEMA,
    buildGuessPrompt,
    buildJudgePrompt,
    parseGuessResponse,
    parseJudgeResponse,
    type EchoPrompt,
} from "../lib/echo-score.ts";

config({ path: ".env" });

// ─── Candidates — slug + ราคาที่เช็คจาก openrouter.ai ตอนเสนอ (ยืนยันวันนี้ อาจเปลี่ยนได้ไว) ──
const CANDIDATES = [
    { label: "Qwen3.5-Flash", model: "qwen/qwen3.5-flash-02-23", inPerM: 0.065, outPerM: 0.26 },
    { label: "Mistral Small 3.2", model: "mistralai/mistral-small-3.2-24b-instruct", inPerM: 0.075, outPerM: 0.20 },
    { label: "DeepSeek V3.2", model: "deepseek/deepseek-v3.2", inPerM: 0.21, outPerM: 0.31 },
    { label: "GLM-4.5-Air", model: "z-ai/glm-4.5-air", inPerM: 0.13, outPerM: 0.85 },
    { label: "MiniMax M2", model: "minimax/minimax-m2", inPerM: 0.255, outPerM: 1.02 },
];
const GEMINI_PRICE = { inPerM: 0.30, outPerM: 2.50 };

// ─── ตัวอย่างทดสอบ — จำลองจากจังหวะนิยายจริง ไม่ต้องต่อ DB ───────────────
const CASES = [
    {
        name: "prefix สั้น (2 การ์ด)",
        prefixText: [
            "[C01] อัศวินเข้าเฝ้า — คุกเข่าต่อหน้ากษัตริย์ ขอพระราชทานกองทัพไปปราบศัตรูชายแดน (อัศวิน, กษัตริย์)",
            "[C02] กษัตริย์ลังเล — เล่าว่าเคยเสียทหารไปกับสงครามครั้งก่อนมามาก ไม่อยากเสี่ยงอีก (กษัตริย์)",
        ].join("\n"),
        cardText: "อัศวินสาบานต่อหน้าทุกคนว่าจะเอาชีวิตเป็นประกัน กษัตริย์จึงยอมอนุมัติกองทัพให้",
    },
    {
        name: "prefix ยาว (6 การ์ด)",
        prefixText: [
            "[C01] อัศวินเข้าเฝ้า — คุกเข่าต่อหน้ากษัตริย์ ขอพระราชทานกองทัพไปปราบศัตรูชายแดน (อัศวิน, กษัตริย์)",
            "[C02] กษัตริย์ลังเล — เล่าว่าเคยเสียทหารไปกับสงครามครั้งก่อนมามาก ไม่อยากเสี่ยงอีก (กษัตริย์)",
            "[C03] อัศวินสาบาน — เอาชีวิตเป็นประกัน กษัตริย์จึงยอมอนุมัติกองทัพ (อัศวิน, กษัตริย์)",
            "[C04] ออกเดินทาง — กองทัพเคลื่อนพลออกจากเมืองหลวงมุ่งหน้าชายแดน (อัศวิน)",
            "[C05] พบผู้ลี้ภัย — ชาวบ้านเล่าว่าศัตรูมีจำนวนมากกว่าที่คาด (อัศวิน)",
            "[C06] ตั้งค่ายพัก — อัศวินสั่งลาดตระเวนรอบค่ายก่อนพลบค่ำ (อัศวิน)",
        ].join("\n"),
        cardText: "กลางดึกมีเสียงระฆังเตือนภัยดังขึ้น ศัตรูบุกโจมตีค่ายก่อนกำหนด",
    },
];

interface ProviderResult {
    guesses: string[];
    guessLatencyMs: number;
    guessParsedOk: boolean;
    hits: number | null;
    matched: number[];
    judgeLatencyMs: number;
    judgeParsedOk: boolean;
    inTokens: number;
    outTokens: number;
    error?: string;
}

type Chat = (p: EchoPrompt, temperature: number, maxTokens: number, schema: object) => Promise<{ text: string; inTokens: number; outTokens: number }>;

async function chatGeminiRaw(p: EchoPrompt, temperature: number, maxTokens: number, schema: object) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
        model: ECHO_MODEL,
        contents: [{ role: "user", parts: [{ text: p.user }] }],
        config: {
            temperature, maxOutputTokens: maxTokens,
            thinkingConfig: { thinkingBudget: 0 },
            systemInstruction: p.system,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
        },
    });
    const u = res.usageMetadata;
    return { text: res.text?.trim() ?? "", inTokens: u?.promptTokenCount ?? 0, outTokens: u?.candidatesTokenCount ?? 0 };
}

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

async function runOne(chat: Chat, prefixText: string, cardText: string): Promise<ProviderResult> {
    const result: ProviderResult = {
        guesses: [], guessLatencyMs: 0, guessParsedOk: false,
        hits: null, matched: [], judgeLatencyMs: 0, judgeParsedOk: false,
        inTokens: 0, outTokens: 0,
    };
    try {
        const guessPrompt = buildGuessPrompt(prefixText, ECHO_K);
        const t0 = Date.now();
        const g = await chat(guessPrompt, 1.0, 512, ECHO_GUESS_SCHEMA);
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
        const t1 = Date.now();
        const j = await chat(judgePrompt, 0.0, 128, ECHO_JUDGE_SCHEMA);
        result.judgeLatencyMs = Date.now() - t1;
        result.inTokens += j.inTokens;
        result.outTokens += j.outTokens;
        const judged = parseJudgeResponse(j.text);
        result.judgeParsedOk = judged !== null;
        if (judged) {
            result.hits = judged.hits;
            result.matched = judged.matched;
        } else {
            result.error = `judge parse failed — raw: ${j.text.slice(0, 1500)}`;
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
    console.log(`  judge: ${r.judgeParsedOk ? "OK" : "PARSE FAIL"} (${r.judgeLatencyMs}ms) → hits=${r.hits} matched=[${r.matched.join(",")}]`);
    console.log(`  tokens: in=${r.inTokens} out=${r.outTokens}`);
}

function costPerCard(inTokens: number, outTokens: number, inPerM: number, outPerM: number): number {
    return (inTokens / 1_000_000) * inPerM + (outTokens / 1_000_000) * outPerM;
}

async function main() {
    const allResults: Record<string, ProviderResult[]> = {};
    const contenders = [
        { label: `Gemini (${ECHO_MODEL})`, chat: chatGeminiRaw, price: GEMINI_PRICE },
        ...CANDIDATES.map(c => ({ label: c.label, chat: makeOpenRouterChat(c.model), price: c })),
    ];

    for (const c of CASES) {
        console.log(`\n=== ${c.name} ===`);
        console.log(`เหตุการณ์จริง: "${c.cardText}"`);

        for (const cand of contenders) {
            const r = await runOne(cand.chat, c.prefixText, c.cardText);
            printResult(cand.label, r);
            (allResults[cand.label] ??= []).push(r);
        }
    }

    // ─── สรุปราคา/ความสำเร็จรวมทุกเคส ───────────────────────────────────
    console.log(`\n\n=== สรุป ===`);
    console.log(`${"โมเดล".padEnd(22)} ${"parse OK".padEnd(10)} ${"latency เฉลี่ย".padEnd(16)} ต้นทุน/การ์ด (บาท ≈ ×36)`);
    for (const cand of contenders) {
        const results = allResults[cand.label] ?? [];
        const okCount = results.filter(r => r.guessParsedOk && r.judgeParsedOk).length;
        const avgLatency = results.reduce((s, r) => s + r.guessLatencyMs + r.judgeLatencyMs, 0) / results.length;
        const avgCostUsd = results.reduce((s, r) => s + costPerCard(r.inTokens, r.outTokens, cand.price.inPerM, cand.price.outPerM), 0) / results.length;
        console.log(
            `${cand.label.padEnd(22)} ${`${okCount}/${results.length}`.padEnd(10)} ${`${avgLatency.toFixed(0)}ms`.padEnd(16)} $${avgCostUsd.toFixed(6)} (≈฿${(avgCostUsd * 36).toFixed(4)})`
        );
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
