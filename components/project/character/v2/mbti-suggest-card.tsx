"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, X, Check, AlertTriangle, ChevronDown } from "lucide-react";
import { suggestMbti, suggestBigFive, suggestEnneagram, type SuggestResult } from "@/server/mbti-suggest";
import { MBTI_QUESTIONS, AXES, scoreAxes, toSliders, type Choice, type MbtiAxis } from "@/lib/mbti-suggest";
import { B5_QUESTIONS, TRAITS, scoreBigFive, checkCoherence, type Trait } from "@/lib/bigfive-suggest";
import { ENN_QUESTIONS, ENN_NAMES, scoreEnneagram, type EnnType } from "@/lib/enneagram-suggest";
import { cn } from "@/lib/utils";

/** เรียก fn ทุกครั้งที่ trigger เปลี่ยน (ข้ามค่าแรก) — ใช้กับปุ่ม "วิเคราะห์ทั้งหมด" */
export function useRunOnTrigger(trigger: number | undefined, fn: () => void) {
    const first = useRef(trigger);
    const f = useRef(fn);
    useEffect(() => { f.current = fn; });
    useEffect(() => {
        if (trigger === undefined || trigger === first.current) return;
        f.current();
    }, [trigger]);
}

type Opt = { key: string; text: string };
type Q = { id: string; prompt: string; options: Opt[] };
type Choices = Record<string, string | null>;
type Group = { key: string; label: string; ids: string[] };
type GroupSummary = { result: string; split: boolean };

/**
 * การ์ดคำถามสถานการณ์ (ใช้ร่วม MBTI / Big Five / Enneagram)
 * แสดงผลสรุปเป็นแถวต่อแกน/ด้านก่อน — คำถามซ่อนไว้ กดแถวเพื่อกางดู/แก้ (เดิมกางทุกข้อพร้อมกัน รก)
 * แถวที่ "ควรตรวจ" = ผลไม่ขาด หรือมีข้อที่ AI อนุมานโดยไม่มีประโยคยืนยัน
 * state อยู่ในหน้าจอเท่านั้นจนกด "ใช้ค่านี้" · หน้าจอไม่โชว์ขั้ว/ตัวอักษร/เลข type ของตัวเลือก
 */
