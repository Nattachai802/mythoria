import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { characterAnalysisQueue, chapters } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type Props = {
    params: Promise<{ novelId: string }>;
};

// GET - ดึงสถานะการวิเคราะห์ (chapters ไหนวิเคราะห์แล้ว)
export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;

        // Get all chapters for the novel
        const allChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            columns: { id: true, title: true, orderIndex: true },
            orderBy: (chapters, { asc }) => [asc(chapters.orderIndex)],
        });

        // Try to get analyzed chapters - handle if table doesn't exist yet
        let analyzedChapterIds = new Set<string>();

        try {
            const analyzedRecords = await db.query.characterAnalysisQueue.findMany({
                where: and(
                    eq(characterAnalysisQueue.novelId, novelId),
                    eq(characterAnalysisQueue.status, "completed")
                ),
                columns: { chapterId: true },
            });

            analyzedChapterIds = new Set(
                analyzedRecords
                    .map(r => r.chapterId)
                    .filter((id): id is string => id !== null)
            );
        } catch (dbError: unknown) {
            // If table doesn't exist, treat as no chapters analyzed yet
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
            if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
                console.log("Character analysis queue table not yet created. Run migration first.");
            } else {
                throw dbError;
            }
        }

        return NextResponse.json({
            success: true,
            totalChapters: allChapters.length,
            analyzedCount: analyzedChapterIds.size,
            unanalyzedCount: allChapters.length - analyzedChapterIds.size,
            analyzedChapterIds: Array.from(analyzedChapterIds),
            chapters: allChapters.map(c => ({
                ...c,
                isAnalyzed: analyzedChapterIds.has(c.id),
            })),
        });
    } catch (error) {
        console.error("Error fetching analysis status:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch analysis status" },
            { status: 500 }
        );
    }
}

// POST - Mark chapters as analyzed
export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const body = await request.json();
        const { chapterIds } = body;

        if (!chapterIds || !Array.isArray(chapterIds)) {
            return NextResponse.json(
                { success: false, error: "chapterIds array is required" },
                { status: 400 }
            );
        }

        // Insert or update analysis records
        for (const chapterId of chapterIds) {
            // Check if record exists
            const existing = await db.query.characterAnalysisQueue.findFirst({
                where: and(
                    eq(characterAnalysisQueue.novelId, novelId),
                    eq(characterAnalysisQueue.chapterId, chapterId)
                ),
            });

            if (existing) {
                // Update existing
                await db
                    .update(characterAnalysisQueue)
                    .set({
                        status: "completed",
                        processedAt: new Date(),
                    })
                    .where(eq(characterAnalysisQueue.id, existing.id));
            } else {
                // Insert new
                await db.insert(characterAnalysisQueue).values({
                    novelId,
                    chapterId,
                    analysisType: "all",
                    status: "completed",
                    processedAt: new Date(),
                });
            }
        }

        return NextResponse.json({
            success: true,
            markedCount: chapterIds.length,
        });
    } catch (error) {
        console.error("Error marking chapters as analyzed:", error);
        return NextResponse.json(
            { success: false, error: "Failed to mark chapters" },
            { status: 500 }
        );
    }
}
