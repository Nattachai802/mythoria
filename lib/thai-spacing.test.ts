// Run: npx tsx lib/thai-spacing.test.ts
//
// เดิม self-check อยู่ท้าย lib/thai-spacing.ts ใน `if (require.main === module)` ซึ่งพังบนเบราว์เซอร์:
// thai-spacing-button.tsx เป็น client component และ import ไฟล์นี้ Turbopack จึงรวมทั้งไฟล์
// ลง bundle ฝั่ง client ที่ไม่มีตัวแปร `module` → ReferenceError ตอนโหลดหน้า
// แยกออกมาเป็นไฟล์ทดสอบตามที่ lib/mentions.test.ts กับ lib/simultaneous-beats.test.ts ทำอยู่แล้ว
import { checkSpacing } from "./thai-spacing";

function eq(got: number, want: number, label: string) {
    if (got !== want) throw new Error(`FAIL ${label}: got ${got}, want ${want}`);
    console.log("✓ " + label);
}

eq(checkSpacing("วันๆ").length, 1, "ๆ ติดคำ → ต้อง flag");            // expected SMALL, actual NONE
eq(checkSpacing("วัน ๆ").length, 0, "ๆ เว้นถูก → ไม่ flag");
eq(checkSpacing("เลี้ยงสุนัข๓๐ตัว").length, 2, "ไทย↔เลขติดกัน → flag 2 จุด");
eq(checkSpacing("ข้าวเหนือSmilaxในวงศ์X").length, 3, "ไทย↔อังกฤษติดกัน 3 ขอบ");
eq(checkSpacing('เขาพูดว่า “สวัสดี”').length, 0, "อัญประกาศเว้นถูก");
eq(checkSpacing("กรุงเทพฯ-เชียงใหม่").length, 0, "ฯ ก่อนยัติภังค์ → NONE");

console.log("\nOK: thai-spacing self-check passed");
