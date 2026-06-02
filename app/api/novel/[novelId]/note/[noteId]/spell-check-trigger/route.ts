import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { notes, characters, locations } from "@/db/schema";
import { eq } from "drizzle-orm";

type Props = {
    params: Promise<{ novelId: string; noteId: string }>;
};

const PYTHON_SERVICE_URL =
    process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || "http://localhost:8000";

// POST — trigger background spell check (server-side) สำหรับ note นี้
export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId, noteId } = await params;

        // 1. ดึง note content + custom words จาก DB
        const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
        if (!note) {
            return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
        }

        const content: any = note.content;
        const text: string =
            typeof content === "string" ? content : content?.text ?? "";

        if (!text.trim()) {
            return NextResponse.json({ success: false, error: "Note ว่างเปล่า" }, { status: 400 });
        }

        const [novelCharacters, novelLocations] = await Promise.all([
            db.select().from(characters).where(eq(characters.novelId, novelId)),
            db.select().from(locations).where(eq(locations.novelId, novelId)),
        ]);

        const customWords: string[] = [
            ...novelCharacters.flatMap((c: any) => [
                c.name,
                ...(((c.aliases as string[] | null) ?? [])),
            ]),
            ...novelLocations.map((l: any) => l.name),
        ].filter(Boolean);

        // 2. ยิงไป Python — ไม่รอผล (Python ใช้ BackgroundTasks return ทันที)
        fetch(`${PYTHON_SERVICE_URL}/spell-check-note`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteId, novelId, text, customWords }),
        }).catch((e) => console.error("[SpellCheckTrigger] Python call failed:", e));

        return NextResponse.json({ success: true, triggered: true });
    } catch (error) {
        console.error("Error triggering spell check:", error);
        return NextResponse.json({ success: false, error: "Failed to trigger spell check" }, { status: 500 });
    }
}
