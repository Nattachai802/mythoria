"use server";

/**
 * เช็คลิสต์ "บทนี้มีอะไรต้องแก้" — รวมสัญญาณที่มีอยู่แล้วในระบบ plot ให้เป็นรายการเดียว
 * rules ล้วน ไม่เรียก AI สักครั้ง (ดู task.md 8a) — ทุก query อ่านของที่คำนวณ/เก็บไว้แล้ว
 */

import { db } from "@/db/drizzle";
import { timelineEvents, plotThreads, plotThreadBeats, plotFindings } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { requireNovelAccess } from "@/lib/authz";
import type { EchoEvidence } from "@/lib/echo-score";
import type { CausalityVerdict } from "@/lib/plot-recap";

export type ChecklistKind =
    | "dangling_thread"
    | "no_causal"
    | "no_pov"
    | "no_pacing"
    | "causality_unsupported"
    | "echo_high";

export interface ChecklistItem {
    kind: ChecklistKind;
    sceneId?: string;
    sceneTitle?: string;
    threadId?: string;
    threadTitle?: string;
    detail?: string;
}

// เดาถูก >= 70% ของครั้งที่ลอง = ค่อนข้างคาดเดาง่าย — ปรับได้ทีหลังถ้าใช้จริงแล้วไม่พอดี
const ECHO_HIGH_RATIO = 0.7;

export async function getChapterChecklist(novelId: string, chapterId: string): Promise<
    { success: true; items: ChecklistItem[] } | { success: false; error: string }
> {
    try {
        await requireNovelAccess(novelId);

        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.relatedChapterId, chapterId),
            orderBy: (t, { asc }) => [asc(t.orderIndex)],
            columns: { id: true, title: true, orderIndex: true, causeKind: true, povCharacterId: true, pacing: true },
        });
        if (events.length === 0) return { success: true, items: [] };
        const eventIds = events.map(e => e.id);
        const titleById = new Map(events.map(e => [e.id, e.title]));

        const items: ChecklistItem[] = [];

        // ── ฉากไม่มี causal link / POV / pacing ──
        for (const e of events) {
            if (!e.causeKind) items.push({ kind: "no_causal", sceneId: e.id, sceneTitle: e.title });
            if (!e.povCharacterId) items.push({ kind: "no_pov", sceneId: e.id, sceneTitle: e.title });
            if (e.pacing == null) items.push({ kind: "no_pacing", sceneId: e.id, sceneTitle: e.title });
        }

        // ── ปมค้างที่แตะบทนี้ (dangling มองทั้งเรื่อง — สูตรเดียวกับ lib/story-format.ts) ──
        const threads = await db.select().from(plotThreads).where(eq(plotThreads.novelId, novelId));
        if (threads.length > 0) {
            const allBeats = await db
                .select()
                .from(plotThreadBeats)
                .where(inArray(plotThreadBeats.threadId, threads.map(t => t.id)));
            for (const t of threads) {
                const beats = allBeats.filter(b => b.threadId === t.id);
                const touchesChapter = beats.some(b => eventIds.includes(b.eventId));
                if (!touchesChapter) continue;
                const closedByAuthor = t.status === "paid" || t.status === "abandoned";
                const hasPayoff = beats.some(b => b.role === "payoff");
                if (!closedByAuthor && !hasPayoff) {
                    items.push({ kind: "dangling_thread", threadId: t.id, threadTitle: t.title });
                }
            }
        }

        // ── causality ที่เคยตรวจแล้วว่า unsupported ──
        const causalityRows = await db
            .select({ sceneId: plotFindings.sceneId, evidence: plotFindings.evidence })
            .from(plotFindings)
            .where(and(eq(plotFindings.novelId, novelId), eq(plotFindings.checkId, "causality"), inArray(plotFindings.sceneId, eventIds)));
        for (const row of causalityRows) {
            const verdict = (row.evidence as { verdict: CausalityVerdict } | null)?.verdict;
            if (verdict === "unsupported" && row.sceneId) {
                items.push({ kind: "causality_unsupported", sceneId: row.sceneId, sceneTitle: titleById.get(row.sceneId) });
            }
        }

        // ── Echo Score สูง (เฉลี่ย hitCount/k ต่อฉาก) ──
        const echoRows = await db
            .select({ sceneId: plotFindings.sceneId, evidence: plotFindings.evidence })
            .from(plotFindings)
            .where(and(eq(plotFindings.novelId, novelId), eq(plotFindings.checkId, "echo"), inArray(plotFindings.sceneId, eventIds)));
        const echoBySceneId = new Map<string, { hit: number; k: number; n: number }>();
        for (const row of echoRows) {
            if (!row.sceneId) continue;
            const ev = row.evidence as EchoEvidence;
            const acc = echoBySceneId.get(row.sceneId) ?? { hit: 0, k: 0, n: 0 };
            acc.hit += ev.hitCount;
            acc.k += ev.k;
            acc.n += 1;
            echoBySceneId.set(row.sceneId, acc);
        }
        for (const [sceneId, acc] of echoBySceneId) {
            if (acc.k > 0 && acc.hit / acc.k >= ECHO_HIGH_RATIO) {
                items.push({ kind: "echo_high", sceneId, sceneTitle: titleById.get(sceneId) });
            }
        }

        return { success: true, items };
    } catch (error) {
        console.error("getChapterChecklist error:", error);
        return { success: false, error: "โหลดเช็คลิสต์ไม่สำเร็จ" };
    }
}
