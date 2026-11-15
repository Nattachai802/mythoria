"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { getCharacterFactions, removeCharacterFromFaction, updateCharacterFaction } from "@/server/factions";
import { getChapters } from "@/server/chapter";
import { ManageFactionDialog } from "./manage-faction-dialog";
import { cn } from "@/lib/utils";

type Chapter = { id: string; title: string; orderIndex: number };
type Membership = {
    id: string;
    role: string | null;
    startChapterId: string | null;
    endChapterId: string | null;
    faction: { id: string; name: string; color: string | null };
};

/**
 * สังกัดของตัวละครนี้ — เพิ่ม / แก้บทบาทและช่วงบท / ออกจากฝ่าย ได้ในที่เดียว
 * อ่าน/เขียนตาราง character_factions เดียวกับแท็บฝ่าย (แทน FactionTimelineView เดิมที่โชว์ทุกฝ่ายของนิยาย)
 */
export function CharacterAffiliations({ characterId, novelId }: { characterId: string; novelId: string }) {
    const [items, setItems] = useState<Membership[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);

    const load = useCallback(async () => {
        const [m, c] = await Promise.all([getCharacterFactions(characterId), getChapters(novelId)]);
        if (m.success && m.data) setItems(m.data as Membership[]);
        if (c.success && c.chapters) setChapters((c.chapters as Chapter[]).slice().sort((a, b) => a.orderIndex - b.orderIndex));
        setLoading(false);
    }, [characterId, novelId]);
    useEffect(() => {
        let alive = true;
        Promise.all([getCharacterFactions(characterId), getChapters(novelId)]).then(([m, c]) => {
            if (!alive) return;
            if (m.success && m.data) setItems(m.data as Membership[]);
            if (c.success && c.chapters) setChapters((c.chapters as Chapter[]).slice().sort((a, b) => a.orderIndex - b.orderIndex));
            setLoading(false);
        });
        return () => { alive = false; };
    }, [characterId, novelId]);

    const patch = async (id: string, data: Partial<Pick<Membership, "role" | "startChapterId" | "endChapterId">>) => {
        setItems((p) => p.map((m) => (m.id === id ? { ...m, ...data } : m)));
        const res = await updateCharacterFaction(id, novelId, data);
        if (!res.success) { toast.error("บันทึกสังกัดไม่สำเร็จ", { description: res.error }); void load(); }
    };
    const remove = async (m: Membership) => {
        if (!window.confirm(`ออกจาก "${m.faction.name}"?`)) return;
        const res = await removeCharacterFromFaction(m.id, novelId);
        if (res.success) setItems((p) => p.filter((x) => x.id !== m.id));
        else toast.error("ออกจากฝ่ายไม่สำเร็จ", { description: res.error });
    };

    // แถบช่วงบท: start/end ว่าง = ตั้งแต่ต้น / จนถึงปัจจุบัน
    const total = chapters.length;
    const pos = (id: string | null, fallback: number) => {
        const i = chapters.findIndex((c) => c.id === id);
        return i === -1 ? fallback : i;
    };

    return (
        <div>
            <div className="flex justify-end mb-2">
                <button type="button" onClick={() => setAddOpen(true)}
                    className="flex items-center gap-1 chamfered-sm border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-[var(--forge-gold)]/60 transition-colors duration-200 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> เพิ่มสังกัด
                </button>
            </div>

            {loading ? null : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่ได้สังกัดฝ่ายใด</p>
            ) : (
                <>
                    <ul className="divide-y divide-border/60">
                        {items.map((m) => (
                            <li key={m.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(8rem,1fr)_8rem_auto_auto] items-center gap-x-3 gap-y-1.5 py-2">
                                <span className="flex items-center gap-2 text-sm font-medium min-w-0">
                                    <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: m.faction.color ?? "#888" }} aria-hidden />
                                    <span className="truncate">{m.faction.name}</span>
                                </span>
                                <input aria-label={`บทบาทใน ${m.faction.name}`} defaultValue={m.role ?? ""} placeholder="บทบาท เช่น ผู้นำ"
                                    onBlur={(e) => { if (e.target.value.trim() !== (m.role ?? "")) void patch(m.id, { role: e.target.value }); }}
                                    className="order-3 sm:order-none bg-transparent text-xs outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)] py-0.5" />
                                <span className="order-4 sm:order-none flex items-center gap-1 text-xs text-muted-foreground">
                                    บท
                                    <ChapterSelect label="เริ่ม" value={m.startChapterId} chapters={chapters} empty="แรก" onChange={(v) => patch(m.id, { startChapterId: v })} />
                                    –
                                    <ChapterSelect label="จบ" value={m.endChapterId} chapters={chapters} empty="ปัจจุบัน" onChange={(v) => patch(m.id, { endChapterId: v })} />
                                </span>
                                <span className="flex items-center justify-end gap-0.5">
                                    <Link href={`/dashboard/project/${novelId}/characters?view=factions`} aria-label={`ไปที่ฝ่าย ${m.faction.name}`}
                                        className="p-1.5 text-muted-foreground hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></Link>
                                    <button type="button" aria-label={`ออกจาก ${m.faction.name}`} onClick={() => remove(m)}
                                        className="p-1.5 text-muted-foreground hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                </span>
                            </li>
                        ))}
                    </ul>
                    {total > 1 && (
                        <div className="mt-3" aria-label="ช่วงบทที่อยู่แต่ละฝ่าย">
                            {items.map((m) => {
                                const a = pos(m.startChapterId, 0), b = pos(m.endChapterId, total - 1);
                                return (
                                    <div key={m.id} className="relative h-2 my-1 bg-muted/60">
                                        <div className="absolute inset-y-0 chamfered-sm" title={m.faction.name}
                                            style={{ left: `${(a / total) * 100}%`, width: `${(Math.max(1, b - a + 1) / total) * 100}%`, backgroundColor: m.faction.color ?? "#888", opacity: 0.75 }} />
                                    </div>
                                );
                            })}
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                                <span>บท {chapters[0]?.orderIndex}</span><span>บท {chapters[total - 1]?.orderIndex}</span>
                            </div>
                        </div>
                    )}
                </>
            )}

            <ManageFactionDialog novelId={novelId} characterId={characterId} open={addOpen} onOpenChange={setAddOpen} onSuccess={load} />
        </div>
    );
}

function ChapterSelect({ label, value, chapters, empty, onChange }: {
    label: string; value: string | null; chapters: Chapter[]; empty: string; onChange: (v: string | null) => void;
}) {
    return (
        <select aria-label={`บท${label}`} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
            className={cn("bg-transparent border-b border-transparent hover:border-border focus:border-[var(--forge-gold)] outline-none py-0.5 max-w-[7rem] cursor-pointer", !value && "text-muted-foreground")}>
            <option value="">{empty}</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.orderIndex}. {c.title}</option>)}
        </select>
    );
}
