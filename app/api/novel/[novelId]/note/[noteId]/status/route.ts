import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";

type Props = {
    params: Promise<{ novelId: string; noteId: string }>;
};

// PATCH — set note status (ใช้โดย Python background worker หลัง spell check เสร็จ)
export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { noteId } = await params;
        const { status } = await request.json();

        if (!status) {
            return NextResponse.json({ success: false, error: "Missing status" }, { status: 400 });
        }

        const [updated] = await db
            .update(notes)
            .set({ status, updatedAt: new Date() })
            .where(eq(notes.id, noteId))
            .returning();

        return NextResponse.json({ success: true, note: updated });
    } catch (error) {
        console.error("Error updating note status:", error);
        return NextResponse.json({ success: false, error: "Failed to update status" }, { status: 500 });
    }
}
