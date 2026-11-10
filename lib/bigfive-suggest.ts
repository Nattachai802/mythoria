// ช่วยหา Big Five — คำถามสถานการณ์ 15 ข้อ (ด้านละ 3) แยกจาก MBTI โดยสิ้นเชิง (คุณสมบัติที่ผู้ใช้ต้องการ:
// แต่ละระบบประเมินเอกเทศ แล้วค่อยตรวจความสอดประสาน — ถ้าใช้คำตอบชุดเดียวกัน ความสอดคล้องจะไร้ความหมาย)
// + กฎความสอดประสาน MBTI ↔ Big Five (McCrae & Costa 1989) · pure logic — ทดสอบที่ lib/bigfive-suggest.check.ts

// ห้าม import ภายใน: ตัวรันเทสต์ต้องใส่นามสกุล .ts แต่ tsc ไม่ยอม — schema จึงประกอบเองที่นี่ (รูปเดียวกับ MBTI)
type Choice = "a" | "b";

export type Trait = "O" | "C" | "E" | "A" | "N";
export type Pole = "high" | "low";
export interface B5Question { id: string; trait: Trait; prompt: string; a: { text: string; pole: Pole }; b: { text: string; pole: Pole } }

// ตำแหน่งขั้วสูง/ต่ำสลับกันโดยตั้งใจ · A กับ N ตั้งใจไม่ให้ขั้วที่สังคมชอบดูดีกว่า · หน้าจอไม่โชว์ขั้ว
export const B5_QUESTIONS: B5Question[] = [
    { id: "O-1", trait: "O", prompt: "ได้ไปเมืองที่ไม่เคยไป",
        a: { text: "เดินหาซอกมุมแปลก ๆ ลองของที่ไม่รู้จัก", pole: "high" },
        b: { text: "ไปที่ที่รู้ว่าดีแน่ ๆ ไม่อยากเสียเวลากับของไม่แน่นอน", pole: "low" } },
    { id: "O-2", trait: "O", prompt: "มีคนเสนอวิธีใหม่ที่ไม่เคยมีใครลอง",
        a: { text: "วิธีเดิมที่พิสูจน์แล้วว่าได้ผลดีกว่า", pole: "low" },
        b: { text: "น่าลองดู ถึงจะเสี่ยงก็ตาม", pole: "high" } },
    { id: "O-3", trait: "O", prompt: "ช่วงเวลาว่าง",
        a: { text: "ชอบคิดเรื่องที่ไม่มีคำตอบ ถามว่าทำไมโลกเป็นแบบนี้", pole: "high" },
        b: { text: "ชอบทำอะไรที่เห็นผลจับต้องได้ มากกว่านั่งคิดเรื่องลอย ๆ", pole: "low" } },
    { id: "C-1", trait: "C", prompt: "ได้รับงานที่มีกำหนดส่ง",
        a: { text: "แบ่งงานเป็นขั้นแล้วทำทีละส่วนตั้งแต่วันแรก", pole: "high" },
        b: { text: "รอให้ใกล้ถึงวันส่ง แล้วค่อยเร่งทำรวดเดียว", pole: "low" } },
    { id: "C-2", trait: "C", prompt: "ห้องหรือที่อยู่ของตัวละคร",
        a: { text: "ของวางกระจัดกระจาย แต่รู้ว่าอะไรอยู่ตรงไหน", pole: "low" },
        b: { text: "ทุกอย่างมีที่ทางของมัน ใช้แล้วเก็บเข้าที่", pole: "high" } },
    { id: "C-3", trait: "C", prompt: "สัญญาว่าจะทำอะไรให้ใครสักคน",
        a: { text: "ทำตามที่พูดเสมอ ถึงจะลำบากก็ตาม", pole: "high" },
        b: { text: "ถ้ามีเรื่องสำคัญกว่าเข้ามา ก็เลื่อนออกไปก่อนได้", pole: "low" } },
    { id: "E-1", trait: "E", prompt: "ในงานเลี้ยงที่มีคนเยอะ",
        a: { text: "ชวนคนคุยไปทั่ว ยิ่งคนเยอะยิ่งสนุก", pole: "high" },
        b: { text: "คุยกับคนสองสามคนที่สนิท หรืออยู่มุมเงียบ ๆ", pole: "low" } },
    { id: "E-2", trait: "E", prompt: "ต้องทำงานกลุ่ม",
        a: { text: "ขอรับส่วนของตัวเองไปทำคนเดียวเงียบ ๆ", pole: "low" },
        b: { text: "ชอบคุยไอเดียกับทุกคน และมักเป็นคนพูดนำ", pole: "high" } },
    { id: "E-3", trait: "E", prompt: "เวลามีเรื่องดีเกิดขึ้น",
        a: { text: "รีบบอกคนรอบตัว อยากให้ทุกคนรู้", pole: "high" },
        b: { text: "เก็บไว้ยิ้มอยู่คนเดียว หรือบอกแค่คนใกล้ชิด", pole: "low" } },
    { id: "A-1", trait: "A", prompt: "มีคนขอความช่วยเหลือในจังหวะที่ตัวละครยุ่งอยู่",
        a: { text: "ปฏิเสธตรง ๆ เพราะเรื่องของตัวเองก็สำคัญ", pole: "low" },
        b: { text: "ยอมช่วย ถึงจะต้องเสียเวลาของตัวเอง", pole: "high" } },
    // A-2/A-3 เดิม (แย้งกลับ / ระวังคนใหม่) วัดความระวังตัวมากกว่าความเห็นใจ — คนดีที่ไม่ไร้เดียงสาก็ตอบขั้วต่ำ
    // ผลทดสอบ: AI ให้ A=1 แทบทุกตัว รวมทนายผู้ยึดความยุติธรรม → เปลี่ยนเป็นคำถามวัดความเห็นใจ/การให้อภัยตรงๆ
    { id: "A-2", trait: "A", prompt: "เห็นคนแปลกหน้ากำลังลำบากหรือถูกรังแก",
        a: { text: "ไม่ใช่เรื่องของตัวเอง เดินผ่านไป", pole: "low" },
        b: { text: "เข้าไปช่วย ถึงจะไม่เกี่ยวกับตัวเองเลย", pole: "high" } },
    { id: "A-3", trait: "A", prompt: "คนที่เคยทำร้ายตัวละครมาขอโทษ",
        a: { text: "ให้อภัยได้ ถ้าเขาสำนึกจริง", pole: "high" },
        b: { text: "ไม่ลืม และไม่ให้โอกาสซ้ำ", pole: "low" } },
    { id: "N-1", trait: "N", prompt: "แผนสำคัญพังในวันสุดท้าย",
        a: { text: "ใจหายวาบ คิดวนทั้งคืนว่าจะเป็นอย่างไรต่อ", pole: "high" },
        b: { text: "หงุดหงิดแป๊บเดียว แล้วหาทางใหม่ต่อ", pole: "low" } },
    { id: "N-2", trait: "N", prompt: "มีคนพูดจาไม่ดีใส่",
        a: { text: "ปล่อยผ่าน ไม่เก็บมาคิดนาน", pole: "low" },
        b: { text: "เก็บไปคิดหลายวัน รู้สึกแย่ซ้ำแล้วซ้ำอีก", pole: "high" } },
    { id: "N-3", trait: "N", prompt: "ก่อนเรื่องใหญ่ที่ไม่รู้ผล",
        a: { text: "กังวลจนนอนไม่หลับ คิดถึงทุกทางที่อาจพลาด", pole: "high" },
        b: { text: "นิ่ง ทำใจได้ว่าจะเกิดอะไรก็ต้องเกิด", pole: "low" } },
];

