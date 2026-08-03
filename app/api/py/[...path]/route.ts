import { auth } from "@/lib/auth";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";
import { isGuest, GUEST_AI_MESSAGE } from "@/lib/guest";

// Same-origin proxy: เบราว์เซอร์ (fetch + EventSource) เรียกผ่าน /api/py/... แทนที่จะยิง Python ตรง
// ที่นี่คือจุดเดียวที่ (1) เช็ค session ผู้ใช้ (2) แนบ internal key ให้ Python
// เบราว์เซอร์ตั้ง custom header กับ EventSource ไม่ได้ แต่ cookie session ไหลมา same-origin เอง
const KEY = process.env.INTERNAL_API_KEY || "";

/** segment แรกของ path ที่เรียก LLM/embedding — ดู @app.post ใน pythonservice/main.py */
const GUEST_BLOCKED = [
    "sync", "search", "analyze-plot", "analyze-characters",
    "analyze-characters-stream", "analyze-queue",
    "check-all-notes", "check-all-notes-stream",
];

// ponytail: แค่บังคับว่าต้องล็อกอิน — ยังไม่เช็ค ownership ราย novelId บน path ของ Python
// (endpoint แต่ละตัวพก novelId คนละที่ บ้าง path บ้าง body). ถ้าต้องแน่นกว่านี้ค่อยเพิ่ม per-route check
async function proxy(req: Request, path: string[]): Promise<Response> {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
        return Response.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // ผู้เยี่ยมชมใช้ endpoint ที่เผาโควตา LLM/embedding ไม่ได้
    // ที่เหลือ (spell-check, stylometry, timeline/character checker) คำนวณในเครื่องล้วน ปล่อยผ่านให้ลองเล่นได้
    if (GUEST_BLOCKED.some((p) => path[0] === p) && (await isGuest())) {
        return Response.json({ detail: GUEST_AI_MESSAGE }, { status: 403 });
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
