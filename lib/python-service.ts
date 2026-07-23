import "server-only";

// เรียก Python service จากฝั่ง server เท่านั้น — แนบ internal key ให้อัตโนมัติ
// (ห้าม import จาก client component ไม่งั้น key จะหลุดไป bundle ฝั่งเบราว์เซอร์)
export const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
const KEY = process.env.INTERNAL_API_KEY || "";

export async function pyFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${PYTHON_SERVICE_URL}${path}`, {
        ...init,
        headers: { ...(init.headers ?? {}), "x-internal-key": KEY },
    });
}
