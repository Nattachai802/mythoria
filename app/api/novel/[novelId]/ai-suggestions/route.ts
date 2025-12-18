import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { aiSuggestions, characterRelationships, characterLifeEvents, relationshipHistory } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

type Props = {
    params: Promise<{ novelId: string }>;
};

// GET - ดึง AI suggestions ที่รอ review
export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || "pending";
        const characterId = searchParams.get("characterId");
        const suggestionType = searchParams.get("type");

        // Check if table exists (handle pre-migration state)
        try {
            let whereConditions = [
                eq(aiSuggestions.novelId, novelId),
                eq(aiSuggestions.status, status),
            ];

            if (suggestionType) {
                whereConditions.push(eq(aiSuggestions.suggestionType, suggestionType));
            }

            let suggestions = await db.query.aiSuggestions.findMany({
                where: and(...whereConditions),
                with: {
                    character: {
                        columns: { id: true, name: true, image: true },
                    },
                    sourceChapter: {
                        columns: { id: true, title: true, orderIndex: true },
                    },
                },
                orderBy: [desc(aiSuggestions.createdAt)],
            });

            // Filter by characterId if provided - check all character-related fields
            if (characterId) {
                suggestions = suggestions.filter(s => {
                    const data = s.suggestedData as Record<string, unknown> | null;
                    return (
                        s.characterId === characterId ||
                        (data && data.source_character_id === characterId) ||
                        (data && data.target_character_id === characterId) ||
                        (data && data.character_id === characterId)
                    );
                });
            }

            return NextResponse.json({
                success: true,
                suggestions,
                count: suggestions.length,
            });
        } catch (dbError: unknown) {
            // If table doesn't exist, return empty array
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
            if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
                console.log("AI suggestions table not yet created. Run migration first.");
                return NextResponse.json({
                    success: true,
                    suggestions: [],
                    count: 0,
                    message: "Migration needed: Run 'npx drizzle-kit generate' and 'npx drizzle-kit migrate'"
                });
            }
            throw dbError;
        }
    } catch (error) {
        console.error("Error fetching AI suggestions:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch suggestions" },
            { status: 500 }
        );
    }
}

// POST - บันทึก AI suggestions ใหม่
export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const body = await request.json();
        const { suggestions } = body;

        if (!suggestions || !Array.isArray(suggestions)) {
            return NextResponse.json(
                { success: false, error: "suggestions array is required" },
                { status: 400 }
            );
        }

        const inserted = [];

        for (const suggestion of suggestions) {
            const [record] = await db
                .insert(aiSuggestions)
                .values({
                    novelId,
                    characterId: suggestion.characterId || suggestion.character_id,
                    suggestionType: suggestion.suggestionType || suggestion.type,
                    targetTable: suggestion.targetTable || guessTargetTable(suggestion.suggestionType || suggestion.type),
                    suggestedData: suggestion.data || suggestion,
                    confidence: suggestion.confidence,
                    reasoning: suggestion.reason || suggestion.reasoning,
                    sourceChapterId: suggestion.chapterId || suggestion.chapter_id,
                    sourceExcerpt: suggestion.excerpt,
                    status: "pending",
                })
                .returning();

            inserted.push(record);
        }

        return NextResponse.json({
            success: true,
            insertedCount: inserted.length,
        });
    } catch (error) {
        console.error("Error saving AI suggestions:", error);
        return NextResponse.json(
            { success: false, error: "Failed to save suggestions" },
            { status: 500 }
        );
    }
}

