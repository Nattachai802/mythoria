import { auth } from "@/lib/auth";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";
import { resolvePythonFeature, assertAiAllowed, markFeatureActive, AiControlError } from "@/lib/ai-gateway";

// Same-origin proxy: เบราว์เซอร์ (fetch + EventSource) เรียกผ่าน /api/py/... แทนที่จะยิง Python ตรง
// ที่นี่คือจุดเดียวที่ (1) เช็ค session ผู้ใช้ (2) แนบ internal key ให้ Python
// เบราว์เซอร์ตั้ง custom header กับ EventSource ไม่ได้ แต่ cookie session ไหลมา same-origin เอง
//
// endpoint ที่ผูกกับฟีเจอร์ AI (sync/search/analyze*/check*) ผ่าน AI Gateway gate ก่อนทุกครั้ง
// — flag เปิด/ปิด + guest + quota รายวัน จาก AI_FEATURES registry (lib/ai-gateway.ts)
// ที่เหลือ (spell-check, stylometry, health) คำนวณในเครื่องล้วน ปล่อยผ่านให้ลองเล่นได้
const KEY = process.env.INTERNAL_API_KEY || "";

// ponytail: แค่บังคับว่าต้องล็อกอิน — ยังไม่เช็ค ownership ราย novelId บน path ของ Python
// (endpoint แต่ละตัวพก novelId คนละที่ บ้าง path บ้าง body). ถ้าต้องแน่นกว่านี้ค่อยเพิ่ม per-route check
async function proxy(req: Request, path: string[]): Promise<Response> {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
        return Response.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // ฟีเจอร์ที่เผาโควตา LLM/embedding → ผ่าน gate กลาง (flag/guest/quota)
    const feature = resolvePythonFeature(path[0] ?? "");
    if (feature) {
        try {
            await assertAiAllowed(feature);
        } catch (e) {
            const quota = e instanceof AiControlError && e.reason === "quota";
            const message = e instanceof AiControlError ? e.message : "ไม่ได้รับอนุญาตให้ใช้ AI";
            return Response.json({ detail: message }, { status: quota ? 429 : 403 });
        }
        // best-effort — เห็นแค่ช่วงเรียก request เข้า ไม่ครอบคลุมทั้ง stream (endpoint ที่เป็น SSE)
        await markFeatureActive(feature, session.user.id);
    }

    const search = new URL(req.url).search;
    const target = `${PYTHON_SERVICE_URL}/${path.join("/")}${search}`;

    const headers: Record<string, string> = { "x-internal-key": KEY };
    const contentType = req.headers.get("content-type");
    if (contentType) headers["content-type"] = contentType;

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method: req.method,
            headers,
            body: hasBody ? await req.text() : undefined,
        });
    } catch {
        // Python ไม่ได้รัน / ต่อไม่ติด — ตอบ 503 ให้ client รู้ว่า "บริการไม่พร้อม" ไม่ใช่ 500 ที่แปลว่าโค้ดเราพัง
        return Response.json({ detail: "Python service unavailable" }, { status: 503 });
    }

    // ส่ง body กลับตรง ๆ (รองรับ streaming/SSE) พร้อม status + content-type เดิม
    const respHeaders = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) respHeaders.set("content-type", ct);
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
    return proxy(req, (await ctx.params).path);
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
    return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
    return proxy(req, (await ctx.params).path);
}
