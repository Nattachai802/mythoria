"use client"

// Restore ฝั่งเดียวใช้ร่วมกันทั้ง toast action และ widget "กู้คืนล่าสุด" — กันโค้ด restore ซ้ำต่อจุดลบ
import { createArc } from "@/server/story-arcs"
import { createThread, addBeat, updateThread, updateBeat, addPoint, updatePoint, addLink } from "@/server/plot-threads"
import { createTimelineEvent } from "@/server/timeline"
import type { PlotUndoEntry } from "@/hooks/use-plot-undo-stack"

export async function restorePlotUndoEntry(
    novelId: string,
    entry: PlotUndoEntry
): Promise<{ success: boolean; sceneId?: string; error?: string }> {
    switch (entry.kind) {
        case "arc": {
            const res = await createArc({
                novelId,
                title: entry.payload.title,
                color: entry.payload.color ?? undefined,
                startChapterId: entry.payload.startChapterId ?? undefined,
                endChapterId: entry.payload.endChapterId ?? undefined,
            })
            return { success: res.success, error: res.error }
        }
        case "thread": {
            const p = entry.payload
            const created = await createThread({
                novelId,
                title: p.title,
                type: p.type,
                importance: p.importance,
                note: p.note ?? undefined,
                color: p.color ?? undefined,
                summary: p.summary ?? undefined,
                parentThreadId: p.parentThreadId ?? null,
            })
            if (!created.success || !created.data) return { success: false, error: created.error }
            const id = created.data.id
            // ponytail: ยิงทีละ action (ปมหนึ่งมีไม่กี่สิบจุด) — ส่วนที่ล้มข้ามไป ได้ปมคืนมาบางส่วนดีกว่าไม่ได้เลย
            const failed: string[] = []

            if (p.status || p.targetChapterId) {
                const r = await updateThread(id, novelId, { ...(p.status ? { status: p.status } : {}), ...(p.targetChapterId ? { targetChapterId: p.targetChapterId } : {}) })
                if (!r.success) failed.push("สถานะ/บทเป้า")
            }

            // ประเด็น: id ใหม่ทั้งหมด → map เก่า→ใหม่ ไว้ผูก beat
            const pointMap = new Map<string, string>()
            for (const pt of p.points ?? []) {
                const r = await addPoint({ threadId: id, novelId, text: pt.text })
                if (!r.success || !r.data) { failed.push("ประเด็น"); continue }
                pointMap.set(pt.id, r.data.id)
                if (pt.status === "resolved") await updatePoint(r.data.id, novelId, { status: "resolved" })
            }

            for (const b of p.beats) {
                const r = await addBeat({ threadId: id, eventId: b.eventId, role: b.role, novelId, note: b.note ?? undefined, canvasItemId: b.canvasItemId ?? null })
                if (!r.success || !r.data) { failed.push("ฉากที่ผูก"); continue }
                const pointId = b.pointId ? pointMap.get(b.pointId) ?? null : null
                if (pointId || b.tension != null) await updateBeat(r.data.id, novelId, { pointId, tension: b.tension ?? null })
            }

            // ปมลูกโดน set null ตอนลบ — ผูกกลับ (updateThread กันข้ามนิยาย/วนให้แล้ว)
            for (const childId of p.childIds ?? []) {
                const r = await updateThread(childId, novelId, { parentThreadId: id })
                if (!r.success) failed.push("ปมย่อย")
            }
            // ลิงก์โดน cascade ทั้งสองทาง — ปมปลายทางที่ถูกลบไปแล้ว addLink จะปฏิเสธเอง
            for (const l of p.linksOut ?? []) {
                const r = await addLink({ novelId, fromThreadId: id, toThreadId: l.toThreadId, kind: l.kind as "before" | "misdirects" })
                if (!r.success) failed.push("ความสัมพันธ์")
            }
            for (const l of p.linksIn ?? []) {
                const r = await addLink({ novelId, fromThreadId: l.fromThreadId, toThreadId: id, kind: l.kind as "before" | "misdirects" })
                if (!r.success) failed.push("ความสัมพันธ์")
            }

            return failed.length
                ? { success: true, error: `กู้คืนได้ไม่ครบ: ${[...new Set(failed)].join(", ")}` }
                : { success: true }
        }
        case "beat": {
            const res = await addBeat({
                threadId: entry.payload.threadId,
                eventId: entry.payload.eventId,
                role: entry.payload.role,
                novelId,
                note: entry.payload.note ?? undefined,
                canvasItemId: entry.payload.canvasItemId ?? null,
            })
            // ประเด็นอาจถูกลบไปแล้ว — updateBeat ปฏิเสธเอง ไม่ทำให้การกู้ฉากล้ม
            if (res.success && res.data && (entry.payload.pointId || entry.payload.tension != null)) {
                await updateBeat(res.data.id, novelId, { pointId: entry.payload.pointId ?? null, tension: entry.payload.tension ?? null })
            }
            return { success: res.success, error: res.error }
        }
        case "scene": {
            const res = await createTimelineEvent({
                novelId,
                title: entry.payload.title,
                description: entry.payload.description,
                eventDate: entry.payload.eventDate,
                relatedChapterId: entry.payload.relatedChapterId,
                relatedCharacterIds: entry.payload.relatedCharacterIds,
                relatedLocationIds: entry.payload.relatedLocationIds,
                eventType: entry.payload.eventType,
                canvasData: entry.payload.canvasData,
            } as any)
            return { success: res.success, sceneId: res.event?.id, error: res.error }
        }
    }
}
