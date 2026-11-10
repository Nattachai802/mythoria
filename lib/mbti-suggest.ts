// ช่วยหา MBTI ให้นักเขียนที่ไม่รู้ว่าตัวละครควรเป็น type ไหน
// คำถามสถานการณ์ 12 ข้อ (แกนละ 3) ชุดเดียว — AI ตอบจากข้อความของผู้เขียนพร้อมหลักฐาน ผู้เขียนตอบ/แก้ส่วนที่เหลือ
// แนวทาง: สัมภาษณ์แทนแบบสอบถาม (InCharacter, ACL 2024) · ตัดสิน "ไม่มีข้อมูล" ด้วยกฎในโค้ด ไม่เชื่อความมั่นใจของ AI
// คำถามเขียนเอง (OEJTS เป็น CC BY-NC-SA ใช้เชิงพาณิชย์ไม่ได้) · pure logic — ทดสอบที่ lib/mbti-suggest.check.ts

export type MbtiAxis = "EI" | "SN" | "TF" | "JP";
export type Letter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type Choice = "a" | "b";

export interface MbtiQuestion {
    id: string;
    axis: MbtiAxis;
    prompt: string;
    a: { text: string; letter: Letter };
    b: { text: string; letter: Letter };
}

// ตำแหน่ง ก/ข สลับขั้วกันโดยตั้งใจ — กันกดข้อ ก ตลอดแล้วผลเอียง · หน้าจอไม่โชว์ตัวอักษร
export const MBTI_QUESTIONS: MbtiQuestion[] = [
    { id: "EI-1", axis: "EI", prompt: "หลังผ่านเรื่องหนักมาทั้งวัน",
        a: { text: "อยากมีใครสักคนคุยด้วย เล่าเรื่องที่เกิดขึ้นออกมา", letter: "E" },
        b: { text: "อยากปิดประตูอยู่คนเดียวสักพักก่อน ค่อยคุยกับใคร", letter: "I" } },
    { id: "EI-2", axis: "EI", prompt: "เข้าไปในที่ใหม่ที่ไม่รู้จักใคร",
        a: { text: "สังเกตอยู่ห่าง ๆ จนรู้ว่าใครเป็นใคร แล้วค่อยเข้าไปหา", letter: "I" },
        b: { text: "เดินเข้าไปทักคนแรกที่เจอ แล้วรู้จักไปเรื่อย ๆ", letter: "E" } },
    { id: "EI-3", axis: "EI", prompt: "เวลาคิดเรื่องสำคัญไม่ออก",
        a: { text: "ต้องพูดออกมาให้คนอื่นฟัง ถึงจะเรียบเรียงความคิดได้", letter: "E" },
        b: { text: "ต้องนิ่ง ๆ คิดในหัวให้จบก่อน ถึงจะพูดออกมาได้", letter: "I" } },
    { id: "SN-1", axis: "SN", prompt: "ได้รับคำสั่งงานที่ไม่ชัดเจน",
        a: { text: "ถามจนรู้ขั้นตอนที่แน่นอน ว่าต้องทำอะไร ทีละอย่าง", letter: "S" },
        b: { text: "ขอแค่รู้ว่าเป้าหมายคืออะไร ที่เหลือจะหาทางเอง", letter: "N" } },
    { id: "SN-2", axis: "SN", prompt: "ฟังแผนของคนอื่น",
        a: { text: "มองออกว่าแผนนี้จะพาไปสู่อะไรในอีกหลายก้าวข้างหน้า", letter: "N" },
        b: { text: "เห็นก่อนเลยว่าขั้นไหนทำจริงไม่ได้ ติดตรงไหน", letter: "S" } },
    { id: "SN-3", axis: "SN", prompt: "เวลาเล่าเรื่องที่เพิ่งเกิดขึ้น",
        a: { text: "เล่าตามลำดับว่าเกิดอะไรก่อนหลัง ใครพูดอะไร ตรงไหน", letter: "S" },
        b: { text: "ข้ามไปที่ว่ามันหมายความว่าอะไร และจะนำไปสู่อะไรต่อ", letter: "N" } },
    { id: "TF-1", axis: "TF", prompt: "ต้องบอกข่าวร้ายกับใครสักคน",
        a: { text: "พูดตรงประเด็นให้ชัด เพราะอ้อมไปมาก็ไม่ได้ช่วยอะไร", letter: "T" },
        b: { text: "เลือกจังหวะกับคำพูดที่เขารับได้ ถึงจะใช้เวลานานกว่า", letter: "F" } },
    { id: "TF-2", axis: "TF", prompt: "ต้องเลือกระหว่างแผนที่ได้ผลดีที่สุด กับแผนที่คนในทีมสบายใจ",
        a: { text: "เลือกแผนที่ทุกคนรับได้ ถึงผลจะออกมาไม่ดีเท่า", letter: "F" },
        b: { text: "เลือกแผนที่ได้ผลดีที่สุด แล้วค่อยอธิบายให้ทุกคนเข้าใจ", letter: "T" } },
    { id: "TF-3", axis: "TF", prompt: "มีคนมาระบายเรื่องที่ไม่สบายใจ",
        a: { text: "ฟังจนจบแล้วชี้ว่าปัญหาอยู่ตรงไหน ควรแก้อย่างไร", letter: "T" },
        b: { text: "อยู่ข้าง ๆ รับฟังให้เขารู้สึกดีขึ้นก่อน ยังไม่รีบแนะนำ", letter: "F" } },
    { id: "JP-1", axis: "JP", prompt: "ก่อนออกเดินทางไกล",
        a: { text: "วางแผนเส้นทาง ที่พัก และของที่ต้องใช้ไว้ครบก่อนออก", letter: "J" },
        b: { text: "รู้แค่ว่าจะไปไหน รายละเอียดค่อยว่ากันระหว่างทาง", letter: "P" } },
    { id: "JP-2", axis: "JP", prompt: "แผนที่วางไว้พังกลางคัน",
        a: { text: "ตื่นตัวขึ้นมาด้วยซ้ำ และด้นสดไปตามสถานการณ์ได้สบาย ๆ", letter: "P" },
        b: { text: "หงุดหงิดใจ และต้องรีบวางแผนใหม่ให้เรียบร้อยก่อนเดินต่อ", letter: "J" } },
    { id: "JP-3", axis: "JP", prompt: "ต้องตัดสินใจเรื่องที่ยังมีข้อมูลไม่ครบ",
        a: { text: "ตัดสินใจไปเลยให้จบ ค้างคาไว้แล้วอึดอัด", letter: "J" },
        b: { text: "รอดูไปก่อน เผื่อมีข้อมูลหรือทางเลือกที่ดีกว่าโผล่มา", letter: "P" } },
];