// PATCH - Accept/Reject/Modify suggestion
export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const body = await request.json();
        const { suggestionId, action, modifiedData } = body;

        if (!suggestionId || !action) {
            return NextResponse.json(
                { success: false, error: "suggestionId and action are required" },
                { status: 400 }
            );
        }

        // Get the suggestion
        const suggestion = await db.query.aiSuggestions.findFirst({
            where: and(
                eq(aiSuggestions.id, suggestionId),
                eq(aiSuggestions.novelId, novelId)
            ),
        });

        if (!suggestion) {
            return NextResponse.json(
                { success: false, error: "Suggestion not found" },
                { status: 404 }
            );
        }

        if (action === "reject") {
            // Mark as rejected
            await db
                .update(aiSuggestions)
                .set({
                    status: "rejected",
                    reviewedAt: new Date(),
                })
                .where(eq(aiSuggestions.id, suggestionId));

            return NextResponse.json({ success: true, action: "rejected" });
        }

        if (action === "accept" || action === "modify") {
            // Apply the suggestion to actual tables
            const dataToApply = modifiedData || suggestion.suggestedData;

            const applyResult = await applySuggestion(
                suggestion.suggestionType,
                suggestion.targetTable,
                dataToApply as Record<string, unknown>,
                novelId
            );

            // Update suggestion status
            await db
                .update(aiSuggestions)
                .set({
                    status: action === "modify" ? "modified" : "accepted",
                    userModifiedData: modifiedData || null,
                    reviewedAt: new Date(),
                })
                .where(eq(aiSuggestions.id, suggestionId));

            return NextResponse.json({
                success: true,
                action,
                appliedRecord: applyResult,
            });
        }

        return NextResponse.json(
            { success: false, error: "Invalid action" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Error processing suggestion:", error);
        return NextResponse.json(
            { success: false, error: "Failed to process suggestion" },
            { status: 500 }
        );
    }
}

// Helper: Guess target table from suggestion type
function guessTargetTable(type: string): string {
    switch (type) {
        case "opinion_level":
        case "relationship":
            return "character_relationships";
        case "life_event":
            return "character_life_events";
        case "relationship_history":
            return "relationship_history";
        case "faction_change":
            return "character_factions";
        default:
            return "unknown";
    }
}

// Helper: Apply suggestion to actual database table
async function applySuggestion(
    suggestionType: string,
    targetTable: string,
    data: Record<string, unknown>,
    novelId: string
): Promise<unknown> {
    switch (suggestionType) {
        case "opinion_level": {
            // Update existing relationship or create new
            const sourceId = data.source_character_id as string;
            const targetId = data.target_character_id as string;
            const opinionLevel = data.opinion_level as number;
            const sentiment = data.sentiment as string;

            // Check if relationship exists
            const existing = await db.query.characterRelationships.findFirst({
                where: and(
                    eq(characterRelationships.novelId, novelId),
                    eq(characterRelationships.sourceCharacterId, sourceId),
                    eq(characterRelationships.targetCharacterId, targetId)
                ),
            });

            if (existing) {
                // Update and create history
                const [updated] = await db
                    .update(characterRelationships)
                    .set({ opinionLevel, sentiment })
                    .where(eq(characterRelationships.id, existing.id))
                    .returning();

                // Add history entry
                await db.insert(relationshipHistory).values({
                    relationshipId: existing.id,
                    novelId,
                    chapterId: data.chapter_id as string || null,
                    opinionLevel,
                    sentiment,
                    reason: data.reason as string,
                });

                return updated;
            } else {
                // Create new relationship
                const [created] = await db
                    .insert(characterRelationships)
                    .values({
                        novelId,
                        sourceCharacterId: sourceId,
                        targetCharacterId: targetId,
                        type: "unknown",
                        opinionLevel,
                        sentiment,
                    })
                    .returning();

                return created;
            }
        }

        case "life_event": {
            const [created] = await db
                .insert(characterLifeEvents)
                .values({
                    novelId,
                    characterId: data.character_id as string,
                    chapterId: data.chapter_id as string || null,
                    title: data.title as string,
                    description: data.description as string,
                    eventType: data.event_type as string,
                    impact: data.impact as string,
                    importance: data.importance as number,
                    changedTraits: data.changed_traits as string[] || null,
                })
                .returning();

            return created;
        }

        default:
            throw new Error(`Unknown suggestion type: ${suggestionType}`);
    }
}
