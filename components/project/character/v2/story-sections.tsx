"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Character } from "@/db/schema";
import { ARC_TYPES, type CharacterArc, type CharacterMotive, type CharacterNarration } from "@/lib/character-profile";
import { useSection } from "./use-section";
import { SaveBadge } from "./profile-section";
import { ChipPicker, InfoHead, TextBlock } from "./inline-field";

export interface ChapterOption { id: string; title: string; orderIndex: number }

function GroupTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
    return (
        <div className="flex items-baseline justify-between mb-1">
            <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{children}</span>
            {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
        </div>
    );
}

function ChapterSelect({ value, onChange, chapters, label }: {
    value: string | undefined; onChange: (v: string | undefined) => void; chapters: ChapterOption[]; label: string;
}) {
    return (
        <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}
            className="bg-transparent text-xs text-muted-foreground outline-none cursor-pointer max-w-[180px]">
            <option value="">— บท —</option>
            {chapters.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.title}</option>)}
        </select>
    );
}

/* ───────────── แรงจูงใจ ───────────── */

export function MotiveSection({ character }: { character: Character }) {
    const { value: m, set, state } = useSection<CharacterMotive>(character.id, "motive", character.motive);
    return (
        <div className="space-y-2">
            <InfoHead label="กลไกการเปลี่ยนแปลง" sub="สิ่งที่ทำให้ตัวละครเปลี่ยน (หรือไม่เปลี่ยน) ตลอดเรื่อง"
                right={<SaveBadge state={state} />}
                info={<>
                    <p><b>วิธีที่ใช้ไปให้ถึง</b> — กลยุทธ์ที่ใช้ไล่ตามเป้าหมาย มักเป็นสิ่งที่ต้องเลิกใช้ตอนท้าย</p>
                    <p><b>ความเชื่อผิด ๆ</b> — สิ่งที่ตัวละครเชื่อแต่ไม่จริง และเรื่องจะพิสูจน์ว่าผิด</p>
                    <p><b>คุณค่าที่ยึดถือ</b> — สิ่งที่ยอมเสียทุกอย่างเพื่อรักษา</p>
                    <p><b>จุดกดดัน</b> — สถานการณ์ที่บีบแล้วตัวละครต้องเลือก จุดนี้คือที่ที่การเปลี่ยนแปลงเกิด</p>
                    <p><b>บาดแผลในอดีต</b> — เหตุการณ์ที่ทำให้เชื่อผิดแบบนั้น</p>
                    <p>นิสัย (Big Five) มักคงเดิม สิ่งที่เปลี่ยนตาม arc คือกลยุทธ์และความเชื่อ</p>
                </>} />
            {character.goals && (
                <div className="py-1.5">
                    <div className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">ต้องการ (จากเป้าหมายในมิติตัวละคร)</div>
                    <p className="mt-1 text-sm whitespace-pre-line">{String(character.goals)}</p>
                </div>
            )}
            <div className="grid sm:grid-cols-2 gap-x-8">
                <TextBlock label="วิธีที่ใช้ไปให้ถึง" hint="กลยุทธ์ที่ใช้" value={m.strategy} onChange={(v) => set("strategy", v)} placeholder="ทำอะไรเพื่อได้สิ่งที่ต้องการ" />
                <TextBlock label="ความเชื่อผิด ๆ" hint="เรื่องจะพิสูจน์ว่าผิด" value={m.lie} onChange={(v) => set("lie", v)} placeholder="เช่น ถ้าไม่เข้มแข็ง จะไม่มีใครรัก" />
                <TextBlock label="คุณค่าที่ยึดถือ" value={m.value} onChange={(v) => set("value", v)} placeholder="สิ่งที่ยอมเสียทุกอย่างเพื่อรักษา" />
                <TextBlock label="จุดกดดัน" hint="บีบตรงนี้แล้วต้องเลือก" value={m.pressurePoint} onChange={(v) => set("pressurePoint", v)} />
                <TextBlock label="บาดแผลในอดีต" value={m.wound} onChange={(v) => set("wound", v)} placeholder="เหตุการณ์ที่ทำให้เชื่อแบบนั้น" />
            </div>
        </div>
    );
}

/* ───────────── พัฒนาการ (arc) ───────────── */

