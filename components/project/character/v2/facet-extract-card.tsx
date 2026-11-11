"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X, Check } from "lucide-react";
import { extractFacets } from "@/server/mbti-suggest";
import type { FacetExtract } from "@/lib/facet-extract";
import { cn } from "@/lib/utils";

/**
 * ปุ่ม "ให้ AI สกัดจากภาพรวม" → การ์ดให้ติ๊กเลือกนิสัยเด่น / นิสัยที่ขัดกันเอง
 * ผลอยู่ใน state หน้าจอจนกด "เพิ่มที่เลือก" · นิสัยเด่นต่อท้ายของเดิม · นิสัยที่ขัดกันเองต่อท้ายข้อความเดิม (ไม่เขียนทับ)
 */
export function FacetExtractCard({ characterId, room, onAdd }: {
    characterId: string;
    room: number; // ช่องนิสัยเด่นที่เหลือ (สูงสุด 12)
    onAdd: (picked: FacetExtract) => void;
}) {
    const [pending, start] = useTransition();
    const [draft, setDraft] = useState<FacetExtract | null>(null);
    const [notice, setNotice] = useState<string>();
    const [sel, setSel] = useState<Set<string>>(new Set());

    const go = () => start(async () => {
        const res = await extractFacets(characterId);
        if (!res.success) { toast.error("สกัดนิสัยไม่สำเร็จ", { description: res.error }); return; }
        const d = res.draft;
        if (!d.facets.length && !d.contradictions.length) { toast.info(res.notice ?? "AI ไม่เจอนิสัยที่ชัดพอจากข้อความ"); return; }
        setDraft(d);
        setNotice(res.notice);
        // ติ๊กไว้ก่อนเฉพาะข้อที่มีหลักฐาน และไม่เกินช่องที่เหลือ
        setSel(new Set([
            ...d.facets.map((f, i) => (f.quote ? `f${i}` : "")).filter(Boolean).slice(0, room),
            ...d.contradictions.map((c, i) => (c.quoteA && c.quoteB ? `c${i}` : "")).filter(Boolean),
        ]));
    });

    if (!draft) return (
        <button type="button" onClick={go} disabled={pending || room === 0} aria-busy={pending}
            title={room === 0 ? "นิสัยเด่นครบ 12 ข้อแล้ว" : undefined}
            className="mt-2 flex items-center gap-1.5 chamfered-sm border border-[var(--forge-gold)]/50 px-2.5 py-1 text-xs transition-[background-color,transform] duration-200 hover:bg-[var(--forge-gold)]/10 active:scale-95 motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            <Sparkles className={cn("w-3.5 h-3.5 text-[var(--forge-gold)]", pending && "animate-pulse")} />
            {pending ? "AI กำลังอ่าน…" : "ให้ AI สกัดจากภาพรวม"}
        </button>
    );

    const toggle = (k: string) => setSel((p) => {
        const n = new Set(p);
        if (n.has(k)) n.delete(k);
        else if (k.startsWith("f") && [...n].filter((x) => x.startsWith("f")).length >= room) { toast.info(`เพิ่มนิสัยเด่นได้อีก ${room} ข้อ`); return p; }
        else n.add(k);
        return n;
    });
    const add = () => {
        onAdd({
            facets: draft.facets.filter((_, i) => sel.has(`f${i}`)),
            contradictions: draft.contradictions.filter((_, i) => sel.has(`c${i}`)),
        });
        setDraft(null);
    };

    const row = (k: string, title: string, quotes: string[], detail?: string) => {
        const on = sel.has(k);
        const proof = quotes.filter(Boolean);
        return (
            <li key={k}>
                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(k)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors duration-150 cursor-pointer">
                    <span className={cn("mt-0.5 w-4 h-4 shrink-0 chamfered-sm border flex items-center justify-center transition-colors duration-150",
                        on ? "bg-[var(--forge-gold)] border-[var(--forge-gold)] text-background" : "border-border")}>
                        {on && <Check className="w-3 h-3" />}
                    </span>
                    <span className="min-w-0 text-sm">
                        <span className="font-medium">{title}</span>
                        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                        {proof.length
                            ? proof.map((q) => <span key={q} className="block text-[11px] text-muted-foreground/80 italic">“{q}”</span>)
                            : <span className="inline-block mt-0.5 text-[10px] px-1.5 border border-amber-500/40 text-amber-600 dark:text-amber-400">AI อนุมาน — ไม่มีประโยคยืนยัน</span>}
                    </span>
                </button>
            </li>
        );
    };

    return (
        <div className="mt-3 chamfered-sm border border-border/70 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/60">
                <div className="min-w-0">
                    <div className="text-xs">AI เสนอ — ติ๊กข้อที่ต้องการ</div>
                    <p className="text-[11px] text-muted-foreground" aria-live="polite">{notice ?? "ข้อที่มีหลักฐานจากข้อความติ๊กไว้ให้แล้ว"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={add} disabled={sel.size === 0}
                        className="chamfered-sm bg-[var(--forge-gold)]/80 text-background px-2.5 py-1 text-xs disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
                        เพิ่มที่เลือก ({sel.size})
                    </button>
                    <button type="button" aria-label="ปิด" onClick={() => setDraft(null)} className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
            </div>
            {draft.facets.length > 0 && (
                <>
                    <div className="px-3 pt-2 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">นิสัยเด่น</div>
                    <ul>{draft.facets.map((f, i) =>
                        row(`f${i}`, `${f.name} · ${f.direction === "high" ? "สูง" : "ต่ำ"} ${f.strength}`, [f.quote], f.scene),
                    )}</ul>
                </>
            )}
            {draft.contradictions.length > 0 && (
                <>
                    <div className="px-3 pt-2 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground border-t border-border/60">นิสัยที่ขัดกันเอง</div>
                    <ul>{draft.contradictions.map((c, i) =>
                        row(`c${i}`, c.text, [c.quoteA, c.quoteB]),
                    )}</ul>
                </>
            )}
        </div>
    );
}
