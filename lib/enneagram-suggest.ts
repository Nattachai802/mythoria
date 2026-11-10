// ช่วยหา Enneagram — 6 คำถาม × 9 ตัวเลือก (ตัวเลือกละ type) เขียนเอง · ประเมินเอกเทศจาก MBTI/Big Five
// หลักฐานของ Enneagram อ่อน (Hook et al. 2021: ผลปนกัน, หา 9 กลุ่มไม่เจอ, ปีกแทบไม่มีหลักฐาน)
// → แสดงเป็น "แนวโน้ม" · ไม่คำนวณปีก · ตัดสินเมื่อ type นำชัด (≥3 เสียง และนำที่สองอย่างน้อย 1)
// pure logic, ห้าม import ภายใน (ตัวรันเทสต์/tsc) — ทดสอบที่ lib/enneagram-suggest.check.ts

export type EnnType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export interface EnnQuestion { id: string; prompt: string; options: { type: EnnType; text: string }[] }

// ลำดับตัวเลือกสลับกันทุกข้อ (ไม่เรียงตามเลข) · หน้าจอไม่โชว์เลข type
export const ENN_QUESTIONS: EnnQuestion[] = [
    { id: "EN-1", prompt: "ลึก ๆ แล้ว สิ่งที่ตัวละครกลัวที่สุดคือ...", options: [
        { type: 2, text: "ไม่มีใครรักหรือต้องการ ถ้าไม่ได้ทำอะไรให้ใคร" },
        { type: 3, text: "ไม่มีค่าอะไรเลย ถ้าไม่ประสบความสำเร็จ" },
        { type: 8, text: "ถูกควบคุม หรือถูกทำร้ายจนไม่มีทางสู้" },
        { type: 1, text: "เป็นคนเลว หรือทำผิดจนแก้ไม่ได้" },
        { type: 4, text: "ไม่มีตัวตน ธรรมดาจนไม่มีใครเห็น" },
        { type: 5, text: "ไม่รู้ ไม่เข้าใจ จนรับมือโลกไม่ได้" },
        { type: 9, text: "ความขัดแย้งที่ทำให้ทุกอย่างแตกแยก" },
        { type: 6, text: "ไม่มีใครให้พึ่ง ไม่มีที่ปลอดภัย" },
        { type: 7, text: "ติดอยู่กับความเจ็บปวดหรือความน่าเบื่อ" },
    ] },
    { id: "EN-2", prompt: "สิ่งที่ตัวละครต้องการที่สุดในชีวิตคือ...", options: [
        { type: 1, text: "ได้ทำสิ่งที่ถูกต้อง และทำให้โลกดีขึ้น" },
        { type: 9, text: "ความสงบ ทุกอย่างกลมกลืน ไม่มีใครทะเลาะกัน" },
        { type: 7, text: "อิสระ ได้ลองทุกอย่างที่ชีวิตมีให้" },
        { type: 3, text: "ถูกยอมรับและชื่นชมในสิ่งที่ทำได้" },
        { type: 5, text: "เข้าใจโลกอย่างถ่องแท้" },
        { type: 2, text: "เป็นที่รัก และเป็นคนสำคัญของใครสักคน" },
        { type: 6, text: "มีที่พึ่งที่มั่นคง และคนที่ไว้ใจได้" },
        { type: 4, text: "ได้เป็นตัวของตัวเองจริง ๆ อย่างที่ไม่เหมือนใคร" },
        { type: 8, text: "คุมชะตาของตัวเองได้ ไม่ต้องก้มหัวให้ใคร" },
    ] },
    { id: "EN-3", prompt: "เวลาถูกกดดันหนัก ตัวละครมักจะ...", options: [
        { type: 5, text: "ถอยออกมาอยู่คนเดียว เก็บตัวคิดจนกว่าจะเข้าใจ" },
        { type: 3, text: "ทำงานหนักขึ้น ทำให้ดูเหมือนยังไหวอยู่" },
        { type: 8, text: "เข้าปะทะตรง ๆ ไม่ยอมให้ใครเห็นว่าอ่อนแอ" },
        { type: 1, text: "จับผิด หงุดหงิดกับทุกอย่างที่ไม่เป็นไปตามที่ควร" },
        { type: 9, text: "ทำเป็นไม่มีอะไร หลีกเลี่ยงปัญหาไปเรื่อย ๆ" },
        { type: 4, text: "จมอยู่กับความรู้สึก รู้สึกว่าไม่มีใครเข้าใจ" },
        { type: 7, text: "หาเรื่องสนุกทำ เพื่อไม่ต้องคิดถึงสิ่งที่เจ็บปวด" },
        { type: 6, text: "ระแวง คิดถึงทุกทางที่อาจผิดพลาด และหาคนที่พึ่งได้" },
        { type: 2, text: "ทุ่มเทดูแลคนอื่นจนลืมตัวเอง แล้วน้อยใจที่ไม่มีใครเห็น" },
    ] },
    { id: "EN-4", prompt: "สิ่งที่ตัวละครไม่อยากให้ใครเห็นในตัวเองที่สุดคือ...", options: [
        { type: 2, text: "ความต้องการและความอ่อนแอของตัวเอง เพราะชินแต่เป็นฝ่ายให้" },
        { type: 3, text: "ความล้มเหลว หรือตัวตนจริงที่ไม่ได้เก่งอย่างที่แสดง" },
        { type: 6, text: "ความกลัวที่อยู่ข้างใน" },
        { type: 1, text: "ความโกรธที่กดไว้ เพราะคนดีไม่ควรโกรธ" },
        { type: 8, text: "ความอ่อนโยนและความเปราะบาง" },
        { type: 4, text: "ความว่างเปล่า หรือความรู้สึกว่าขาดอะไรบางอย่างไป" },
        { type: 7, text: "ความเจ็บปวดที่หนีมาตลอด" },
        { type: 5, text: "ความไม่รู้ หรือความไม่พร้อม" },
        { type: 9, text: "ความต้องการของตัวเอง ที่ไม่เคยกล้าพูดออกไป" },
    ] },
    { id: "EN-5", prompt: "เวลามีคนชมตัวละคร ตัวละครมักจะ...", options: [
        { type: 3, text: "รู้สึกดีมาก แต่แอบคิดว่ายังทำได้ดีกว่านี้อีก" },
        { type: 2, text: "ดีใจที่ได้ช่วย แต่ก็อยากรู้ว่าเขารู้สึกอย่างไรกับตัวเองจริง ๆ" },
        { type: 6, text: "สงสัยว่าเขาต้องการอะไรจากตัวเองหรือเปล่า" },
        { type: 9, text: "รับคำชมแบบขัดเขิน แล้วรีบเปลี่ยนเรื่อง" },
        { type: 4, text: "รู้สึกว่าเขาเข้าใจตัวเองจริงไหม หรือแค่ชมผิวเผิน" },
        { type: 1, text: "ชี้จุดที่ยังไม่สมบูรณ์ ก่อนจะยอมรับคำชม" },
        { type: 8, text: "รับไว้เฉย ๆ เพราะรู้ตัวอยู่แล้วว่าเก่ง" },
        { type: 7, text: "ตื่นเต้นแล้วเล่าเรื่องต่อยาวไปถึงไอเดียใหม่" },
        { type: 5, text: "อยากรู้ว่าเขาชมจากอะไร มีเหตุผลรองรับไหม" },
    ] },
    { id: "EN-6", prompt: "ตอนที่ตัวละครอยู่ในจุดที่ดีที่สุดของตัวเอง ตัวละครจะเป็นคน...", options: [
        { type: 1, text: "ใจกว้าง ยอมรับได้ว่าโลกไม่จำเป็นต้องสมบูรณ์แบบ" },
        { type: 8, text: "กล้าหาญ ปกป้องคนที่อ่อนแอกว่าโดยไม่หวังอะไร" },
        { type: 6, text: "มั่นคง เชื่อใจตัวเองได้โดยไม่ต้องพึ่งใคร" },
        { type: 3, text: "จริงใจ เป็นตัวของตัวเองโดยไม่ต้องสร้างภาพ" },
        { type: 7, text: "อยู่กับปัจจุบัน พอใจกับสิ่งที่มีโดยไม่ต้องวิ่งหาของใหม่" },
        { type: 4, text: "สร้างสรรค์ เปลี่ยนความเจ็บปวดเป็นสิ่งที่มีความหมาย" },
        { type: 2, text: "รักโดยไม่หวังสิ่งตอบแทน และดูแลตัวเองได้ด้วย" },
        { type: 5, text: "กล้าลงมือทำทั้งที่ยังรู้ไม่หมด" },
        { type: 9, text: "ยืนหยัดในสิ่งที่ตัวเองต้องการ และทำให้คนรอบข้างรวมใจกันได้" },
    ] },
];

