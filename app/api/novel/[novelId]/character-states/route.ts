import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { characterStates } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface Props {
    params: Promise<{ novelId: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const { searchParams } = new URL(request.url);
        const characterId = searchParams.get("characterId");
        const noteId = searchParams.get("noteId");

        let query = db
            .select()
            .from(characterStates)
            .where(eq(characterStates.novelId, novelId));

        // Filter by characterId if provided
        if (characterId) {
            query = db
                .select()
                .from(characterStates)
                .where(
                    and(
                        eq(characterStates.novelId, novelId),
                        eq(characterStates.characterId, characterId)
                    )
                );
        }

        const states = await query;

        // Filter by noteId if provided (after query)
        let filteredStates = states;
        if (noteId) {
            filteredStates = states.filter(s => s.noteId === noteId);
        }

        return NextResponse.json({
            success: true,
            states: filteredStates,
        });
    } catch (error) {
        console.error("Error fetching character states:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch character states" },
            { status: 500 }
        );
    }
}
