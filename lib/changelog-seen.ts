/**
 * จำว่าผู้ใช้อ่านบันทึกอัปเดตถึงเวอร์ชันไหนแล้ว
 *
 * เก็บใน localStorage ไม่ใช่ DB — เป็นความสะดวกส่วนตัวของเบราว์เซอร์เครื่องนั้น
 * ไม่ใช่ข้อมูลที่ต้องอยู่ถาวรหรือแชร์ข้ามเครื่อง ล้างทิ้งแล้วอย่างมากก็เห็นจุดแดงอีกรอบ
 *
 * ห้าม import อะไรเข้ามา (ดูเหตุผลใน lib/changelog.ts)
 */
const KEY = "mythoria:changelog-seen";

/** เวอร์ชันล่าสุดที่เคยอ่าน — null = ยังไม่เคยเปิดเลย หรืออ่านค่าไม่ได้ */
export function readSeenVersion(): string | null {
    try {
        return localStorage.getItem(KEY);
    } catch {
        // โหมดส่วนตัว / บล็อก site data — ถือว่ายังไม่เคยอ่าน ไม่ใช่เรื่องคอขาดบาดตาย
        return null;
    }
}

export function markSeen(version: string): void {
    try {
        localStorage.setItem(KEY, version);
    } catch {
        /* เขียนไม่ได้ก็ปล่อย — แค่จุดแดงจะขึ้นอีกรอบหน้า */
    }
}
