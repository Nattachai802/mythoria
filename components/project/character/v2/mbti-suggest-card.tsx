"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X, Check, AlertTriangle } from "lucide-react";
import { suggestMbti, suggestBigFive, type SuggestResult } from "@/server/mbti-suggest";
import { MBTI_QUESTIONS, scoreAxes, toSliders, type Choice, type MbtiAxis } from "@/lib/mbti-suggest";
import { B5_QUESTIONS, TRAITS, scoreBigFive, checkCoherence, type Trait } from "@/lib/bigfive-suggest";
import { cn } from "@/lib/utils";

type Q = { id: string; prompt: string; a: { text: string }; b: { text: string } };
type Choices = Record<string, Choice | null>;

/**
 * การ์ดคำถามสถานการณ์ (ใช้ร่วม MBTI / Big Five): AI ตอบให้ทุกข้อ — มีประโยคยืนยัน = จุดทอง, ไม่มี = "AI อนุมาน"
 * ผู้เขียนแก้ได้ทุกข้อ · state อยู่ในหน้าจอเท่านั้น จนกด "ใช้" · หน้าจอไม่โชว์ขั้ว/ตัวอักษรของตัวเลือก
 */
function SuggestCard({ label, hasValue, questions, run, summary, onApply }: {
    label: string;
    hasValue: boolean;
    questions: Q[];
    run: () => Promise<SuggestResult>;
    summary: (c: Choices) => { code: string; ready: number; total: number; hint: string };
    onApply: (c: Choices) => void;
}) {
    const [open, setOpen] = useState(false);
    const [pending, start] = useTransition();
    const [choices, setChoices] = useState<Choices>({});
    const [quotes, setQuotes] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState<string>();
    const [aiPicked, setAiPicked] = useState<Set<string>>(new Set()); // ข้อที่ AI เลือกให้ (ผู้ใช้กดเปลี่ยน = หลุดออก)

    const go = () => start(async () => {
        const res = await run();
        if (!res.success) { toast.error(`ช่วยหา ${label} ไม่สำเร็จ`, { description: res.error }); return; }
        const list = Object.values(res.answers);
        setChoices(Object.fromEntries(list.map((a) => [a.id, a.choice])));
        setQuotes(Object.fromEntries(list.filter((a) => a.choice).map((a) => [a.id, a.quote])));
        setAiPicked(new Set(list.filter((a) => a.choice).map((a) => a.id)));
        const n = list.filter((a) => a.choice).length;
        const withQuote = list.filter((a) => a.choice && a.quote).length;
        setNotice(res.notice ?? (n ? `AI ตอบให้ ${n} ข้อ (${withQuote} ข้อมีประโยคยืนยัน ที่เหลืออนุมานจากภาพรวม) — กดเปลี่ยนข้อไหนก็ได้ถ้าไม่ตรง` : "AI ตอบไม่ได้ตอนนี้ — ตอบคำถามเองได้เลย"));
        setOpen(true);
    });

    const sum = summary(choices);

    if (!open) return (
        <button type="button" onClick={go} disabled={pending} aria-busy={pending}
            className="mt-3 flex items-center gap-1.5 chamfered-sm border border-[var(--forge-gold)]/50 px-2.5 py-1 text-xs transition-[background-color,transform] duration-200 hover:bg-[var(--forge-gold)]/10 active:scale-95 motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-wait cursor-pointer">
            <Sparkles className={cn("w-3.5 h-3.5 text-[var(--forge-gold)]", pending && "animate-pulse")} />
            {pending ? "AI กำลังอ่าน…" : hasValue ? `ตรวจ ${label} อีกครั้ง` : `ช่วยหา ${label}`}
        </button>
    );

    return (
        <div className="mt-4 border-t border-border/60 pt-3 space-y-3 animate-in fade-in duration-200 motion-reduce:animate-none">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-muted-foreground" aria-live="polite">{notice}</p>
                <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3.5 h-3.5" /></button>
            </div>

            <ol className="space-y-3">
                {questions.map((q, i) => (
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
                    <span className="font-display text-xl tabular-nums tracking-wider">{sum.code}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{sum.ready === sum.total ? "ครบแล้ว" : sum.hint}</span>
                </div>
                <button type="button" disabled={sum.ready === 0}
                    onClick={() => { onApply(choices); toast.success(sum.ready === sum.total ? `ใช้ ${label} นี้แล้ว` : `ใช้ ${sum.ready} ส่วนที่ได้แล้ว`); setOpen(false); }}
                    className="chamfered-sm border border-[var(--forge-gold)] bg-[var(--forge-gold)]/15 px-3 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    ใช้ค่านี้
                </button>
            </div>
        </div>
    );
}

/** MBTI 12 ข้อ — แต่ละแกนได้ตัวอักษรเมื่อตอบไปทางเดียวกัน 2 ใน 3 */
export function MbtiSuggestCard({ characterId, hasValue, onApply }: {
    characterId: string;
    hasValue: boolean;
    onApply: (values: Partial<Record<MbtiAxis, number>>) => void;
}) {
    return (
        <SuggestCard label="MBTI" hasValue={hasValue} questions={MBTI_QUESTIONS} run={() => suggestMbti(characterId)}
            summary={(c) => {
                const axes = scoreAxes(c);
                return { code: axes.map((a) => a.letter ?? "?").join(""), ready: axes.filter((a) => a.letter).length, total: 4,
                    hint: "แต่ละแกนต้องตอบไปทางเดียวกัน 2 ใน 3 ข้อ" };
            }}
            onApply={(c) => onApply(toSliders(scoreAxes(c)))} />
    );
}

/** Big Five 15 ข้อ — แต่ละด้านต้องตอบครบ 3 ข้อ ได้คะแนน 1/2/4/5 */
export function BigFiveSuggestCard({ characterId, hasValue, onApply }: {
    characterId: string;
    hasValue: boolean;
    onApply: (values: Partial<Record<Trait, number>>) => void;
}) {
    return (
        <SuggestCard label="Big Five" hasValue={hasValue} questions={B5_QUESTIONS} run={() => suggestBigFive(characterId)}
            summary={(c) => {
                const s = scoreBigFive(c);
                return { code: s.map((x) => `${x.trait}${x.level ?? "?"}`).join(" "), ready: s.filter((x) => x.level).length, total: 5,
                    hint: "แต่ละด้านต้องตอบครบ 3 ข้อ" };
            }}
            onApply={(c) => onApply(Object.fromEntries(scoreBigFive(c).filter((x) => x.level).map((x) => [x.trait, x.level!])))} />
    );
}

/** ความสอดประสาน MBTI ↔ Big Five จากค่าที่ตั้งไว้จริง — ขัดกัน = คำถามชวนคิด ไม่ใช่ข้อผิด */
export function CoherencePanel({ mbti, bigFive }: { mbti: Partial<Record<string, number>>; bigFive: Partial<Record<Trait, number>> }) {
    const notes = checkCoherence(mbti, bigFive);
    if (notes.length === 0) return null;
    const traitLabel = (t: Trait) => TRAITS.find((x) => x.key === t)!.label;
    const lvl = (n: number) => (n >= 4 ? "สูง" : "ต่ำ");
    return (
        <div className="space-y-1.5" aria-label="ความสอดประสานระหว่าง MBTI กับ Big Five">
            <div className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">ความสอดประสาน MBTI ↔ Big Five</div>
            {notes.map((n) => (
                <div key={n.axis} className="flex items-start gap-2 text-xs animate-in fade-in duration-200 motion-reduce:animate-none">
                    {n.kind === "match"
                        ? <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="ไปด้วยกัน" />
                        : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--forge-amber)]" aria-label="ขัดกัน" />}
                    <span className={n.kind === "match" ? "text-muted-foreground" : ""}>
                        MBTI <b>{n.letter}</b> กับ{traitLabel(n.trait)} <b>{lvl(n.level)} ({n.level})</b>
                        {n.kind === "match" ? " — ไปด้วยกัน" : n.strong
                            ? " — ปกติไม่ค่อยไปด้วยกัน ตั้งใจให้ตัวละครเป็นแบบนี้ไหม?"
                            : " — เป็นไปได้ แต่ไม่บ่อย ลองเช็กว่าตรงกับที่ตั้งใจไหม"}
                    </span>
                </div>
            ))}
        </div>
    );
}
