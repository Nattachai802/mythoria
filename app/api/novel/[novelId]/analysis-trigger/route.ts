import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { characterAnalysisQueue, chapters } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

type Props = {
    params: Promise<{ novelId: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const body = await request.json().catch(() => ({}));
        const { characterId, analysisType = "all", reanalyzeAll = false } = body;

        // 1. ดึง Chapters ทั้งหมดของนิยายนี้
        const novelChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            columns: { id: true },
        });

        if (novelChapters.length === 0) {
            return NextResponse.json(
                { success: false, error: "ไม่พบ Chapters ในนิยายเรื่องนี้" },
                { status: 400 }
            );
        }

        const chapterIds = novelChapters.map((c) => c.id);

        // 2. ดึงคิวงานที่มีอยู่แล้ว
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
        existingRecords.forEach((r) => {
            if (r.chapterId) {
                existingMap.set(r.chapterId, r);
            }
        });

        const updates = [];
        const inserts = [];

        for (const chapterId of chapterIds) {
            const existing = existingMap.get(chapterId);

            if (existing) {
                // หากเลือกวิเคราะห์ใหม่ทั้งหมด (reanalyzeAll) หรือสถานะเก่าไม่ใช่ completed
                if (reanalyzeAll || existing.status !== "completed") {
                    updates.push(
                        db
                            .update(characterAnalysisQueue)
                            .set({
                                status: "pending",
                                error: null,
                                processedAt: null,
                                analysisType: analysisType,
                                characterId: characterId || null,
                            })
                            .where(eq(characterAnalysisQueue.id, existing.id))
                    );
                }
            } else {
                // หากยังไม่มีในคิว ให้ insert แถวใหม่
                inserts.push({
                    novelId,
                    chapterId,
                    characterId: characterId || null,
                    analysisType,
                    status: "pending",
                });
            }
        }

        // ดำเนินการอัปเดตและบันทึกคิวในฐานข้อมูล
        const dbOperations = [];
        if (updates.length > 0) {
            dbOperations.push(...updates);
        }
        if (inserts.length > 0) {
            dbOperations.push(db.insert(characterAnalysisQueue).values(inserts));
        }

        if (dbOperations.length > 0) {
            await Promise.all(dbOperations);
        }

        // 3. ทริกเกอร์ไปที่ Python Service (FastAPI) แบบเบื้องหลัง
        try {
            console.log(`[Queue Trigger] Requesting Python Worker for novel ${novelId}...`);
            const triggerRes = await fetch(`${PYTHON_SERVICE_URL}/analyze-queue/${novelId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ characterId, analysisType }),
            });

            if (!triggerRes.ok) {
                console.error("[Queue Trigger] Python Service response error:", await triggerRes.text());
            } else {
                console.log("[Queue Trigger] Successfully triggered Python Worker.");
            }
        } catch (fetchError) {
            // Log ข้อผิดพลาดแต่ไม่ทำตัว API ล้มเหลว เนื่องจากคิวถูกบันทึกสำเร็จใน DB แล้ว
            console.error("[Queue Trigger] Failed to connect to Python Service:", fetchError);
        }

        return NextResponse.json({
            success: true,
            message: "เพิ่มงานในคิวและเริ่มต้นการวิเคราะห์ในเบื้องหลังแล้ว",
        }, { status: 202 });

    } catch (error) {
        console.error("Error triggering analysis queue:", error);
        return NextResponse.json(
            { success: false, error: "เกิดข้อผิดพลาดในการเริ่มวิเคราะห์เบื้องหลัง" },
            { status: 500 }
        );
    }
}