function SuggestCard({ label, hasValue, questions, groups, run, groupSummary, summary, onApply, trigger }: {
    label: string;
    hasValue: boolean;
    questions: Q[];
    groups: Group[];
    run: () => Promise<SuggestResult>;
    groupSummary: (c: Choices, g: Group) => GroupSummary;
    summary: (c: Choices) => { code: string; ready: number; total: number; hint: string };
    onApply: (c: Choices) => void;
    trigger?: number; // เพิ่มค่า = สั่งวิเคราะห์จากปุ่ม "วิเคราะห์ทั้งหมด"
}) {
    const [open, setOpen] = useState(false);
    const [pending, start] = useTransition();
    const [choices, setChoices] = useState<Choices>({});
    const [quotes, setQuotes] = useState<Record<string, string>>({});
    const [aiPicked, setAiPicked] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState<string | null>(null);
    const [notice, setNotice] = useState<string>();

    const go = () => start(async () => {
        const res = await run();
        if (!res.success) { toast.error(`ช่วยหา ${label} ไม่สำเร็จ`, { description: res.error }); return; }
        const list = Object.values(res.answers);
        setChoices(Object.fromEntries(list.map((a) => [a.id, a.choice])));
        setQuotes(Object.fromEntries(list.filter((a) => a.choice).map((a) => [a.id, a.quote])));
        setAiPicked(new Set(list.filter((a) => a.choice).map((a) => a.id)));
        const n = list.filter((a) => a.choice).length;
        const withQuote = list.filter((a) => a.choice && a.quote).length;
        setNotice(res.notice ?? (n ? `AI ตอบให้ ${n} ข้อ · ${withQuote} ข้อมีประโยคยืนยัน` : "AI ตอบไม่ได้ตอนนี้ — กดแต่ละแถวเพื่อตอบเอง"));
        setExpanded(null);
        setOpen(true);
    });

    useRunOnTrigger(trigger, go);

    const pick = (id: string, key: string) => {
        setChoices((p) => ({ ...p, [id]: p[id] === key ? null : key }));
        setQuotes((p) => ({ ...p, [id]: "" }));
        setAiPicked((p) => { const n = new Set(p); n.delete(id); return n; });
    };

    const sum = summary(choices);

    if (!open) return (
        <button type="button" onClick={go} disabled={pending} aria-busy={pending}
            className="mt-3 flex items-center gap-1.5 chamfered-sm border border-[var(--forge-gold)]/50 px-2.5 py-1 text-xs transition-[background-color,transform] duration-200 hover:bg-[var(--forge-gold)]/10 active:scale-95 motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-wait cursor-pointer">
            <Sparkles className={cn("w-3.5 h-3.5 text-[var(--forge-gold)]", pending && "animate-pulse")} />
            {pending ? "AI กำลังอ่าน…" : hasValue ? `ตรวจ ${label} อีกครั้ง` : `ช่วยหา ${label}`}
        </button>
    );

    return (
        <div className="mt-3 chamfered-sm border border-border/70 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
            {/* หัวการ์ด: ผลรวม + ใช้ค่านี้ */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/60">
                <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className="font-display text-lg tabular-nums tracking-wider">{sum.code}</span>
                        <span className="text-[11px] text-muted-foreground">{sum.ready === sum.total ? "ครบแล้ว" : sum.hint}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate" aria-live="polite">{notice}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button type="button" disabled={sum.ready === 0}
                        onClick={() => { onApply(choices); toast.success(sum.ready === sum.total ? `ใช้ ${label} นี้แล้ว` : `ใช้ ${sum.ready} ส่วนที่ได้แล้ว`); setOpen(false); }}
                        className="chamfered-sm border border-[var(--forge-gold)] bg-[var(--forge-gold)]/15 px-3 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                        ใช้ค่านี้
                    </button>
                    <button type="button" aria-label="ปิด" onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {/* แถวสรุปต่อแกน/ด้าน — กดเพื่อกางคำถาม */}
            <div className="divide-y divide-border/50">
                {groups.map((g) => {
                    const gs = groupSummary(choices, g);
                    const inferred = g.ids.filter((id) => aiPicked.has(id) && choices[id] && !quotes[id]).length;
                    const evidenced = g.ids.filter((id) => choices[id] && quotes[id]).length;
                    const review = gs.split || inferred > 0;
                    const isOpen = expanded === g.key;
                    return (
                        <div key={g.key}>
                            <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : g.key)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 transition-colors duration-200 cursor-pointer">
                                <span className="w-24 shrink-0 font-technical text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{g.label}</span>
                                <span className="font-display text-sm tabular-nums min-w-[2.5rem]">{gs.result}</span>
                                <span className="flex-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    {evidenced > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--forge-gold)]" />{evidenced} มีหลักฐาน</span>}
                                    {review && <span className="text-[var(--forge-amber)]">· ควรตรวจ</span>}
                                </span>
                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                            </button>
                            {isOpen && (
                                <ol className="px-3 pb-3 space-y-3 animate-in fade-in duration-150 motion-reduce:animate-none">
                                    {g.ids.map((id) => {
                                        const q = questions.find((x) => x.id === id)!;
                                        return (
                                            <li key={id} className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    {q.prompt}
                                                    {aiPicked.has(id) && choices[id] && !quotes[id] && <span className="text-[10px] text-muted-foreground/70">· AI อนุมาน</span>}
                                                </div>
                                                <div className={cn("grid gap-1.5", q.options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")} role="radiogroup" aria-label={q.prompt}>
                                                    {q.options.map((o) => (
                                                        <button key={o.key} type="button" role="radio" aria-checked={choices[id] === o.key} onClick={() => pick(id, o.key)}
                                                            className={cn("text-left chamfered-sm border px-2.5 py-1.5 text-[11px] leading-relaxed transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.98] motion-reduce:active:scale-100 cursor-pointer",
                                                                choices[id] === o.key ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                                                            {o.text}
                                                        </button>
                                                    ))}
                                                </div>
                                                {quotes[id] && choices[id] && (
                                                    <p className="text-[11px] text-muted-foreground border-l-2 border-[var(--forge-gold)]/40 pl-2">“{quotes[id]}”</p>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const abQs = (qs: { id: string; prompt: string; a: { text: string }; b: { text: string } }[]): Q[] =>
    qs.map((q) => ({ id: q.id, prompt: q.prompt, options: [{ key: "a", text: q.a.text }, { key: "b", text: q.b.text }] }));
const asAB = (c: Choices) => c as Record<string, Choice | null>;

/** MBTI 12 ข้อ — แต่ละแกนได้ตัวอักษรเมื่อตอบไปทางเดียวกัน 2 ใน 3 */
export function MbtiSuggestCard({ characterId, hasValue, onApply, trigger }: {
    characterId: string;
    hasValue: boolean;
    trigger?: number;
    onApply: (values: Partial<Record<MbtiAxis, number>>) => void;
}) {
    const groups = AXES.map((a) => ({ key: a.axis, label: `${a.left} / ${a.right}`, ids: MBTI_QUESTIONS.filter((q) => q.axis === a.axis).map((q) => q.id) }));
    return (
        <SuggestCard label="MBTI" trigger={trigger} hasValue={hasValue} questions={abQs(MBTI_QUESTIONS)} groups={groups} run={() => suggestMbti(characterId)}
            groupSummary={(c, g) => {
                const a = scoreAxes(asAB(c)).find((x) => x.axis === g.key)!;
                return { result: a.letter ?? "?", split: !a.letter || Math.max(a.left, a.right) < 3 };
            }}
            summary={(c) => {
                const axes = scoreAxes(asAB(c));
                return { code: axes.map((a) => a.letter ?? "?").join(""), ready: axes.filter((a) => a.letter).length, total: 4,
                    hint: "แต่ละแกนต้องตอบไปทางเดียวกัน 2 ใน 3 ข้อ" };
            }}
            onApply={(c) => onApply(toSliders(scoreAxes(asAB(c))))} />
    );
}

/** Big Five 15 ข้อ — แต่ละด้านต้องตอบครบ 3 ข้อ ได้คะแนน 1/2/4/5 */
export function BigFiveSuggestCard({ characterId, hasValue, onApply, trigger }: {
    characterId: string;
    hasValue: boolean;
    trigger?: number;
    onApply: (values: Partial<Record<Trait, number>>) => void;
}) {
    const groups = TRAITS.map((t) => ({ key: t.key, label: `${t.key} · ${t.label}`, ids: B5_QUESTIONS.filter((q) => q.trait === t.key).map((q) => q.id) }));
    return (
        <SuggestCard label="Big Five" trigger={trigger} hasValue={hasValue} questions={abQs(B5_QUESTIONS)} groups={groups} run={() => suggestBigFive(characterId)}
            groupSummary={(c, g) => {
                const s = scoreBigFive(asAB(c)).find((x) => x.trait === g.key)!;
                return { result: s.level ? String(s.level) : "?", split: !s.level || s.high === 1 || s.high === 2 };
            }}
            summary={(c) => {
                const s = scoreBigFive(asAB(c));
                return { code: s.map((x) => `${x.trait}${x.level ?? "?"}`).join(" "), ready: s.filter((x) => x.level).length, total: 5,
                    hint: "แต่ละด้านต้องตอบครบ 3 ข้อ" };
            }}
            onApply={(c) => onApply(Object.fromEntries(scoreBigFive(asAB(c)).filter((x) => x.level).map((x) => [x.trait, x.level!])))} />
    );
}

/** Enneagram 6 ข้อ × 9 ตัวเลือก — แนวโน้ม (≥3 เสียงและนำชัด) · ไม่คำนวณปีก */
export function EnneagramSuggestCard({ characterId, hasValue, onApply, trigger }: {
    characterId: string;
    hasValue: boolean;
    trigger?: number;
    onApply: (type: EnnType) => void;
}) {
    const questions: Q[] = ENN_QUESTIONS.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options.map((o) => ({ key: String(o.type), text: o.text })) }));
    const groups = [
        { key: "fear", label: "แรงขับลึก", ids: ["EN-1", "EN-2", "EN-4"] },
        { key: "act", label: "ปฏิกิริยา", ids: ["EN-3", "EN-5", "EN-6"] },
    ];
    const label = (c: Choices) => {
        const s = scoreEnneagram(c);
        return s.type ? `${s.type} · ${ENN_NAMES[s.type]}` : s.top.length ? `ใกล้ ${s.top.join("/")}` : "?";
    };
    return (
        <SuggestCard label="Enneagram" trigger={trigger} hasValue={hasValue} questions={questions} groups={groups} run={() => suggestEnneagram(characterId)}
            groupSummary={(c, g) => {
                const sub = Object.fromEntries(g.ids.map((id) => [id, c[id]]));
                const s = scoreEnneagram(sub);
                const best = s.top[0];
                return { result: best ? String(best) : "?", split: !best || (s.votes[best] ?? 0) < 2 };
            }}
            summary={(c) => {
                const s = scoreEnneagram(c);
                return { code: label(c), ready: s.type ? 1 : 0, total: 1, hint: s.answered < 6 ? "ตอบให้ครบ 6 ข้อ" : "ยังไม่ชัด — ต้องได้ 3 เสียงขึ้นไปและนำชัด" };
            }}
            onApply={(c) => { const t = scoreEnneagram(c).type; if (t) onApply(t); }} />
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
