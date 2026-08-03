import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { db } from "@/db/drizzle";
import { characters, notes, chapters, locations } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

interface Props {
    params: Promise<{ novelId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const denied = await guardNovel(novelId); if (denied) return denied;

        // Fetch all content types
        const [novelCharacters, novelNotes, novelChapters, novelLocations] = await Promise.all([
            db.select().from(characters).where(eq(characters.novelId, novelId)),
            db.select().from(notes).where(and(eq(notes.novelId, novelId), isNull(notes.deletedAt))),
            db.select().from(chapters).where(and(eq(chapters.novelId, novelId), isNull(chapters.deletedAt))),
            db.select().from(locations).where(eq(locations.novelId, novelId)),
        ]);

        return NextResponse.json({
            success: true,
            characters: novelCharacters,
            notes: novelNotes,
            chapters: novelChapters,
            locations: novelLocations,
        });
    } catch (error) {
        console.error("Error fetching content:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch content" },
            { status: 500 }
        );
    }
}
