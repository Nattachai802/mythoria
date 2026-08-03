import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * เซ็น state ของ Google OAuth ด้วย HMAC
 *
 * เดิม state เป็น base64 ของ { userId } เปล่าๆ ใครก็ปลอมได้ — หลอกให้เหยื่อเปิดลิงก์ callback
 * ที่แนบ state ของตัวเอง แล้ว Drive ของผู้โจมตีจะไปผูกกับบัญชีเหยื่อ (หรือกลับกัน)
 * ตอนนี้ callback จะรับเฉพาะ state ที่เซิร์ฟเวอร์เราเซ็นเองและยังไม่หมดอายุ
 */
const MAX_AGE_MS = 10 * 60 * 1000; // ผู้ใช้กด consent ไม่น่าเกิน 10 นาที

function sign(body: string, secret: string): string {
    return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signState(payload: Record<string, unknown>, secret = process.env.BETTER_AUTH_SECRET ?? ""): string {
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
    return `${body}.${sign(body, secret)}`;
}

/** คืน payload ถ้า signature ถูกและยังไม่หมดอายุ, คืน null ถ้าไม่ผ่าน */
export function verifyState<T extends Record<string, unknown>>(
    raw: string,
    secret = process.env.BETTER_AUTH_SECRET ?? "",
    now = Date.now(),
): T | null {
    const [body, mac] = raw.split(".");
    if (!body || !mac) return null;

    const expected = sign(body, secret);
    // ต้องยาวเท่ากันก่อน ไม่งั้น timingSafeEqual โยน error แทนที่จะคืน false
    if (mac.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (typeof payload?.iat !== "number" || now - payload.iat > MAX_AGE_MS) return null;
        return payload as T;
    } catch {
        return null;
    }
}
