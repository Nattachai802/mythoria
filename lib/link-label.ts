/**
 * จุดวางป้ายชื่อเส้นเชื่อมบนกระดานพล็อต
 *
 * เคยใช้ "กลางช่วงที่ยาวที่สุด" ซึ่งไม่นิ่ง: ความสูงการ์ดขึ้นกับเนื้อหา เพิ่มโน้ตใบไหนก็ได้
 * แล้วความยาวช่วงเปลี่ยน พอสองช่วงยาวใกล้กัน ต่างกัน 1px ป้ายกระโดดไปอีกฝั่งของเส้นทันที
 * ทั้งที่ไม่มีใครแตะเส้นนั้น
 *
 * ถอยจากหัวลูกศรแทน — ปลายทางไม่เปลี่ยนช่วง ป้ายจึงขยับต่อเนื่อง ไม่กระโดด
 * และอยู่ใกล้หัวศรซึ่งเป็นจุดที่สายตาไปหาอยู่แล้วว่าเส้นนี้ชี้ไปไหน
 *
 * pure + sync → ดู lib/link-label.test.ts
 */

export type Pt = { x: number; y: number };

/** ระยะที่ถอยจากหัวลูกศรมาวางป้าย */
export const LABEL_BACKOFF = 34;

export function labelAnchor(points: Pt[], backoff = LABEL_BACKOFF): Pt {
    if (!points.length) return { x: 0, y: 0 };
    let remain = backoff;
    for (let i = points.length - 1; i > 0; i--) {
        const b = points[i], a = points[i - 1];
        // เส้นเป็นมุมฉากล้วน ระยะ manhattan จึงเท่ากับความยาวจริงของช่วง
        const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
        if (len >= remain) {
            const t = remain / (len || 1);
            return { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t };
        }
        remain -= len;
    }
    // เส้นสั้นกว่า backoff ทั้งเส้น → ไปสุดที่จุดเริ่ม
    return points[0];
}