const ARC_LABEL: Record<(typeof ARC_TYPES)[number], { label: string; hint: string }> = {
    growth: { label: "เติบโต", hint: "ทิ้งความเชื่อผิด กลายเป็นคนที่ดีขึ้น" },
    fall: { label: "ตกต่ำ", hint: "ยึดความเชื่อผิดแน่นขึ้น หรือทิ้งความเชื่อที่ถูก" },
    flat: { label: "คงที่", hint: "ตัวละครไม่เปลี่ยน แต่เปลี่ยนโลกรอบตัว" },
    undecided: { label: "ยังไม่ตัดสิน", hint: "" },
};

/** กราฟเส้นต่อบท — กด/ลากในคอลัมน์ของบทเพื่อกำหนดค่า 0–100 (บนสุด = เชื่อเต็มที่) */
function ArcChart({ points, chapters, onChange }: {
    points: NonNullable<CharacterArc["points"]>; chapters: ChapterOption[];
    onChange: (p: NonNullable<CharacterArc["points"]>) => void;
}) {
    const svg = useRef<SVGSVGElement>(null);
    const [drag, setDrag] = useState(false);
    const W = 600, H = 160, PAD = 12;
    const n = chapters.length;
    // จุดของบทที่ถูกลบไปแล้วไม่มี FK — กรองทิ้งตอนแสดง (ข้อมูลยังอยู่จนกว่าจะแก้กราฟครั้งถัดไป)
    const byId = new Map(points.map((p) => [p.chapterId, p.value]));
    const x = (i: number) => PAD + (n <= 1 ? (W - PAD * 2) / 2 : (i * (W - PAD * 2)) / (n - 1));
    const y = (v: number) => PAD + ((100 - v) * (H - PAD * 2)) / 100;

    const setAt = (e: React.PointerEvent) => {
        const r = svg.current!.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const py = ((e.clientY - r.top) / r.height) * H;
        const i = n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - PAD) * (n - 1)) / (W - PAD * 2))));
        const v = Math.max(0, Math.min(100, Math.round(100 - ((py - PAD) * 100) / (H - PAD * 2))));
        const id = chapters[i].id;
        const live = points.filter((p) => chapters.some((c) => c.id === p.chapterId) && p.chapterId !== id);
        onChange([...live, { chapterId: id, value: v }]);
    };

    if (n === 0) return <p className="py-6 text-center text-xs text-muted-foreground">ยังไม่มีบท — เขียนบทแรกก่อน แล้วกลับมาวาดเส้นพัฒนาการ</p>;

    const line = chapters.map((c, i) => (byId.has(c.id) ? `${x(i)},${y(byId.get(c.id)!)}` : null)).filter(Boolean).join(" ");

    return (
        <div>
            <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full h-40 touch-none cursor-crosshair select-none"
                role="img" aria-label={`กราฟความเชื่อ ${points.length} จุด จาก ${n} บท`}
                onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(true); setAt(e); }}
                onPointerMove={(e) => drag && setAt(e)}
                onPointerUp={() => setDrag(false)}>
                {[0, 50, 100].map((v) => (
                    <line key={v} x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray={v === 50 ? "3 3" : undefined} strokeWidth={0.75} />
                ))}
                {chapters.map((c, i) => <line key={c.id} x1={x(i)} x2={x(i)} y1={PAD} y2={H - PAD} className="stroke-border/40" strokeWidth={0.5} />)}
                {line && <polyline points={line} fill="none" stroke="var(--forge-gold)" strokeWidth={2} />}
                {chapters.map((c, i) => byId.has(c.id) && (
                    <circle key={c.id} cx={x(i)} cy={y(byId.get(c.id)!)} r={4} fill="var(--forge-gold)" />
                ))}
            </svg>
            <div className="flex justify-between text-[9px] text-muted-foreground font-technical">
                <span>บท 1</span>
                <span>กด/ลากในกราฟเพื่อวาง · บน = เชื่อเต็มที่ ล่าง = ไม่เชื่อแล้ว</span>
                <span>บท {n}</span>
            </div>
            {points.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="mt-1 text-[10px] text-muted-foreground hover:text-red-500 cursor-pointer">ล้างกราฟ</button>
            )}
        </div>
    );
}

const STAGES = [
    { stage: "start", label: "จุดเริ่ม", hint: "เชื่ออะไร ใช้ชีวิตแบบไหน" },
    { stage: "turn", label: "จุดหักเห", hint: "เหตุการณ์ที่บังคับให้ต้องเลือก" },
    { stage: "end", label: "จุดจบ", hint: "กลายเป็นใคร" },
] as const;

