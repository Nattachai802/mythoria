/**
 * มิติ stylometry ที่ดึงออกจาก noteStylometry (JSONB) + ตัวช่วยแปลงเป็น z-score
 *
 * ย้ายออกมาจาก components/analytics/stylometry-dashboard.tsx เพราะไฟล์นั้นเป็น
 * "use client" ฝั่ง server จึง import ไม่ได้ — รายงานรายตอนต้องคำนวณค่าชุดเดียวกัน
 * ที่ฝั่ง server ถ้าปล่อยให้แต่ละที่เขียนเอง ตัวเลขในสองหน้าจะไม่ตรงกันเมื่อแก้สูตร
 *
 * ไม่มี "use client" / "use server" — เป็นโมดูลบริสุทธิ์ ใช้ได้ทั้งสองฝั่ง
 */

/** รูปร่างขั้นต่ำที่ extract ต้องการ — ตรงกับคอลัมน์ JSONB ของ noteStylometry */
export interface StylometrySource {
    pacingAndMood?: any;
    authorNarrationStyle?: any;
    characterDialogueVibes?: any;
    lexicalRichness?: any;
    chapterAnatomy?: any;
}

export interface StylometryFeature {
    key: string;
    label: string;
    shortLabel: string;
    unit: string;
    color: string;
    extract: (d: StylometrySource) => number | null;
}

/**
 * มิติที่ dashboard แสดงเป็นกราฟ — ลำดับนี้คือลำดับที่ผู้ใช้เห็นมาตลอด อย่าสลับ
 */
export const FEATURES: StylometryFeature[] = [
    {
        key: "mtld",
        label: "ความหลากหลายของคลังคำ (MTLD)",
        shortLabel: "คลังคำ MTLD",
        unit: "",
        color: "#8b5cf6",
        // MTLD ทนต่อความยาวตอน — แม่นกว่า TTR (fallback TTR ถ้าตอนเก่ายังไม่มี mtld)
        extract: (d) => d.lexicalRichness?.mtld ?? d.lexicalRichness?.type_token_ratio_percentage ?? null,
    },
    {
        key: "burstiness",
        label: "จังหวะประโยค (สั้น-ยาวสลับ)",
        shortLabel: "จังหวะ",
        unit: "",
        color: "#f43f5e",
        // -1 = สม่ำเสมอ, +1 = สั้นสลับยาวรุนแรง (action/บรรยายสลับ)
        extract: (d) => d.chapterAnatomy?.sentence_rhythm?.burstiness ?? null,
    },
    {
        key: "punct",
        label: "ความหนาแน่นของเครื่องหมาย",
        shortLabel: "เครื่องหมาย",
        unit: "/1k",
        color: "#0ea5e9",
        extract: (d) => d.pacingAndMood?.total_density_per_1k ?? null,
    },
    {
        key: "sentlen",
        label: "ความยาวประโยคเฉลี่ย",
        shortLabel: "ยาวประโยค",
        unit: "คำ",
        color: "#f59e0b",
        extract: (d) => d.chapterAnatomy?.avg_words_per_sentence ?? null,
    },
    {
        key: "dialogue",
        label: "สัดส่วนบทสนทนา",
        shortLabel: "บทสนทนา",
        unit: "%",
        color: "#10b981",
        extract: (d) => d.chapterAnatomy?.dialogue_ratio_percentage ?? null,
    },
    {
        key: "particle",
        label: "ความหนาแน่นของคำลงท้าย",
        shortLabel: "คำลงท้าย",
        unit: "/1k",
        color: "#ec4899",
        extract: (d) => {
            const total = d.lexicalRichness?.total_words ?? 0;
            const particles = d.characterDialogueVibes?.total_particles ?? 0;
            return total > 0 ? Math.round((particles / total) * 1000 * 10) / 10 : null;
        },
    },
];

/**
 * มิติเพิ่มเติมที่รายงานรายตอนใช้ แต่ dashboard ยังไม่ได้แสดง
 * แยกไว้เพื่อไม่ให้กราฟเดิมมีเส้นโผล่มาเองโดยไม่ตั้งใจ
 */
export const EXTRA_FEATURES: StylometryFeature[] = [
    {
        key: "sensory",
        label: "ความหนาแน่นของประสาทสัมผัส",
        shortLabel: "สัมผัส",
        unit: "/1k",
        color: "#14b8a6",
        extract: (d) => d.chapterAnatomy?.sensory_density?.per_1000 ?? null,
    },
    {
        key: "mattr",
        label: "ความหลากคำแบบหน้าต่างเลื่อน (MATTR)",
        shortLabel: "MATTR",
        unit: "%",
        color: "#a855f7",
        extract: (d) => d.lexicalRichness?.mattr_percentage ?? null,
    },
];

