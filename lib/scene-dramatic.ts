/**
 * Unified Scene Framework (Swain + McKee + Syd Field) — config ที่ใช้ร่วมกันระหว่าง
 * SceneDramaticPanel (ระดับฉาก, TimelineEvent) และ IdeaDramaticPanel (ระดับการ์ดไอเดีย/ฉากย่อย
 * ภายใน playground) — pure data, ไม่มี React ไม่มี side effect
 */

export const SCENE_TYPES = {
    setup: {
        label: "ปูพื้น/ให้ข้อมูล",
        field1Label: "Hook — จุดดึงดูด", field1Placeholder: "อะไรดึงคนอ่านเข้าฉากนี้",
        field2Label: "Context — บริบท/สถานะเดิม", field2Placeholder: "กฎ/สถานะปัจจุบันที่ต้องรู้ก่อนฉากนี้",
        outcomeMode: "off" as const,
    },
    action: {
        label: "รุกฆาต/เผชิญอุปสรรค",
        field1Label: "เป้าหมาย (Goal)", field1Placeholder: "ตัวละครต้องการอะไรในฉากนี้",
        field2Label: "อุปสรรค (Conflict)", field2Placeholder: "อะไรขวางไม่ให้สำเร็จ",
        outcomeMode: "optional" as const,
    },
    reaction: {
        label: "รับแรงกระแทก/เตรียมการ",
        field1Label: "ปฏิกิริยา (Reaction)", field1Placeholder: "ตัวละครรู้สึก/ตอบสนองอย่างไร",
        field2Label: "ทางตัน+การตัดสินใจ (Dilemma)", field2Placeholder: "ทางเลือกใหม่ที่ต้องชั่งใจ นำไปสู่อะไร",
        outcomeMode: "optional" as const,
    },
    climax: {
        label: "แตกหัก/พลิกผัน",
        field1Label: "บททดสอบสูงสุด (Ultimate Test)", field1Placeholder: "อุปสรรค/ความกลัวที่ใหญ่ที่สุด",
        field2Label: "คุณค่าที่พลิกผัน (Value Turn)", field2Placeholder: "สถานะเปลี่ยนจากอะไรเป็นอะไร",
        outcomeMode: "required" as const,
    },
    resolution: {
        label: "คลี่คลาย/สรุปผล",
        field1Label: "ผลลัพธ์หลังพายุ (Aftermath)", field1Placeholder: "ใครอยู่ ใครตาย ใครได้อะไร",
        field2Label: "สมดุลใหม่ (New Normal)", field2Placeholder: "โลก/ตัวละครเปลี่ยนไปจากตอนต้นอย่างไร",
        outcomeMode: "optional" as const,
    },
} as const;

export type SceneType = keyof typeof SCENE_TYPES;

// outcome → ทิศของ value-shift
export const OUTCOMES = [
    { value: "success", label: "ดีขึ้น", sign: 1, cls: "text-emerald-500" },
    { value: "failure", label: "แย่ลง", sign: -1, cls: "text-red-500" },
    { value: "ongoing", label: "คาราคาซัง", sign: 0, cls: "text-amber-500" },
    { value: "unknown", label: "ยังไม่ชัด", sign: 0, cls: "text-muted-foreground" },
] as const;

// ความเข้ม → magnitude
export const INTENSITIES = [
    { label: "เบา", mag: 2 },
    { label: "กลาง", mag: 3 },
    { label: "หนัก", mag: 5 },
] as const;

// จังหวะการเล่า (pacing) — คนละมิติจาก outcome/valueShift (ทิศสถานการณ์) นี่คือความเร็ว/ความเด่นของการเล่า
export const PACING_MIN = 1;
export const PACING_MAX = 10;

export function pacingLabel(n: number | null | undefined): string {
    if (n == null) return "ยังไม่ตั้ง";
    if (n <= 3) return "ผ่อน — เล่าเร็ว/สรุป";
    if (n <= 7) return "คงที่";
    return "เร่ง — ลงรายละเอียดเต็มที่";
}

export function computeShift(outcome: string, mag: number): number {
    const o = OUTCOMES.find(o => o.value === outcome);
    if (!o) return 0;
    return o.sign * mag;
}

// แปลง valueShift กลับเป็น outcome+mag เพื่อ pre-fill (เดาจากเครื่องหมาย)
export function decodeShift(shift: number | null | undefined, storedOutcome: string | null | undefined): { outcome: string; mag: number } {
    const outcome = storedOutcome || (shift == null ? "unknown" : shift > 0 ? "success" : shift < 0 ? "failure" : "ongoing");
    const mag = shift == null ? 3 : Math.min(5, Math.max(2, Math.abs(shift) || 3));
    return { outcome, mag };
}
