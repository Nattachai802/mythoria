import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { notes } from "@/db/schema";
import { eq, isNull, and, lt, or } from "drizzle-orm";

interface Props {
    params: Promise<{ novelId: string }>;
}

// GET: Fetch notes that need plot hole checking
export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const { searchParams } = new URL(request.url);
        const uncheckedOnly = searchParams.get("uncheckedOnly") === "true";

        let query;

        if (uncheckedOnly) {
            // Get notes that haven't been checked or need rechecking
            query = db
                .select({
                    id: notes.id,
                    title: notes.title,
                    content: notes.content,
                    plotHoleCheckedAt: notes.plotHoleCheckedAt,
                    plotHoleCount: notes.plotHoleCount,
                    plotHoleIssues: notes.plotHoleIssues,
                    linkedToChapterId: notes.linkedToChapterId,
                    updatedAt: notes.updatedAt,
                })
                .from(notes)
                .where(
                    and(
                        eq(notes.novelId, novelId),
                        or(
                            isNull(notes.plotHoleCheckedAt),
                            lt(notes.plotHoleCheckedAt, notes.updatedAt) // Recheck if updated after last check
                        )
                    )
                );
        } else {
            query = db
                .select({
                    id: notes.id,
                    title: notes.title,
                    content: notes.content,
                    plotHoleCheckedAt: notes.plotHoleCheckedAt,
                    plotHoleCount: notes.plotHoleCount,
                    plotHoleIssues: notes.plotHoleIssues,
                    linkedToChapterId: notes.linkedToChapterId,
                    updatedAt: notes.updatedAt,
                })
                .from(notes)
                .where(eq(notes.novelId, novelId));
        }

        const result = await query;

        return NextResponse.json({
            success: true,
            notes: result,
        });
    } catch (error) {
        console.error("Error fetching plot hole notes:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch notes" },
            { status: 500 }
        );
    }
}

// POST: Update plot hole status for a note
export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const body = await request.json();
        const { noteId, plotHoleCount, plotHoleIssues } = body;

        if (!noteId) {
            return NextResponse.json(
                { success: false, error: "noteId is required" },
                { status: 400 }
            );
        }

        await db
            .update(notes)
            .set({
                plotHoleCheckedAt: new Date(),
                plotHoleCount: plotHoleCount || 0,
                plotHoleIssues: plotHoleIssues || [],
            })
            .where(and(eq(notes.id, noteId), eq(notes.novelId, novelId)));

        return NextResponse.json({
            success: true,
            message: `Updated plot hole status for note ${noteId}`,
        });
    } catch (error) {
        console.error("Error updating plot hole status:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update plot hole status" },
            { status: 500 }
        );
    }
}