export const REPORT_FEATURES: StylometryFeature[] = [...FEATURES, ...EXTRA_FEATURES];

/**
 * z-score ของทุกจุดเทียบกับค่าเฉลี่ยของ "ทั้งชุดที่ส่งมา"
 *
 * ใช้กับ dashboard ที่ถามว่า "ตอนนี้ต่างจากทั้งเล่มแค่ไหน" — จุดที่กำลังให้คะแนน
 * รวมอยู่ใน baseline ด้วยโดยตั้งใจ
 *
 * ถ้าต้องการถามว่า "ตอนนี้ผิดปกติเทียบกับตอนก่อนหน้าไหม" ให้ใช้ zAgainstBaseline
 * ซึ่งไม่เอาจุดที่กำลังตรวจมาคิดค่าเฉลี่ยของตัวเอง
 */
export function computeZScores<T extends StylometrySource>(data: T[], feat: StylometryFeature) {
    const vals = data.map((d) => feat.extract(d));
    const valid = vals.filter((v): v is number => v !== null);
    if (valid.length < 2) return vals.map(() => ({ z: 0, raw: null as number | null }));
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const std = Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length) || 0.001;
    return vals.map((v) => ({
        z: v !== null ? parseFloat(((v - mean) / std).toFixed(2)) : 0,
        raw: v,
    }));
}

/**
 * z-score ของตอนหนึ่ง เทียบกับ baseline ที่ "ไม่รวมตอนนั้น"
 *
 * ต้องมี baseline อย่างน้อย 3 ตอน — น้อยกว่านั้น stddev แทบไม่มีความหมาย
 * และจะประกาศว่า "ผิดปกติ" จากข้อมูลสองจุดซึ่งไม่ซื่อสัตย์
 */
export const MIN_BASELINE = 3;

export function zAgainstBaseline(
    current: StylometrySource,
    baseline: StylometrySource[],
    feat: StylometryFeature,
): { raw: number | null; z: number | null; mean: number | null } {
    const raw = feat.extract(current);
    const vals = baseline.map((d) => feat.extract(d)).filter((v): v is number => v !== null);
    if (raw === null || vals.length < MIN_BASELINE) return { raw, z: null, mean: null };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 0.001;
    return {
        raw,
        z: parseFloat(((raw - mean) / std).toFixed(2)),
        mean: parseFloat(mean.toFixed(2)),
    };
}

/** เกณฑ์ที่ dashboard ใช้เรียกว่า "ต่างจากเล่มชัดเจน" — ใช้คำเดียวกันทั้งแอป */
export const ANOMALY_Z = 1.96;
export const NOTABLE_Z = 1.0;

/** แปล z-score เป็นภาษานักเขียน — เทียบกับ "ค่าปกติของคุณเอง" ไม่ใช่คะแนน */
export const FEATURE_PLAIN: Record<string, { name: string; high: string; low: string }> = {
    mtld: { name: "คลังคำ", high: "คำศัพท์หลากหลายกว่าปกติ", low: "ใช้คำซ้ำเยอะกว่าปกติ" },
    burstiness: { name: "จังหวะ", high: "สั้น-ยาวสลับแรง (action/ดราม่า)", low: "สม่ำเสมอ ราบเรียบ" },
    punct: { name: "เครื่องหมาย", high: "เยอะ อารมณ์พุ่ง", low: "น้อย โทนสงบ" },
    sentlen: { name: "ความยาวประโยค", high: "ประโยคยาว บรรยายไหล", low: "ประโยคสั้น กระชับเร็ว" },
    dialogue: { name: "บทสนทนา", high: "บทสนทนาเยอะ", low: "เน้นบรรยาย" },
    particle: { name: "คำลงท้าย", high: "เยอะ น้ำเสียงตัวละครชัด", low: "น้อย" },
    sensory: { name: "ประสาทสัมผัส", high: "บรรยายสัมผัสเยอะ เห็นภาพ", low: "สัมผัสน้อย นามธรรมกว่าปกติ" },
    mattr: { name: "ความหลากคำ", high: "หลากหลายกว่าปกติ", low: "ซ้ำกว่าปกติ" },
};