export const ENN_NAMES = ["", "นักปฏิรูป", "ผู้ให้", "ผู้ใฝ่สำเร็จ", "ปัจเจก", "นักสังเกต", "ผู้ภักดี", "นักผจญภัย", "ผู้ท้าทาย", "ผู้สร้างสันติ"];

/** คำตอบ AI ต่อข้อ — choice = เลข type ("1"–"9") · quote ว่าง = อนุมาน · null = ไม่ได้ตอบ */
export interface EnnAiAnswer { id: string; choice: string | null; quote: string }

const norm = (s: string) => s.replace(/[\s"'“”‘’.,!?…\-—]/g, "").toLowerCase();

/** เก็บตัวเลือกเสมอ แต่ quote ต้องมีอยู่จริงในข้อความ (ไม่เจอ = ล้าง → "AI อนุมาน") */
export function verifyEnnAnswers(raw: unknown, sourceText: string): Record<string, EnnAiAnswer> {
    const out: Record<string, EnnAiAnswer> = {};
    const src = norm(sourceText);
    const list = Array.isArray((raw as { answers?: unknown })?.answers) ? (raw as { answers: unknown[] }).answers : [];
    for (const item of list) {
        const it = item as Partial<EnnAiAnswer>;
        const q = ENN_QUESTIONS.find((x) => x.id === it.id);
        if (!q || out[q.id]) continue;
        const choice = typeof it.choice === "string" && /^[1-9]$/.test(it.choice) ? it.choice : null;
        const quote = typeof it.quote === "string" ? it.quote.trim() : "";
        const real = !!choice && norm(quote).length >= 6 && src.includes(norm(quote));
        out[q.id] = { id: q.id, choice, quote: real ? quote : "" };
    }
    for (const q of ENN_QUESTIONS) out[q.id] ??= { id: q.id, choice: null, quote: "" };
    return out;
}

/** นับเสียง — ผลเมื่อ type นำ ≥3 เสียง และนำที่สองอย่างน้อย 1 · ไม่ชัด = top 3 ให้ผู้เขียนเลือก */
export function scoreEnneagram(choices: Record<string, string | null | undefined>) {
    const votes = new Map<number, number>();
    for (const q of ENN_QUESTIONS) {
        const c = choices[q.id];
        if (c) votes.set(Number(c), (votes.get(Number(c)) ?? 0) + 1);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const [first, second] = ranked;
    const type = first && first[1] >= 3 && first[1] > (second?.[1] ?? 0) ? (first[0] as EnnType) : null;
    const answered = [...votes.values()].reduce((a, b) => a + b, 0);
    return { type, votes: Object.fromEntries(ranked), top: ranked.slice(0, 3).map(([t]) => t as EnnType), answered };
}

export const ENN_AI_SCHEMA = {
    type: "object",
    properties: {
        answers: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string", enum: ENN_QUESTIONS.map((q) => q.id) },
                    choice: { type: "string", enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9"] },
                    quote: { type: "string" },
                },
                required: ["id", "choice", "quote"],
                additionalProperties: false,
            },
        },
    },
    required: ["answers"],
    additionalProperties: false,
};

export function buildEnneagramPrompt(name: string, sourceText: string) {
    // ใส่เลข type เป็นรหัสตัวเลือกให้ AI ตอบ (หน้าจอไม่โชว์เลขนี้)
    const qs = ENN_QUESTIONS.map((q) => `${q.id}: ${q.prompt}\n${q.options.map((o) => `  ${o.type}) ${o.text}`).join("\n")}`).join("\n");
    return {
        system: "คุณช่วยนักเขียนวิเคราะห์แรงขับลึกๆ ของตัวละคร โดยยึดเฉพาะสิ่งที่นักเขียนเขียนไว้ ตอบเป็น JSON ตาม schema เท่านั้น",
        prompt: `ด้านล่างคือสิ่งที่นักเขียนเขียนอธิบายตัวละคร "${name}"
ให้ตอบคำถาม 6 ข้อ แต่ละข้อเลือก 1 ตัวเลือก (ตอบด้วยเลขหน้าตัวเลือก)

กฎ:
- ต้องตอบทุกข้อ — ถ้าข้อความไม่พูดถึงตรงๆ ให้อนุมานจากภาพรวม โดยเฉพาะความเชื่อผิดๆ บาดแผลในอดีต คุณค่าที่ยึดถือ เป้าหมาย และความขัดแย้ง
- ดูที่ "เหตุผลเบื้องหลัง" การกระทำ ไม่ใช่การกระทำอย่างเดียว (คนสองคนทำเหมือนกันได้ด้วยความกลัวคนละแบบ)
- quote = วลีจากข้อความที่เกี่ยวกับคำถามนั้นโดยตรง คัดมาตรงตัว ถ้าไม่มีให้ quote = "" — อย่าใช้วลีกว้างๆ วลีเดียวกับหลายข้อ
- ห้ามใช้ความรู้นอกข้อความ (เช่น ถ้าจำได้ว่าเป็นตัวละครจากเรื่องอะไร) — ตอบให้ครบ 6 ข้อ

คำถาม:
${qs}

ข้อความของนักเขียน:
${sourceText}`,
    };
}
