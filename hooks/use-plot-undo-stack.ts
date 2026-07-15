"use client"

import { useCallback, useEffect, useState } from "react"

// สแตกกู้คืนของกระดานพล็อต — เก็บ "เนื้อหา" ที่ลบไปล่าสุด (ไม่ใช่แถวเดิม) สูงสุด 3 รายการต่อนิยาย
// เก็บใน sessionStorage: รอด navigation (ลบฉากแล้วเด้งหน้า) แต่หายเมื่อปิดแท็บ — ตรงกับ "กันมือลั่น" ไม่ใช่ trash bin ถาวร
export type PlotUndoEntry =
    | { id: string; deletedAt: number; kind: "arc"; label: string; payload: { title: string; color: string | null; startChapterId: string | null; endChapterId: string | null } }
    | { id: string; deletedAt: number; kind: "thread"; label: string; payload: { title: string; type: string; importance: string; note: string | null; color: string | null; beats: { eventId: string; role: string; note: string | null }[] } }
    | { id: string; deletedAt: number; kind: "beat"; label: string; payload: { threadId: string; eventId: string; role: string; note: string | null } }
    | { id: string; deletedAt: number; kind: "scene"; label: string; payload: { novelId: string; title: string; description: string | null; eventDate: string | null; relatedChapterId: string | null; relatedCharacterIds: unknown; relatedLocationIds: unknown; eventType: string | null; canvasData: unknown } }

const CAP = 3
const storageKey = (novelId: string) => `plot-undo-stack:${novelId}`
const CHANGE_EVENT = "plot-undo-stack:changed"

function readStack(novelId: string): PlotUndoEntry[] {
    if (typeof window === "undefined") return []
    try {
        const raw = sessionStorage.getItem(storageKey(novelId))
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function writeStack(novelId: string, stack: PlotUndoEntry[]) {
    sessionStorage.setItem(storageKey(novelId), JSON.stringify(stack.slice(0, CAP)))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { novelId } }))
}

// เรียกจากจุดลบได้เลย ไม่ต้องเป็น component (ไม่ผูก hook lifecycle)
export function pushPlotUndo(novelId: string, entry: Omit<PlotUndoEntry, "id" | "deletedAt">): PlotUndoEntry {
    const stack = readStack(novelId)
    const withId = { ...entry, id: crypto.randomUUID(), deletedAt: Date.now() } as PlotUndoEntry
    writeStack(novelId, [withId, ...stack])
    return withId
}

export function removePlotUndo(novelId: string, id: string) {
    writeStack(novelId, readStack(novelId).filter(e => e.id !== id))
}

// อ่าน + subscribe การเปลี่ยนแปลง (ใช้แสดงรายการ "กู้คืนล่าสุด")
export function usePlotUndoStack(novelId: string) {
    const [stack, setStack] = useState<PlotUndoEntry[]>([])

    const refresh = useCallback(() => setStack(readStack(novelId)), [novelId])

    useEffect(() => {
        refresh()
        const onChange = (e: Event) => {
            if ((e as CustomEvent).detail?.novelId === novelId) refresh()
        }
        window.addEventListener(CHANGE_EVENT, onChange)
        return () => window.removeEventListener(CHANGE_EVENT, onChange)
    }, [novelId, refresh])

    const remove = useCallback((id: string) => removePlotUndo(novelId, id), [novelId])

    return { stack, remove }
}
