/**
 * เทียบ Format ข้อความไทยที่ป้อนให้โมเดล เพื่อหา format ที่กิน token น้อยที่สุด — objective 1
 * -----------------------------------------------------------------------------------
 * ยึดเนื้อหาความหมายเดียวกันทุก format (ชุดเดียวกับ "prefix ยาว" ใน compare-echo-models.ts)
 * เปลี่ยนแค่การจัด format แล้ววัด prompt_tokens จริงที่ API รายงานกลับมา — นับตาม tokenizer
 * จริงของโมเดลนั้น ไม่ใช้ตัวนับมั่ว ๆ เพราะแต่ละผู้ให้บริการ tokenize ภาษาไทยต่างกันมาก
 * ไม่มี "จำนวน token ที่ถูกต้องสากล" ข้ามโมเดล
 *
 * ยิงคำขอสั้นที่สุดเท่าที่จะได้ (max_tokens=1) เพราะสนใจแค่ prompt_tokens ไม่สนใจคำตอบจริง
 *
 * ⚠ ผลลัพธ์ที่นี่บอกแค่ "ประหยัด token" อย่างเดียว — format ที่ตัดคำเชื่อม/เว้นวรรคออกอาจทำให้
 * โมเดลเข้าใจเนื้อหาแย่ลง (โดยเฉพาะภาษาไทยที่ไม่มีตัวคั่นคำ ตัดวรรคอาจทำให้ token รวมคำผิด)
 * format ที่ชนะตารางนี้ต้องเอาไปวัดคุณภาพซ้ำผ่าน compare-echo-models.ts ก่อนตัดสินใจใช้จริง
 * ไม่ใช่ตัดสินจากตัวเลข token อย่างเดียว
 *
 *   npx tsx scripts/compare-thai-formats.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import { getRealBeatSets } from "./real-echo-samples";

const MODEL = "google/gemini-2.5-flash"; // เปลี่ยนได้ถ้าอยากเทียบ tokenizer ของโมเดลอื่น

type Beat = { code: string; title: string; content: string; who: string[] };

// ─── Format candidates — ทุกฟังก์ชันรับ BEATS ชุดเดียวกัน คืน string เดียวยัดเป็น user content ──
const FORMATS: Record<string, (beats: Beat[]) => string> = {
    "1. ปัจจุบัน (bracket + dash)": (beats) =>
        beats.map(b => `[${b.code}] ${b.title} — ${b.content} (${b.who.join(", ")})`).join("\n"),

    "2. ตัด glue chars (ไม่มีวงเล็บ/ขีด)": (beats) =>
        beats.map(b => `${b.code} ${b.title} ${b.content} ${b.who.join(" ")}`).join("\n"),

    "3. ไม่เว้นวรรคในคำไทย": (beats) =>
        beats.map(b => `${b.code}:${b.title.replace(/ /g, "")}—${b.content.replace(/ /g, "")}(${b.who.join(",")})`).join("\n"),

    "4. delimiter-only (คั่นด้วย |)": (beats) =>
        beats.map(b => `${b.code}|${b.title}|${b.content}|${b.who.join(",")}`).join("\n"),

    "5. key ย่อแบบ YAML": (beats) =>
        beats.map(b => `- c:${b.code} t:${b.title} d:${b.content} w:${b.who.join(",")}`).join("\n"),
};

async function countTokens(userContent: string): Promise<number> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY not set");
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: userContent }],
            max_tokens: 1,
        }),
    });
    if (!res.ok) throw new Error(`${MODEL} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return data.usage?.prompt_tokens ?? 0;
}

async function main() {
    console.log(`โมเดลที่ใช้นับ token: ${MODEL}\n`);

    const beatSets = await getRealBeatSets(3);
    if (beatSets.length === 0) throw new Error("ไม่พบฉากจริงที่มี beat >= 2 ใบใน DB");

    for (const set of beatSets) {
        console.log(`\n########## ${set.name} (${set.beats.length} การ์ด) ##########`);
        const results: { name: string; text: string; tokens: number }[] = [];

        for (const [name, fmt] of Object.entries(FORMATS)) {
            const text = fmt(set.beats);
            const tokens = await countTokens(text);
            results.push({ name, text, tokens });
            console.log(`── ${name} ──`);
            console.log(text);
            console.log(`→ ${tokens} tokens (${text.length} chars, ${(tokens / text.length).toFixed(2)} token/char)\n`);
        }

        const baseline = results[0].tokens;
        console.log(`=== สรุป ${set.name} (baseline = ${results[0].name}) ===`);
        for (const r of results) {
            const diff = r.tokens - baseline;
            const pct = baseline > 0 ? (diff / baseline) * 100 : 0;
            const diffStr = diff === 0 ? "" : `${diff > 0 ? "+" : ""}${diff} (${pct.toFixed(1)}%)`;
            console.log(`${r.name.padEnd(35)} ${String(r.tokens).padStart(5)} tokens  ${diffStr}`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