export const TRAITS: { key: Trait; label: string }[] = [
    { key: "O", label: "เปิดรับประสบการณ์" }, { key: "C", label: "มีระเบียบวินัย" }, { key: "E", label: "เข้าสังคม" },
    { key: "A", label: "ประนีประนอม" }, { key: "N", label: "อารมณ์อ่อนไหว" },
];

/** คะแนน 1–5 ต่อด้าน จากจำนวนข้อที่ไปขั้วสูง: 0→1, 1→2, 2→4, 3→5 · ตอบยังไม่ครบ 3 ข้อ = null (ไม่เขียน) */
export function scoreBigFive(choices: Record<string, Choice | null | undefined>) {
    return TRAITS.map(({ key }) => {
        const qs = B5_QUESTIONS.filter((q) => q.trait === key);
        let high = 0, answered = 0;
        for (const q of qs) {
            const c = choices[q.id];
            if (!c) continue;
            answered++;
            if (q[c].pole === "high") high++;
        }
        const level = answered === 3 ? [1, 2, 4, 5][high] : null;
        return { trait: key, level, high, answered };
    });
}

export const B5_AI_SCHEMA = {
    type: "object",
    properties: {
        answers: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string", enum: B5_QUESTIONS.map((q) => q.id) },
                    choice: { type: "string", enum: ["a", "b"] },
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

export function buildBigFivePrompt(name: string, sourceText: string) {
    const qs = B5_QUESTIONS.map((q) => `${q.id}: ${q.prompt}\n  a) ${q.a.text}\n  b) ${q.b.text}`).join("\n");
    return {
        system: "คุณช่วยนักเขียนวิเคราะห์ตัวละครของเขา โดยยึดเฉพาะสิ่งที่นักเขียนเขียนไว้ ตอบเป็น JSON ตาม schema เท่านั้น",
        prompt: `ด้านล่างคือสิ่งที่นักเขียนเขียนอธิบายตัวละคร "${name}"
ให้ตอบคำถามสถานการณ์ทั้ง 15 ข้อว่าตัวละครนี้จะเลือก a หรือ b

กฎ:
- ต้องเลือก a หรือ b ทุกข้อ ห้ามเว้น — ถ้าข้อความไม่พูดถึงสถานการณ์ตรงๆ ให้อนุมานจากภาพรวมของตัวละคร (นิสัย การกระทำ ปูมหลัง)
- quote = วลีจากข้อความที่เกี่ยวกับหัวข้อของคำถามนั้นโดยตรง คัดมาตรงตัว ถ้าไม่มีให้ quote = "" (ยังต้องเลือก a/b)
  อย่าเอาวลีกว้างๆ วลีเดียวไปใช้กับหลายข้อ
- ห้ามใช้ความรู้นอกข้อความ (เช่น ถ้าจำได้ว่าเป็นตัวละครจากเรื่องอะไร) — ตอบให้ครบ 15 ข้อ
- ไม่มีตัวเลือกไหนดีกว่า — อย่าเลือกฝั่งที่ดูใจดี/สงบ/มีระเบียบ เพียงเพราะข้อความไม่บอก ให้ดูสัญญาณในข้อความ:
  · O สูง: ช่างสงสัย ชอบของใหม่ จินตนาการ อุดมการณ์  · O ต่ำ: ยึดวิธีเดิม ปฏิบัติจริง ไม่สนเรื่องนามธรรม
  · C สูง: วางแผน รับผิดชอบ เป๊ะ ทำตามหน้าที่  · C ต่ำ: ขี้เกียจ ทำตามใจ ผัดวัน แหกกฎ
  · E สูง: พูดเก่ง มีเสน่ห์ ชอบเป็นจุดสนใจ สั่งการคนอื่น  · E ต่ำ: เงียบ อยู่คนเดียว เก็บตัว
  · A สูง: ห่วงคนอื่น เห็นใจ ปกป้องคนอ่อนแอ สู้เพื่อความยุติธรรมของคนอื่น ให้อภัย ช่วยเหลือ (คนเข้มงวด/ดุ/ปากแข็งก็ A สูงได้ถ้าใจห่วงคน)
    · A ต่ำ: เห็นแก่ตัว ใช้คนเป็นเครื่องมือ โหด ดูถูก ทำร้ายคนอื่นโดยไม่รู้สึกผิด
    (ความดื้อ หัวขบถ หรือพูดตรง ไม่ได้แปลว่า A ต่ำ — ดูว่าใจห่วงคนอื่นหรือไม่)
  · N สูง: กังวล ขี้ระแวง อารมณ์ขึ้นลง เก็บมาคิด  · N ต่ำ: นิ่ง มั่นคง ไม่หวั่นไหว

คำถาม:
${qs}

ข้อความของนักเขียน:
${sourceText}`,
    };
}

// ── ความสอดประสาน MBTI ↔ Big Five ──────────────────────────────────────────
// แกน MBTI กับด้าน Big Five ที่สัมพันธ์กัน (McCrae & Costa 1989): E/I~E, S/N~O, T/F~A, J/P~C
// ระดับความแน่น: E/I และ S/N สัมพันธ์สูง · T/F และ J/P ปานกลาง (คนจำนวนมากไม่ตามแนวโน้ม — เตือนเบากว่า)
// Neuroticism ไม่มีคู่ใน MBTI จึงไม่ตรวจ
const PAIRS = [
    { axis: "EI", trait: "E" as Trait, highLetter: "E", lowLetter: "I", strong: true },
    { axis: "SN", trait: "O" as Trait, highLetter: "N", lowLetter: "S", strong: true },
    { axis: "TF", trait: "A" as Trait, highLetter: "F", lowLetter: "T", strong: false },
    { axis: "JP", trait: "C" as Trait, highLetter: "J", lowLetter: "P", strong: false },
] as const;

export interface CoherenceNote { kind: "match" | "conflict"; axis: string; trait: Trait; letter: string; level: number; strong: boolean }

/**
 * เทียบค่าที่ผู้เขียนตั้งไว้จริง (สไลเดอร์ MBTI 0–100 + เรดาร์ Big Five 1–5) — ไม่สนว่าได้มาจาก AI หรือกรอกเอง
 * ข้ามคู่ที่ค่ายังไม่ครบ / MBTI ก้ำกึ่ง (40–60) / Big Five กลาง (3) · ขัดกัน = แสดงเป็นคำถามชวนคิด ไม่ใช่ข้อผิด
 */
export function checkCoherence(mbti: Partial<Record<string, number>>, bigFive: Partial<Record<Trait, number>>): CoherenceNote[] {
    const out: CoherenceNote[] = [];
    for (const p of PAIRS) {
        const s = mbti[p.axis], lv = bigFive[p.trait];
        if (s === undefined || lv === undefined || (s >= 40 && s <= 60) || lv === 3) continue;
        // สไลเดอร์ <50 = ตัวซ้าย (E/S/T/J)
        const letter = s < 50 ? p.axis[0] : p.axis[1];
        const wantsHigh = letter === p.highLetter;
        const isHigh = lv >= 4;
        out.push({ kind: wantsHigh === isHigh ? "match" : "conflict", axis: p.axis, trait: p.trait, letter, level: lv, strong: p.strong });
    }
    return out;
}
