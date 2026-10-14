import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { db } from "@/db/drizzle";
import { notes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { pyFetch } from "@/lib/python-service";
import { getSpellEntities } from "@/lib/spell-entities";

type Props = {
    params: Promise<{ novelId: string; noteId: string }>;
};


// POST — trigger background spell check (server-side) สำหรับ note นี้
export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId, noteId } = await params;
        const denied = await guardNovel(novelId); if (denied) return denied;
        // setStatus: true = ตรวจเสร็จแล้วตั้ง "รอตรวจสอบ" (รอพิสูจน์อักษร) · false = คงสถานะเดิม (รอ Rewrite / ตรวจทั้งคิว)
        const body = await request.json().catch(() => ({}));
        const setStatus = body?.setStatus !== false;

        // 1. ดึง note content + custom words จาก DB
        const [note] = await db.select().from(notes).where(and(eq(notes.id, noteId), isNull(notes.deletedAt)));
        if (!note) {
            return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
        }

        const content: any = note.content;
        const text: string =
            typeof content === "string" ? content : content?.text ?? "";

        if (!text.trim()) {
            return NextResponse.json({ success: false, error: "Note ว่างเปล่า" }, { status: 400 });
        }

        const entities = await getSpellEntities(novelId);

        // 2. ใส่คิวตรวจของ Python — ตอบทันที (แค่เข้าคิว) จึง await ได้
        // เดิมยิงแบบไม่รอ ซึ่งบน serverless ฟังก์ชันอาจจบก่อนคำขอออกไปถึง Python
        const res = await pyFetch(`/spell-check-note`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteId, novelId, text, entities, setStatus }),
        });
        if (!res.ok) {
            return NextResponse.json({ success: false, error: "Spell check service unavailable" }, { status: 503 });
        }
        return NextResponse.json({ success: true, triggered: true, ...(await res.json()) });
    } catch (error) {
        console.error("Error triggering spell check:", error);
        return NextResponse.json({ success: false, error: "Failed to trigger spell check" }, { status: 500 });
    }
}
