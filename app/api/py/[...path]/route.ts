import { auth } from "@/lib/auth";
import { PYTHON_SERVICE_URL } from "@/lib/python-service";

// Same-origin proxy: เบราว์เซอร์ (fetch + EventSource) เรียกผ่าน /api/py/... แทนที่จะยิง Python ตรง
// ที่นี่คือจุดเดียวที่ (1) เช็ค session ผู้ใช้ (2) แนบ internal key ให้ Python
// เบราว์เซอร์ตั้ง custom header กับ EventSource ไม่ได้ แต่ cookie session ไหลมา same-origin เอง
const KEY = process.env.INTERNAL_API_KEY || "";

// ponytail: แค่บังคับว่าต้องล็อกอิน — ยังไม่เช็ค ownership ราย novelId บน path ของ Python
// (endpoint แต่ละตัวพก novelId คนละที่ บ้าง path บ้าง body). ถ้าต้องแน่นกว่านี้ค่อยเพิ่ม per-route check
async function proxy(req: Request, path: string[]): Promise<Response> {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
        return Response.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const search = new URL(req.url).search;
    const target = `${PYTHON_SERVICE_URL}/${path.join("/")}${search}`;

    const headers: Record<string, string> = { "x-internal-key": KEY };
    const contentType = req.headers.get("content-type");
    if (contentType) headers["content-type"] = contentType;

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: hasBody ? await req.text() : undefined,
    });

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