export function ArcSection({ character, chapters }: { character: Character; chapters: ChapterOption[] }) {
    const { value: a, set, state } = useSection<CharacterArc>(character.id, "arc", character.arc);
    const stages = a.stages ?? [];
    const stageOf = (s: (typeof STAGES)[number]["stage"]) => stages.find((x) => x.stage === s);
    const setStage = (s: (typeof STAGES)[number]["stage"], patch: { text?: string; chapterId?: string }) => {
        const cur = stageOf(s) ?? { stage: s };
        set("stages", [...stages.filter((x) => x.stage !== s), { ...cur, ...patch }]);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end -mt-1"><SaveBadge state={state} /></div>
            <ChipPicker label="ชนิดพัฒนาการ" value={a.type} onChange={(v) => set("type", v)}
                options={ARC_TYPES.map((t) => ({ value: t, label: ARC_LABEL[t].label, hint: ARC_LABEL[t].hint }))} />
            <TextBlock label="ความเชื่อที่ติดตาม" hint="เส้นกราฟวัดสิ่งนี้" value={a.trackedBelief}
                onChange={(v) => set("trackedBelief", v)} placeholder="เช่น ไว้ใจใครไม่ได้นอกจากตัวเอง" />
            <ArcChart points={a.points ?? []} chapters={chapters} onChange={(p) => set("points", p)} />
            <div>
                <GroupTitle>สามจังหวะ</GroupTitle>
                <div className="grid sm:grid-cols-3 gap-4">
                    {STAGES.map((s) => (
                        <div key={s.stage} className="border-t-2 border-[var(--forge-gold)]/40 pt-1">
                            <TextBlock label={s.label} value={stageOf(s.stage)?.text} onChange={(v) => setStage(s.stage, { text: v })} placeholder={s.hint} />
                            <ChapterSelect label={`บทของ${s.label}`} chapters={chapters} value={stageOf(s.stage)?.chapterId}
                                onChange={(v) => setStage(s.stage, { chapterId: v })} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ───────────── การเล่าเรื่อง ───────────── */

export function NarrationSection({ character, chapters }: { character: Character; chapters: ChapterOption[] }) {
    const { value: nr, set, state } = useSection<CharacterNarration>(character.id, "narration", character.narration);
    const secrets = nr.secrets ?? [];
    const order = new Map(chapters.map((c, i) => [c.id, i + 1]));

    return (
        <div className="space-y-4">
            <div className="flex justify-end -mt-1"><SaveBadge state={state} /></div>
            <ChipPicker label="มุมมองที่ใช้เล่า" value={nr.pov} onChange={(v) => set("pov", v)} options={[
                { value: "first", label: "บุรุษที่ 1", hint: "ผู้อ่านอยู่ในหัวตัวละคร" },
                { value: "third_close", label: "บุรุษที่ 3 ใกล้ชิด", hint: "เล่าแบบ \"เขา\" แต่รู้ความคิด" },
                { value: "third_distant", label: "บุรุษที่ 3 ห่าง", hint: "เห็นแค่การกระทำ" },
                { value: "other_eyes", label: "ผ่านสายตาคนอื่น", hint: "ไม่มีฉากในหัวตัวเอง" },
            ]} />
            <TextBlock label="อยากให้ผู้อ่านรู้สึกอย่างไร" value={nr.readerFeeling} onChange={(v) => set("readerFeeling", v)}
                placeholder="เช่น ไม่ไว้ใจในครึ่งแรก แล้วสงสารเมื่อรู้ความจริง" />
            <div>
                <GroupTitle hint="ผู้อ่านรู้เมื่อไหร่">ความลับ</GroupTitle>
                {secrets.map((s, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center py-1.5 border-b border-border/50 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                        <input aria-label="ความลับ" value={s.text}
                            onChange={(e) => set("secrets", secrets.map((x, j) => (j === i ? { ...x, text: e.target.value || " " } : x)))}
                            className="bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            เฉลย
                            <ChapterSelect label="บทที่เฉลย" chapters={chapters} value={s.revealChapterId}
                                onChange={(v) => set("secrets", secrets.map((x, j) => (j === i ? { ...x, revealChapterId: v } : x)))} />
                            {s.revealChapterId && !order.has(s.revealChapterId) && <span className="text-red-500">(บทถูกลบ)</span>}
                        </span>
                        <button type="button" aria-label="ลบความลับนี้" onClick={() => set("secrets", secrets.filter((_, j) => j !== i))}
                            className="p-1 text-muted-foreground hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
                <button type="button" onClick={() => set("secrets", [...secrets, { text: "ความลับใหม่" }])}
                    className="flex items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> เพิ่มความลับ
                </button>
            </div>
        </div>
    );
}
