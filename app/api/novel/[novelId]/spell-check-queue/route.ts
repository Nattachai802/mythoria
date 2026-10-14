import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { db } from "@/db/drizzle";
import { notes } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { pyFetch } from "@/lib/python-service";
import { getSpellEntities } from "@/lib/spell-entities";

type Props = { params: Promise<{ novelId: string }> };

// POST — ใส่หลายตอนเข้าคิวตรวจคำผิดของ Python ในครั้งเดียว ("ตรวจทั้งคิว")
// body: { noteIds: string[] } · ตอนสถานะ "รอพิสูจน์อักษร" ตรวจเสร็จแล้วเปลี่ยนเป็น "รอตรวจสอบ" ตอนอื่นคงสถานะ
// Python ทำทีละตอนเอง ผู้ใช้ปิดหน้า/logout ได้ งานยังเดินต่อ
export async function POST(request: NextRequest, { params }: Props) {
    const { novelId } = await params;
    const denied = await guardNovel(novelId); if (denied) return denied;
    try {
        const { noteIds } = await request.json() as { noteIds?: string[] };
        if (!noteIds?.length) return NextResponse.json({ success: true, queued: 0, skipped: 0 });

        const [rows, entities] = await Promise.all([
            db.select({ id: notes.id, status: notes.status, content: notes.content })
                .from(notes)
                .where(and(eq(notes.novelId, novelId), inArray(notes.id, noteIds), isNull(notes.deletedAt))),
            getSpellEntities(novelId),
        ]);

        let queued = 0, skipped = 0;
        for (const n of rows) {
            const c = n.content as { text?: string } | string | null;
            const text = typeof c === "string" ? c : c?.text ?? "";
            if (!text.trim()) { skipped++; continue; }
            const res = await pyFetch(`/spell-check-note`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ noteId: n.id, novelId, text, entities, setStatus: n.status === "proofreading" }),
            });
            if (res.ok) queued++; else skipped++;
        }
        return NextResponse.json({ success: true, queued, skipped: skipped + (noteIds.length - rows.length) });
    } catch (error) {
        console.error("Error queueing spell checks:", error);
        return NextResponse.json({ success: false, error: "Failed to queue spell checks" }, { status: 500 });
    }
}
