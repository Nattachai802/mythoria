import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { characters, notes, chapters, locations } from "@/db/schema";
import { eq } from "drizzle-orm";

interface Props {
    params: Promise<{ novelId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;

        // Fetch all content types
        const [novelCharacters, novelNotes, novelChapters, novelLocations] = await Promise.all([
            db.select().from(characters).where(eq(characters.novelId, novelId)),
            db.select().from(notes).where(eq(notes.novelId, novelId)),
            db.select().from(chapters).where(eq(chapters.novelId, novelId)),
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