export const AXES: { axis: MbtiAxis; left: Letter; right: Letter }[] = [
    { axis: "EI", left: "E", right: "I" }, { axis: "SN", left: "S", right: "N" },
    { axis: "TF", left: "T", right: "F" }, { axis: "JP", left: "J", right: "P" },
];

/** คำตอบของ AI ต่อข้อ — quote ว่าง = AI อนุมานจากภาพรวม (ไม่มีประโยคยืนยัน) · null = AI ไม่ได้ตอบข้อนี้เลย */
export interface AiAnswer { id: string; choice: Choice | null; quote: string }

const norm = (s: string) => s.replace(/[\s"'“”‘’.,!?…\-—]/g, "").toLowerCase();

/**
 * ตรวจคำตอบ AI: เก็บตัวเลือกไว้เสมอ (ผู้ใช้อยากให้ AI ตอบให้ครบ) แต่ประโยคหลักฐานต้องอยู่ในข้อความจริง
 * (เทียบแบบตัดช่องว่าง/เครื่องหมาย) — ไม่เจอ = ล้าง quote → หน้าจอแสดงเป็น "AI อนุมาน" ไม่มีจุดทอง
 */
export function verifyAnswers(raw: unknown, sourceText: string): Record<string, AiAnswer> {
    const out: Record<string, AiAnswer> = {};
    const src = norm(sourceText);
    const list = Array.isArray((raw as { answers?: unknown })?.answers) ? (raw as { answers: unknown[] }).answers : [];
    for (const item of list) {
        const it = item as Partial<AiAnswer>;
        const q = MBTI_QUESTIONS.find((x) => x.id === it.id);
        if (!q || out[q.id]) continue;
        const quote = typeof it.quote === "string" ? it.quote.trim() : "";
        if (it.choice !== "a" && it.choice !== "b") { out[q.id] = { id: q.id, choice: null, quote: "" }; continue; }
        const real = norm(quote).length >= 6 && src.includes(norm(quote));
        out[q.id] = { id: q.id, choice: it.choice, quote: real ? quote : "" };
    }
    for (const q of MBTI_QUESTIONS) out[q.id] ??= { id: q.id, choice: null, quote: "" };
    return out;
}

/** ผลต่อแกน: ตัวอักษรเมื่อตอบไปทางเดียวกัน ≥2 ใน 3 · ยังไม่พอ = null */
export function scoreAxes(choices: Record<string, Choice | null | undefined>) {
    return AXES.map(({ axis, left, right }) => {
        const qs = MBTI_QUESTIONS.filter((q) => q.axis === axis);
        let l = 0, r = 0;
        for (const q of qs) {
            const c = choices[q.id];
            if (!c) continue;
            if (q[c].letter === left) l++; else r++;
        }
        const letter: Letter | null = l >= 2 ? left : r >= 2 ? right : null;
        return { axis, letter, left: l, right: r, answered: l + r };
    });
}

/** ค่าสไลเดอร์ 0–100 (<50 = ตัวซ้าย) — 3:0 = 15/85, 2:1 = 35/65 · แกนที่ยังไม่ได้ผล ไม่เขียน */
export function toSliders(axes: ReturnType<typeof scoreAxes>): Partial<Record<MbtiAxis, number>> {
    const out: Partial<Record<MbtiAxis, number>> = {};
    for (const a of axes) {
        if (!a.letter) continue;
        const strong = Math.max(a.left, a.right) === 3;
        const isLeft = a.letter === AXES.find((x) => x.axis === a.axis)!.left;
        out[a.axis] = isLeft ? (strong ? 15 : 35) : (strong ? 85 : 65);
    }
    return out;
}

/** schema ให้ AI ตอบ — 12 ข้อ เลือก a/b หรือ null พร้อมประโยคหลักฐาน */
export const MBTI_AI_SCHEMA = {
    type: "object",
    properties: {
        answers: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string", enum: MBTI_QUESTIONS.map((q) => q.id) },
                    choice: { type: "string", enum: ["a", "b"] }, // บังคับเลือก — ผู้ใช้ไม่อยากให้เว้นว่าง
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

export function buildMbtiPrompt(name: string, sourceText: string) {
    const qs = MBTI_QUESTIONS.map((q) => `${q.id}: ${q.prompt}\n  a) ${q.a.text}\n  b) ${q.b.text}`).join("\n");
    return {
        system: "คุณช่วยนักเขียนวิเคราะห์ตัวละครของเขา โดยยึดเฉพาะสิ่งที่นักเขียนเขียนไว้ ตอบเป็น JSON ตาม schema เท่านั้น",
        prompt: `ด้านล่างคือสิ่งที่นักเขียนเขียนอธิบายตัวละคร "${name}"
ให้ตอบคำถามสถานการณ์ทั้ง 12 ข้อว่าตัวละครนี้จะเลือก a หรือ b

กฎ:
- ต้องเลือก a หรือ b ทุกข้อ ห้ามเว้น — ข้อความแทบไม่มีทางพูดถึงสถานการณ์ในคำถามตรงๆ ให้อนุมานจากภาพรวมของตัวละคร
  (นิสัย การกระทำ ปูมหลัง) ว่าคนแบบนี้น่าจะเลือกทางไหนมากกว่า
- quote = วลีจากข้อความที่เกี่ยวกับหัวข้อของคำถามนั้นโดยตรง คัดมาตรงตัว
  ถ้าไม่มีวลีที่เกี่ยวโดยตรง ให้ quote = "" (ยังต้องเลือก a/b) — อย่าเอาวลีกว้างๆ วลีเดียวไปใช้กับหลายข้อ
- ห้ามใช้ความรู้นอกข้อความ (เช่น ถ้าจำได้ว่าเป็นตัวละครจากเรื่องอะไร) — ตอบให้ครบ 12 ข้อ
- ไม่มีตัวเลือกไหนเป็น "ค่าเริ่มต้น" หรือดีกว่า — ระวังอย่าเลือกฝั่งที่ดูสุขุม/มีเหตุผล/วางแผน เพียงเพราะข้อความไม่บอก
  ให้ดูสัญญาณในข้อความแล้วเลือกฝั่งที่สัญญาณชี้:
  · E: พูดเก่ง มีเสน่ห์ เป็นที่นิยม ชอบเป็นจุดสนใจ สั่งการ/คุมคนอื่น พาคนอื่นไปทำเรื่องต่างๆ  · I: เงียบ อยู่คนเดียว ไม่ข้องเกี่ยวกับใคร เก็บความรู้สึก
  · S: ทำตามวิธีที่ใช้ได้จริง สนใจรายละเอียด/ของตรงหน้า ปฏิบัติจริง  · N: มองภาพใหญ่ วางเกม คิดไกล ฝัน อุดมการณ์ ชอบความเป็นไปได้ใหม่
  · T: ตัดสินด้วยผลลัพธ์/ตรรกะ พูดตรงจนทำร้ายคนอื่น เย็นชา  · F: ตัดสินด้วยคุณค่า/ความรู้สึก ห่วงคน อุดมคติทางศีลธรรม ทำตามใจ
  · J: วางแผน ระเบียบ เข้มงวด ปิดเรื่องให้จบ ทำตามหน้าที่  · P: ด้นสด ขี้เกียจ แหกกฎ หัวขบถ ทำตามอารมณ์ ไม่ชอบถูกผูกมัด

คำถาม:
${qs}

ข้อความของนักเขียน:
${sourceText}`,
    };
}
