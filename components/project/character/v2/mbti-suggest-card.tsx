"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { suggestMbti } from "@/server/mbti-suggest";
import { MBTI_QUESTIONS, scoreAxes, toSliders, type Choice, type MbtiAxis } from "@/lib/mbti-suggest";
import { cn } from "@/lib/utils";

/**
 * ช่วยหา MBTI — คำถามสถานการณ์ 12 ข้อ: AI ตอบข้อที่ข้อความของผู้เขียนมีหลักฐาน (มีจุดทอง + ประโยคอ้างอิง)
 * ข้อที่เหลือผู้เขียนตอบเอง · state อยู่ในหน้าจอเท่านั้น จนกด "ใช้" จึงเขียนลงสไลเดอร์ (บันทึกอัตโนมัติ)
 * หน้าจอไม่โชว์ตัวอักษร MBTI ของแต่ละตัวเลือก — กันเลือกตามตัวอักษรที่อยากได้
 */
export function MbtiSuggestCard({ characterId, hasValue, onApply }: {
    characterId: string;
    hasValue: boolean;
    onApply: (values: Partial<Record<MbtiAxis, number>>) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pending, start] = useTransition();
    const [choices, setChoices] = useState<Record<string, Choice | null>>({});
    const [quotes, setQuotes] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState<string>();
    const [aiPicked, setAiPicked] = useState<Set<string>>(new Set()); // ข้อที่ AI เลือกให้ (ผู้ใช้กดเปลี่ยน = หลุดออก)

    const run = () => start(async () => {
        const res = await suggestMbti(characterId);
        if (!res.success) { toast.error("ช่วยหา MBTI ไม่สำเร็จ", { description: res.error }); return; }
        setChoices(Object.fromEntries(Object.values(res.answers).map((a) => [a.id, a.choice])));
        setQuotes(Object.fromEntries(Object.values(res.answers).filter((a) => a.choice).map((a) => [a.id, a.quote])));
        setAiPicked(new Set(Object.values(res.answers).filter((a) => a.choice).map((a) => a.id)));
        const n = Object.values(res.answers).filter((a) => a.choice).length;
        const withQuote = Object.values(res.answers).filter((a) => a.choice && a.quote).length;
        setNotice(res.notice ?? (n ? `AI ตอบให้ ${n} ข้อ (${withQuote} ข้อมีประโยคยืนยัน ที่เหลืออนุมานจากภาพรวม) — กดเปลี่ยนข้อไหนก็ได้ถ้าไม่ตรง` : "AI ตอบไม่ได้ตอนนี้ — ตอบคำถามเองได้เลย"));
        setOpen(true);
    });

    const axes = scoreAxes(choices);
    const code = axes.map((a) => a.letter ?? "?").join("");
    const ready = axes.filter((a) => a.letter).length;

    if (!open) return (
        <button type="button" onClick={run} disabled={pending} aria-busy={pending}
            className="mt-3 flex items-center gap-1.5 chamfered-sm border border-[var(--forge-gold)]/50 px-2.5 py-1 text-xs transition-[background-color,transform] duration-200 hover:bg-[var(--forge-gold)]/10 active:scale-95 motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-wait cursor-pointer">
            <Sparkles className={cn("w-3.5 h-3.5 text-[var(--forge-gold)]", pending && "animate-pulse")} />
            {pending ? "AI กำลังอ่าน…" : hasValue ? "ตรวจ MBTI อีกครั้ง" : "ช่วยหา MBTI"}
        </button>
    );

    return (
        <div className="mt-4 border-t border-border/60 pt-3 space-y-3 animate-in fade-in duration-200 motion-reduce:animate-none">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground" aria-live="polite">{notice}</p>
                <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>

            <ol className="space-y-3">
                {MBTI_QUESTIONS.map((q, i) => (
                    <li key={q.id} className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-sm">
                            <span className="font-technical text-[10px] tabular-nums text-muted-foreground">{i + 1}.</span>
                            {q.prompt}
                            {aiPicked.has(q.id) && choices[q.id] && !quotes[q.id] && (
                                <span className="text-[10px] text-muted-foreground/70">· AI อนุมาน</span>
                            )}
                            {quotes[q.id] && choices[q.id] && (
                                <span title={`AI เลือกจาก: “${quotes[q.id]}”`} aria-label={`AI เลือกจากข้อความ: ${quotes[q.id]}`}
                                    className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--forge-gold)] cursor-help" tabIndex={0} />
                            )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-1.5" role="radiogroup" aria-label={q.prompt}>
                            {(["a", "b"] as const).map((c) => (
                                <button key={c} type="button" role="radio" aria-checked={choices[q.id] === c}
                                    onClick={() => { setChoices((p) => ({ ...p, [q.id]: p[q.id] === c ? null : c })); setQuotes((p) => ({ ...p, [q.id]: "" })); setAiPicked((p) => { const n = new Set(p); n.delete(q.id); return n; }); }}
                                    className={cn("text-left chamfered-sm border px-2.5 py-1.5 text-xs leading-relaxed transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98] motion-reduce:active:scale-100 cursor-pointer",
                                        choices[q.id] === c ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                                    {q[c].text}
                                </button>
                            ))}
                        </div>
                        {quotes[q.id] && choices[q.id] && (
                            <p className="text-[11px] text-muted-foreground border-l-2 border-[var(--forge-gold)]/40 pl-2">“{quotes[q.id]}”</p>
                        )}
                    </li>
                ))}
            </ol>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <div>
                    <span className="font-display text-xl tabular-nums tracking-wider">{code}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{ready === 4 ? "ครบทุกแกน" : `ได้ ${ready}/4 แกน — แต่ละแกนต้องตอบไปทางเดียวกัน 2 ใน 3 ข้อ`}</span>
                </div>
                <button type="button" disabled={ready === 0}
                    onClick={() => { onApply(toSliders(axes)); toast.success(ready === 4 ? `ใช้ ${code} แล้ว` : `ใช้ ${ready} แกนที่ได้แล้ว`); setOpen(false); }}
                    className="chamfered-sm border border-[var(--forge-gold)] bg-[var(--forge-gold)]/15 px-3 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    ใช้ค่านี้
                </button>
            </div>
        </div>
    );
}
