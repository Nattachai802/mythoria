"use client";

import { Plus, X } from "lucide-react";
import { motion } from "motion/react";
import type { Character } from "@/db/schema";
import type { CharacterPsych } from "@/lib/character-profile";
import { cn } from "@/lib/utils";
import { useSection } from "./use-section";
import { MbtiSuggestCard, BigFiveSuggestCard, CoherencePanel } from "./mbti-suggest-card";
import { SaveBadge } from "./profile-section";
import { ChipPicker, LevelPicker, TextBlock } from "./inline-field";

type BigFive = NonNullable<CharacterPsych["bigFive"]>;
type Mbti = NonNullable<CharacterPsych["mbti"]>;
type Facet = NonNullable<CharacterPsych["facets"]>[number];

const DOMAINS: { key: keyof BigFive; label: string; low: string; high: string }[] = [
    { key: "O", label: "เปิดรับประสบการณ์", low: "ยึดของเดิม", high: "ใฝ่รู้ ชอบของใหม่" },
    { key: "C", label: "มีระเบียบวินัย", low: "ตามใจ ยืดหยุ่น", high: "วางแผน รับผิดชอบ" },
    { key: "E", label: "เข้าสังคม", low: "เก็บตัว", high: "ชอบคน มีพลัง" },
    { key: "A", label: "ประนีประนอม", low: "แข็ง ตรง ไม่ยอม", high: "อ่อนโยน ไว้ใจคน" },
    { key: "N", label: "อารมณ์อ่อนไหว", low: "นิ่ง มั่นคง", high: "กังวล หวั่นไหวง่าย" },
];

const MBTI: { key: keyof Mbti; left: string; right: string }[] = [
    { key: "EI", left: "E", right: "I" },
    { key: "SN", left: "S", right: "N" },
    { key: "TF", left: "T", right: "F" },
    { key: "JP", left: "J", right: "P" },
];

const ENNEAGRAM = ["", "นักปฏิรูป", "ผู้ให้", "ผู้ใฝ่สำเร็จ", "ปัจเจก", "นักสังเกต", "ผู้ภักดี", "นักผจญภัย", "ผู้ท้าทาย", "ผู้สร้างสันติ"];

/** เรดาร์ 5 แกน — SVG ล้วน ไม่ต้องลง chart lib; ค่า 1–5 ขยายจากศูนย์กลาง */
function Radar({ v }: { v: BigFive }) {
    const size = 200, c = size / 2, R = 72;
    const pt = (i: number, r: number) => {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
    };
    const poly = (r: (i: number) => number) => DOMAINS.map((_, i) => pt(i, r(i)).join(",")).join(" ");
    const has = DOMAINS.some((d) => v[d.key]);
    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto" role="img"
            aria-label={`Big Five: ${DOMAINS.map((d) => `${d.key} ${v[d.key] ?? "-"}`).join(", ")}`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <polygon key={n} points={poly(() => (R * n) / 5)} fill="none" className="stroke-border" strokeWidth={0.75} />
            ))}
            {DOMAINS.map((d, i) => {
                const [x, y] = pt(i, R);
                const [lx, ly] = pt(i, R + 16);
                return (
                    <g key={d.key}>
                        <line x1={c} y1={c} x2={x} y2={y} className="stroke-border" strokeWidth={0.75} />
                        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px] font-technical">
                            {d.key}{v[d.key] ? ` ${v[d.key]}` : ""}
                        </text>
                    </g>
                );
            })}
            {has && (
                <motion.polygon initial={false} animate={{ points: poly((i) => (R * (v[DOMAINS[i].key] ?? 0)) / 5) }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    fill="var(--forge-gold)" fillOpacity={0.25} stroke="var(--forge-gold)" strokeWidth={1.5} />
            )}
        </svg>
    );
}

