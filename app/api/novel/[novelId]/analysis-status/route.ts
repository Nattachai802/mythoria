import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { characterAnalysisQueue, chapters } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

type Props = {
    params: Promise<{ novelId: string }>;
};

// GET - ดึงสถานะการวิเคราะห์ (chapters ไหนวิเคราะห์แล้ว และสถานะคิวงาน)
export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;

        // Get all chapters for the novel
        const allChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            columns: { id: true, title: true, orderIndex: true },
            orderBy: (chapters, { asc }) => [asc(chapters.orderIndex)],
        });

        // Map status of each chapter from queue table
        const queueMap = new Map<string, { status: string; error: string | null }>();
        const queueCount = { pending: 0, processing: 0, completed: 0, failed: 0 };

        try {
            const queueRecords = await db.query.characterAnalysisQueue.findMany({
                where: eq(characterAnalysisQueue.novelId, novelId),
                columns: { chapterId: true, status: true, error: true },
            });

            queueRecords.forEach((r) => {
                if (r.chapterId) {
                    queueMap.set(r.chapterId, {
                        status: r.status,
                        error: r.error,
                    });
                    
                    const statusKey = r.status as keyof typeof queueCount;
                    if (statusKey in queueCount) {
                        queueCount[statusKey]++;
                    }
                }
            });
        } catch (dbError: unknown) {
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
            if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
                console.log("Character analysis queue table not yet created. Run migration first.");
            } else {
                throw dbError;
            }
        }

        const chaptersWithStatus = allChapters.map((c) => {
            const queueItem = queueMap.get(c.id);
            return {
                ...c,
                isAnalyzed: queueItem?.status === "completed",
                status: queueItem?.status || "none", // pending, processing, completed, failed, none
                error: queueItem?.error || null,
            };
        });

        const completedCount = queueCount.completed;

        return NextResponse.json({
            success: true,
            totalChapters: allChapters.length,
            analyzedCount: completedCount,
            unanalyzedCount: allChapters.length - completedCount,
            queue: queueCount,
            chapters: chaptersWithStatus,
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

        if (chapterIds.length > 0) {
            // Fetch all existing records in one query
            const existingRecords = await db
                .select()
                .from(characterAnalysisQueue)
                .where(
                    and(
                        eq(characterAnalysisQueue.novelId, novelId),
                        inArray(characterAnalysisQueue.chapterId, chapterIds)
                    )
                );

            const existingMap = new Map<string, typeof existingRecords[number]>();
            existingRecords.forEach(r => {
                if (r.chapterId) {
                    existingMap.set(r.chapterId, r);
                }
            });

            // Prepare updates for existing records
            const updates = existingRecords.map(r =>
                db
                    .update(characterAnalysisQueue)
                    .set({
                        status: "completed",
                        processedAt: new Date(),
                    })
                    .where(eq(characterAnalysisQueue.id, r.id))
            );

            // Prepare inserts for missing records
            const insertIds = chapterIds.filter(id => !existingMap.has(id));
            const inserts = insertIds.length > 0 ? [
                db.insert(characterAnalysisQueue).values(
                    insertIds.map(chapterId => ({
                        novelId,
                        chapterId,
                        analysisType: "all",
                        status: "completed",
                        processedAt: new Date(),
                    }))
                )
            ] : [];

            // Execute all operations concurrently
            if (updates.length > 0 || inserts.length > 0) {
                await Promise.all([...updates, ...inserts]);
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

// PATCH - อัปเดตสถานะคิวงานของแต่ละ Chapter (ใช้สำหรับ Python Background Worker)
export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const body = await request.json();
        const { chapterId, status, error } = body;

        if (!chapterId || !status) {
            return NextResponse.json(
                { success: false, error: "chapterId and status are required" },
                { status: 400 }
            );
        }

        const updateData: any = {
            status,
            error: error || null,
        };

        if (status === "completed") {
            updateData.processedAt = new Date();
        }

        await db
            .update(characterAnalysisQueue)
            .set(updateData)
            .where(
                and(
                    eq(characterAnalysisQueue.novelId, novelId),
                    eq(characterAnalysisQueue.chapterId, chapterId)
                )
            );

        return NextResponse.json({
            success: true,
            message: `Queue status updated to ${status}`,
        });
    } catch (error) {
        console.error("Error updating queue status:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update queue status" },
            { status: 500 }
        );
    }
}

