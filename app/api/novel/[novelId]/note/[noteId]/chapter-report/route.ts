import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { db } from "@/db/drizzle";
import { chapters, notes, noteStylometry, plotThreads, plotThreadBeats, timelineEvents } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getReadingOrder } from "@/server/reading-order";
import {
    ANOMALY_Z,
    MIN_BASELINE,
    NOTABLE_Z,
    REPORT_FEATURES,
    zAgainstBaseline,
    type StylometrySource,
} from "@/lib/stylometry-features";
import { analyzeThread, makeEventChapterOrder } from "@/lib/plot-thread-analysis";

/**
 * รายงานตรวจสุขภาพรายตอน — ไม่เรียก LLM เลย
 *
 * ตอบคำถามเดียว: "ตอนนี้ผิดปกติไหม เทียบกับตอนก่อนหน้าของเรื่องเดียวกัน"
 * ตัวเลขทั้งหมดมาจาก noteStylometry ที่มีอยู่แล้ว + ปมค้างจาก plotThreads
 *
 * ตั้งใจไม่อ่าน fingerprintAnalysis: route ที่เขียนคอลัมน์นั้น
 * (../stylometry/route.ts) ส่ง key แบบ camelCase ให้ Python ที่อ่าน snake_case
 * ค่าที่เก็บไว้จึงเป็นศูนย์ — คำนวณ z เองจาก JSONB ดิบแทน
 */

/** จำนวนตอนก่อนหน้าที่ใช้เป็น baseline */
const BASELINE_WINDOW = 10;

