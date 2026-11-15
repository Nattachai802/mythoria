"use client";

import { statusAt } from "@/lib/faction-checks";

type F = { id: string; name: string; status?: string | null; statusTimeline?: unknown; parentFactionId?: string | null };
type Ch = { id: string; title: string; orderIndex: number };

/**
 * ไทม์ไลน์ทุกฝ่าย: แถวละฝ่ายใหญ่ ช่องละบท สีตามสถานะของบทนั้น · เส้นทองตั้ง = บทที่เลือกอยู่ · กดช่อง = เลือกบทนั้น
 * ponytail: ช่องละบท — นิยาย 200+ บทช่องจะบางมาก ค่อยรวมเป็นช่วงถ้าเจอจริง
 */
export function FactionTimelineStrip({ factions, chapters, presets, selectedChapterId, onPickChapter, onSelect }: {
    factions: F[]; chapters: Ch[]; presets: { key: string; label: string; color: string }[];
    selectedChapterId: string; onPickChapter: (id: string) => void; onSelect: (id: string) => void;
}) {
    if (chapters.length < 2 || factions.length === 0) return null;
    const ids = new Set(factions.map((f) => f.id));
    const rows = factions.filter((f) => !f.parentFactionId || !ids.has(f.parentFactionId));
    const order = new Map(chapters.map((c) => [c.id, c.orderIndex]));
    const meta = (k: string | null) => presets.find((p) => p.key === k);
    const selIdx = chapters.findIndex((c) => c.id === selectedChapterId);
    const used = [...new Set(rows.flatMap((f) => chapters.map((c) => statusAt(f, order, c.orderIndex))))].map(meta).filter(Boolean);

    return (
        <div className="px-4 pb-4">
            <div className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">ไทม์ไลน์ฝ่าย</div>
            <div className="grid grid-cols-[minmax(6rem,9rem)_1fr] gap-x-3 gap-y-1.5 items-center text-xs">
                {rows.map((f) => (
                    <div key={f.id} className="contents">
                        <button type="button" onClick={() => onSelect(f.id)} className="truncate text-left hover:text-foreground text-muted-foreground cursor-pointer">{f.name}</button>
                        <div className="relative flex h-3 gap-px">
                            {chapters.map((c) => {
                                const st = meta(statusAt(f, order, c.orderIndex));
                                return (
                                    <button key={c.id} type="button" onClick={() => onPickChapter(c.id)}
                                        title={`${f.name} · บท ${c.orderIndex}: ${st?.label ?? "ไม่ระบุสถานะ"}`} aria-label={`บท ${c.orderIndex} ${st?.label ?? ""}`}
                                        className="flex-1 min-w-[2px] cursor-pointer hover:opacity-100" style={{ backgroundColor: st?.color ?? "#475569", opacity: 0.8 }} />
                                );
                            })}
                            {selIdx >= 0 && (
                                <span className="absolute -top-1 -bottom-1 w-0.5 bg-[var(--forge-gold)] pointer-events-none"
                                    style={{ left: `calc(${((selIdx + 0.5) / chapters.length) * 100}% - 1px)` }} aria-hidden />
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 ml-[calc(min(9rem,_100%)+0.75rem)]">
                <span>บท {chapters[0].orderIndex}</span><span>บท {chapters[chapters.length - 1].orderIndex}</span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-muted-foreground">
                {used.map((m) => <span key={m!.key} className="inline-flex items-center gap-1"><span className="w-2 h-2" style={{ background: m!.color }} />{m!.label}</span>)}
                <span className="ml-auto">ตั้งสถานะตามบทได้ที่ &ldquo;ไทม์ไลน์สถานะ&rdquo; ในรายละเอียดฝ่าย</span>
            </div>
        </div>
    );
}