export function PsychSection({ character }: { character: Character }) {
    const { value: p, set, state } = useSection<CharacterPsych>(character.id, "psych", character.psych);
    const b5 = (p.bigFive ?? {}) as BigFive;
    const mbti = (p.mbti ?? {}) as Mbti;
    const facets = p.facets ?? [];
    const enn = p.enneagram;

    const mbtiCode = MBTI.every((m) => mbti[m.key] !== undefined)
        ? MBTI.map((m) => ((mbti[m.key] ?? 50) < 50 ? m.left : m.right)).join("")
        : null;

    const setFacet = (i: number, patch: Partial<Facet>) =>
        set("facets", facets.map((f, j) => (j === i ? { ...f, ...patch } : f)));

    return (
        <div className="space-y-8">
            <div className="flex justify-end -mt-1"><SaveBadge state={state} /></div>

            {/* Big Five: กราฟ + ปุ่มข้างกัน */}
            <div className="grid sm:grid-cols-[220px_1fr] gap-6 items-center">
                <Radar v={b5} />
                <div className="divide-y divide-border/50">
                    {DOMAINS.map((d) => (
                        <LevelPicker key={d.key} label={`${d.key} · ${d.label}`} lowLabel={d.low} highLabel={d.high}
                            value={b5[d.key]} onChange={(v) => set("bigFive", { ...b5, [d.key]: v })} />
                    ))}
                </div>
            </div>
            <BigFiveSuggestCard characterId={character.id} hasValue={DOMAINS.some((d) => b5[d.key] !== undefined)}
                onApply={(v) => set("bigFive", { ...b5, ...v })} />

            {/* Facets — ลายเซ็นของตัวละคร */}
            <div>
                <div className="flex items-baseline justify-between mb-1">
                    <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">ลักษณะเด่น (facet)</span>
                    <span className="text-[10px] text-muted-foreground">3–6 ข้อ แต่ละข้อมีฉากที่เห็นได้</span>
                </div>
                {facets.map((f, i) => (
                    <div key={i} className="grid sm:grid-cols-[1fr_auto_120px_auto] gap-2 items-center py-1.5 border-b border-border/50 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                        <input aria-label="ชื่อลักษณะ" placeholder="เช่น ไม่ไว้ใจใคร" value={f.name}
                            onChange={(e) => setFacet(i, { name: e.target.value })}
                            className="bg-transparent text-sm font-medium outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                        <div className="flex gap-1">
                            {(["low", "high"] as const).map((dir) => (
                                <button key={dir} type="button" aria-pressed={f.direction === dir}
                                    onClick={() => setFacet(i, { direction: f.direction === dir ? undefined : dir })}
                                    className={cn("chamfered-sm border px-2 py-0.5 text-[10px] cursor-pointer",
                                        f.direction === dir ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/15" : "border-border text-muted-foreground")}>
                                    {dir === "low" ? "ต่ำ" : "สูง"}
                                </button>
                            ))}
                        </div>
                        <input type="range" min={0} max={100} aria-label="ความเข้ม" value={f.strength ?? 50}
                            onChange={(e) => setFacet(i, { strength: Number(e.target.value) })}
                            className="accent-[var(--forge-gold)] cursor-pointer" />
                        <button type="button" aria-label={`ลบ ${f.name || "ลักษณะนี้"}`} onClick={() => set("facets", facets.filter((_, j) => j !== i))}
                            className="p-1 text-muted-foreground hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        <input aria-label="ฉากที่เห็นลักษณะนี้" placeholder="ฉากที่เห็น: เช่น นับเงินทอนต่อหน้าคนขายทุกครั้ง" value={f.scene ?? ""}
                            onChange={(e) => setFacet(i, { scene: e.target.value || undefined })}
                            className="sm:col-span-4 bg-transparent text-xs text-muted-foreground outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                    </div>
                ))}
                {facets.length < 12 && (
                    // ponytail: แถวใหม่ใส่ชื่อชั่วคราวเพราะ schema บังคับชื่อ — ผู้ใช้พิมพ์ทับได้เลย
                    <button type="button" onClick={() => set("facets", [...facets, { name: "ลักษณะใหม่", strength: 50 }])}
                        className="flex items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                        <Plus className="w-3.5 h-3.5" /> เพิ่มลักษณะ
                    </button>
                )}
            </div>

            <TextBlock label="ความขัดแย้งในตัว" hint="ด้านที่ดูไม่เข้ากับภาพรวม" value={p.contradiction}
                onChange={(v) => set("contradiction", v)} placeholder="เช่น ใจดีกับคนแปลกหน้า แต่ใจร้ายกับคนในบ้าน" />

            <div className="grid sm:grid-cols-2 gap-x-8">
                <ChipPicker label="ความซื่อตรง-ถ่อมตน (H)" value={p.honestyHumility} onChange={(v) => set("honestyHumility", v)}
                    options={[{ value: "low", label: "ต่ำ" }, { value: "mid", label: "กลาง" }, { value: "high", label: "สูง" }]} />
                <ChipPicker label="ด้านมืด" value={p.darkPattern} onChange={(v) => set("darkPattern", v)}
                    options={[
                        { value: "none", label: "ไม่มี" },
                        { value: "machiavellian", label: "นักวางแผน", hint: "Machiavellian: เย็นชา คำนวณ เล่นเกมยาว" },
                        { value: "narcissist", label: "หลงตัวเอง", hint: "Narcissist: ต้องการคำชม โอ้อวด" },
                        { value: "psychopathic", label: "ไร้ความรู้สึก", hint: "Psychopathic: หุนหัน ไม่กลัว ไม่สำนึก" },
                    ]} />
            </div>

            {/* ป้ายแบบทดสอบยอดนิยม — เป็นทางลัด ไม่ใช่ตัวทำนาย */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">MBTI</span>
                        <span className="font-display text-lg tabular-nums">{mbtiCode ?? "—"}</span>
                    </div>
                    {MBTI.map((m) => (
                        <div key={m.key} className="flex items-center gap-2 py-1">
                            <span className={cn("w-4 text-xs font-technical", (mbti[m.key] ?? 50) < 50 && "text-[var(--forge-amber)] font-bold")}>{m.left}</span>
                            <input type="range" min={0} max={100} aria-label={`${m.left} หรือ ${m.right}`}
                                value={mbti[m.key] ?? 50}
                                onChange={(e) => set("mbti", { ...mbti, [m.key]: Number(e.target.value) })}
                                className={cn("flex-1 accent-[var(--forge-gold)] cursor-pointer", mbti[m.key] === undefined && "opacity-40")} />
                            <span className={cn("w-4 text-xs font-technical text-right", (mbti[m.key] ?? 50) >= 50 && mbti[m.key] !== undefined && "text-[var(--forge-amber)] font-bold")}>{m.right}</span>
                        </div>
                    ))}
                    <p className="mt-1 text-[10px] text-muted-foreground">MBTI ไม่บอกเรื่องความหวั่นไหวทางอารมณ์ — ดูแกน N ด้านบน</p>
                </div>

                <div>
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">Enneagram</span>
                        <span className="text-sm">{enn ? `${enn.type}${enn.wing ? `w${enn.wing}` : ""} · ${ENNEAGRAM[enn.type]}` : "—"}</span>
                    </div>
                    <div className="grid grid-cols-9 gap-1" role="radiogroup" aria-label="Enneagram type">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={enn?.type === n} title={ENNEAGRAM[n]}
                                onClick={() => set("enneagram", enn?.type === n ? undefined : { type: n })}
                                className={cn("aspect-square chamfered-sm border text-xs tabular-nums cursor-pointer transition-[color,background-color,border-color,transform] duration-200 active:scale-95 motion-reduce:active:scale-100",
                                    enn?.type === n ? "border-[var(--forge-gold)] bg-[var(--forge-gold)] text-background" : "border-border text-muted-foreground hover:border-[var(--forge-gold)]/60")}>
                                {n}
                            </button>
                        ))}
                    </div>
                    {enn && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            ปีก:
                            {[enn.type === 1 ? 9 : enn.type - 1, enn.type === 9 ? 1 : enn.type + 1].map((w) => (
                                <button key={w} type="button" aria-pressed={enn.wing === w}
                                    onClick={() => set("enneagram", { type: enn.type, wing: enn.wing === w ? undefined : w })}
                                    className={cn("chamfered-sm border px-2 py-0.5 cursor-pointer",
                                        enn.wing === w ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/15 text-foreground" : "border-border")}>
                                    w{w} · {ENNEAGRAM[w]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <MbtiSuggestCard characterId={character.id} hasValue={!!mbtiCode}
                onApply={(v) => set("mbti", { ...mbti, ...v })} />
            <CoherencePanel mbti={mbti} bigFive={b5} />
        </div>
    );
}