type Status = "ok" | "unpositioned" | "no_stylometry";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ novelId: string; noteId: string }> },
) {
    try {
        const { novelId, noteId } = await params;
        const denied = await guardNovel(novelId);
        if (denied) return denied;

        const order = await getReadingOrder(novelId);
        const position = order.positionOf.get(noteId);

        if (position === undefined) {
            // ตอนที่ไม่ได้ผูกกับบท ไม่มีตำแหน่งในลำดับการอ่าน จึงไม่มี "ตอนก่อนหน้า"
            // ให้บอกตรง ๆ ดีกว่าเทียบกับตอนที่ไม่เกี่ยวกันแล้วรายงานเลขที่ไม่มีความหมาย
            return NextResponse.json({
                status: "unpositioned" satisfies Status,
                message: "ตอนนี้ยังไม่ได้ผูกกับบท จึงเทียบกับตอนก่อนหน้าไม่ได้",
            });
        }

        // ── stylometry ของทั้งเรื่อง (เอาแถวล่าสุดต่อ note) ──
        // noteStylometry ไม่มี unique constraint บน noteId จึงมีแถวซ้ำได้
        const styloRows = await db
            .select({
                noteId: noteStylometry.noteId,
                createdAt: noteStylometry.createdAt,
                pacingAndMood: noteStylometry.pacingAndMood,
                authorNarrationStyle: noteStylometry.authorNarrationStyle,
                characterDialogueVibes: noteStylometry.characterDialogueVibes,
                lexicalRichness: noteStylometry.lexicalRichness,
                chapterAnatomy: noteStylometry.chapterAnatomy,
            })
            .from(noteStylometry)
            .where(eq(noteStylometry.novelId, novelId));

        const latestByNote = new Map<string, StylometrySource & { createdAt: Date }>();
        for (const r of styloRows) {
            const prev = latestByNote.get(r.noteId);
            if (!prev || r.createdAt > prev.createdAt) latestByNote.set(r.noteId, r as never);
        }

        const current = latestByNote.get(noteId);
        if (!current) {
            return NextResponse.json({
                status: "no_stylometry" satisfies Status,
                message: "ตอนนี้ยังไม่เคยวิเคราะห์สไตล์ — สั่งวิเคราะห์ก่อนจึงจะเทียบได้",
            });
        }

        // ── baseline = ตอนก่อนหน้าที่มี stylometry แล้ว เอา BASELINE_WINDOW ตอนล่าสุด ──
        const baseline: StylometrySource[] = [];
        for (let p = position - 1; p >= 0 && baseline.length < BASELINE_WINDOW; p--) {
            const row = latestByNote.get(order.ordered[p].noteId);
            if (row) baseline.push(row);
        }

        const metrics = REPORT_FEATURES.map((f) => {
            const { raw, z, mean } = zAgainstBaseline(current, baseline, f);
            return {
                key: f.key,
                label: f.label,
                shortLabel: f.shortLabel,
                unit: f.unit,
                raw,
                z,
                baselineMean: mean,
                notable: z !== null && Math.abs(z) >= NOTABLE_Z,
                anomalous: z !== null && Math.abs(z) >= ANOMALY_Z,
            };
        });

        // ── คำเตือนที่ไม่ต้องใช้ baseline ──
        const voicePairs: Array<{ a: string; b: string; distance: number }> =
            (current.characterDialogueVibes?.voice_distances?.pairs ?? [])
                .filter((p: { too_similar?: boolean }) => p?.too_similar)
                .map((p: { a: string; b: string; distance: number }) => ({ a: p.a, b: p.b, distance: p.distance }));

        const driftWindows: Array<{ z?: number; start_sentence?: number }> =
            current.chapterAnatomy?.rolling_drift?.windows ?? [];
        let maxDrift: { z: number; at: number | null } = { z: 0, at: null };
        for (const w of driftWindows) {
            const z = w?.z;
            if (typeof z === "number" && Math.abs(z) > Math.abs(maxDrift.z)) {
                maxDrift = { z, at: w.start_sentence ?? null };
            }
        }

        const echoes: Array<{ term: string; count: number }> =
            (current.chapterAnatomy?.echoes ?? []).slice(0, 5);

        // ── ปมค้าง ──
        const threadReport = await buildThreadReport(novelId, order.ordered[position].chapterOrder);

        // ผลวิเคราะห์ที่เก็บไว้อาจมาจาก analyzer เวอร์ชันเก่าที่ยังไม่มีมิติเหล่านี้
        // (ข้อมูลชุดปัจจุบันในฐานมีแต่ chapter_anatomy.total_sentences) ต้องบอกผู้ใช้ให้
        // สั่งวิเคราะห์ใหม่ ไม่ใช่ปล่อยให้เห็นช่องว่างแล้วเดาว่าฟีเจอร์พัง
        const outdatedAnalysis =
            current.chapterAnatomy?.sentence_rhythm === undefined &&
            current.chapterAnatomy?.sensory_density === undefined;

        return NextResponse.json({
            status: "ok" satisfies Status,
            position,
            chapterOrder: order.ordered[position].chapterOrder,
            baselineCount: baseline.length,
            baselineEnough: baseline.length >= MIN_BASELINE,
            outdatedAnalysis,
            metrics,
            warnings: {
                voicePairs,
                drift: maxDrift.z !== 0 ? maxDrift : null,
                echoes,
            },
            threads: threadReport,
        });
    } catch (e) {
        console.error("chapter-report error:", e);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

/**
 * ปมที่ยังไม่เฉลย ณ บทที่กำลังรีวิว
 *
 * จุดอ้างอิงของ "ค้างมากี่บท" คือบทที่กำลังรีวิว ไม่ใช่บทสุดท้ายของเรื่อง —
 * คำถามคือ "ตอนที่ผู้อ่านมาถึงตรงนี้ ปมค้างมานานแค่ไหนแล้ว"
 */
async function buildThreadReport(novelId: string, referenceChapterOrder: number) {
    const threads = await db
        .select({ id: plotThreads.id, title: plotThreads.title, type: plotThreads.type, status: plotThreads.status, importance: plotThreads.importance })
        .from(plotThreads)
        .where(eq(plotThreads.novelId, novelId));

    if (threads.length === 0) return { reason: "none_created" as const, items: [] };

    const beats = await db
        .select({ threadId: plotThreadBeats.threadId, eventId: plotThreadBeats.eventId, role: plotThreadBeats.role })
        .from(plotThreadBeats)
        .where(inArray(plotThreadBeats.threadId, threads.map((t) => t.id)));

    const [events, chapterRows] = await Promise.all([
        db.select({ id: timelineEvents.id, relatedChapterId: timelineEvents.relatedChapterId })
            .from(timelineEvents).where(eq(timelineEvents.novelId, novelId)),
        db.select({ id: chapters.id, orderIndex: chapters.orderIndex })
            .from(chapters).where(eq(chapters.novelId, novelId)),
    ]);

    const eventChapterOrder = makeEventChapterOrder(events, chapterRows);
    const beatsByThread = new Map<string, typeof beats>();
    for (const b of beats) {
        const list = beatsByThread.get(b.threadId) ?? [];
        list.push(b);
        beatsByThread.set(b.threadId, list);
    }

    const items = threads
        .map((t) => {
            const a = analyzeThread({ ...t, beats: beatsByThread.get(t.id) ?? [] }, eventChapterOrder, referenceChapterOrder);
            return { ...t, ...a };
        })
        // เอาเฉพาะปมที่ยังค้าง และหว่านไว้ก่อนบทนี้แล้ว — ปมที่จะหว่านทีหลังไม่เกี่ยวกับตอนนี้
        .filter((t) => t.dangling && t.seedOrder !== null && t.seedOrder <= referenceChapterOrder)
        .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));

    return { reason: null, items };
}
