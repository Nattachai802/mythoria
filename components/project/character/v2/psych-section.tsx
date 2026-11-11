"use client";

import { Plus, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import type { Character } from "@/db/schema";
import type { CharacterPsych } from "@/lib/character-profile";
import { cn } from "@/lib/utils";
import { useSection } from "./use-section";
import { MbtiSuggestCard, BigFiveSuggestCard, EnneagramSuggestCard, CoherencePanel } from "./mbti-suggest-card";
import { SaveBadge } from "./profile-section";
import { FacetExtractCard } from "./facet-extract-card";
import { ENN_DETAILS } from "@/lib/enneagram-suggest";
import { InfoHead, GroupHead, ChipPicker, ScaleBar, BipolarBar, ThinBar, TextBlock } from "./inline-field";

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

/** กลุ่ม ① นิสัย + ② ป้ายเสริม — hook psych ตัวเดียว (แผงเทียบต้องเห็นค่า Big Five ล่าสุด) · after = กลุ่มถัดไป (แรงขับ) */
export function PsychSection({ character, after }: { character: Character; after?: React.ReactNode }) {
    const { value: p, set, state } = useSection<CharacterPsych>(character.id, "psych", character.psych);
    const b5 = (p.bigFive ?? {}) as BigFive;
    const mbti = (p.mbti ?? {}) as Mbti;
    const facets = p.facets ?? [];
    const enn = p.enneagram;

    const mbtiCode = MBTI.every((m) => mbti[m.key] !== undefined)
        ? MBTI.map((m) => ((mbti[m.key] ?? 50) < 50 ? m.left : m.right)).join("")
        : null;

    const [runAll, setRunAll] = useState(0);
    const setFacet = (i: number, patch: Partial<Facet>) =>
        set("facets", facets.map((f, j) => (j === i ? { ...f, ...patch } : f)));

    return (
        <div className="space-y-12">
            <section className="space-y-6">
            <div className="flex items-start gap-3">
                <div className="flex-1"><GroupHead n="①" title="นิสัย" sub="ผู้อ่านจะเห็นตัวละครเป็นคนแบบไหนในฉาก" /></div>
                <SaveBadge state={state} />
                <button type="button" onClick={() => setRunAll((n) => n + 1)}
                    title="ให้ AI อ่านภาพรวมแล้ววิเคราะห์ Big Five, นิสัยเด่น, MBTI และ Enneagram พร้อมกัน (เรียก AI 4 ครั้ง) — ผลขึ้นในการ์ดของแต่ละส่วน กดใช้ทีละส่วน"
                    className="shrink-0 flex items-center gap-1.5 chamfered-sm border border-[var(--forge-gold)] bg-[var(--forge-gold)]/10 px-3 py-1.5 text-xs transition-[background-color,transform] duration-200 hover:bg-[var(--forge-gold)]/20 active:scale-95 motion-reduce:active:scale-100 cursor-pointer">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--forge-gold)]" /> วิเคราะห์ทั้งหมด
                </button>
            </div>

            {/* Big Five: กราฟ + ปุ่มข้างกัน */}
            <div>
            <InfoHead label="บุคลิกภาพ 5 ด้าน (Big Five)" sub="ภาพรวมนิสัย 5 แกน — ระบบที่งานวิจัยรองรับมากที่สุด"
                info={<>
                    <p>ให้คะแนนแต่ละแกน 1–5 (3 = กลาง ๆ) ไม่มีค่าไหนดีหรือแย่ ตัวละครที่น่าสนใจมักมี 1–2 แกนที่สุดทาง</p>
                    <p>O เปิดรับประสบการณ์ · C มีระเบียบวินัย · E เข้าสังคม · A ประนีประนอม · N อารมณ์อ่อนไหว</p>
                    <p>ไม่รู้จะให้เท่าไหร่ กด “ช่วยหา Big Five” ให้ AI อ่านภาพรวมแล้วเสนอ</p>
                </>} />
            <div className="grid sm:grid-cols-[220px_1fr] gap-6 items-center">
                <Radar v={b5} />
                <div className="divide-y divide-border/50">
                    {DOMAINS.map((d) => (
                        <ScaleBar key={d.key} label={`${d.key} · ${d.label}`} lowLabel={d.low} highLabel={d.high}
                            value={b5[d.key]} onChange={(v) => set("bigFive", { ...b5, [d.key]: v })} />
                    ))}
                </div>
            </div>
            <BigFiveSuggestCard characterId={character.id} trigger={runAll} hasValue={DOMAINS.some((d) => b5[d.key] !== undefined)}
                onApply={(v) => set("bigFive", { ...b5, ...v })} />
            </div>

            {/* Facets — ลายเซ็นของตัวละคร */}
            <div>
                <InfoHead label="นิสัยเด่นเฉพาะตัว" sub="สิ่งที่ทำให้ต่างจากคนนิสัยคล้ายกัน · 3–6 ข้อ"
                    info={<>
                        <p>Big Five บอกภาพกว้าง เช่น “ขี้กังวล” แต่คนขี้กังวลมีหลายแบบ — บางคนกลัวถูกทิ้ง บางคนกลัวพลาด</p>
                        <p>ใส่เฉพาะข้อที่เด่นจริง: ตั้งชื่อ เลือกว่ามีมาก (สูง) หรือแทบไม่มี (ต่ำ) ความเข้ม และฉากที่ผู้อ่านจะเห็นนิสัยนี้</p>
                    </>} />
                {facets.map((f, i) => (
                    <div key={i} className="grid sm:grid-cols-[1fr_auto_140px_auto] gap-x-3 gap-y-1 items-center py-2 border-b border-border/50 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                        <input aria-label="ชื่อลักษณะ" placeholder="เช่น ไม่ไว้ใจใคร" value={f.name}
                            onChange={(e) => setFacet(i, { name: e.target.value })}
                            className="bg-transparent text-sm font-medium outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                        <div className="flex text-[10px]" role="radiogroup" aria-label="ทิศทาง">
                            {(["low", "high"] as const).map((dir) => (
                                <button key={dir} type="button" role="radio" aria-checked={f.direction === dir}
                                    onClick={() => setFacet(i, { direction: f.direction === dir ? undefined : dir })}
                                    className={cn("chamfered-sm border px-2.5 py-0.5 transition-colors duration-200 cursor-pointer",
                                        f.direction === dir ? "bg-[var(--forge-gold)]/80 border-[var(--forge-gold)] text-background" : "border-border text-muted-foreground hover:border-[var(--forge-gold)]/60")}>
                                    {dir === "low" ? "ต่ำ" : "สูง"}
                                </button>
                            ))}
                        </div>
                        <ThinBar label="ความเข้ม" value={f.strength ?? 50} onChange={(v) => setFacet(i, { strength: v })} />
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
                <FacetExtractCard characterId={character.id} trigger={runAll} room={12 - facets.length}
                    onAdd={({ facets: nf, contradictions: nc }) => {
                        if (nf.length) set("facets", [...facets, ...nf.map((f) => ({ key: f.key, name: f.name, direction: f.direction, strength: f.strength, scene: f.scene || undefined }))]);
                        if (nc.length) set("contradiction", [p.contradiction, ...nc.map((c) => c.text)].filter(Boolean).join("\n"));
                    }} />
            </div>

            <TextBlock label="นิสัยที่ขัดกันเอง" sub="ด้านที่ดูไม่เข้ากันในคนเดียว (ไม่ใช่ปัญหาในพล็อต)" value={p.contradiction}
                info={<>
                    <p>ตัวละครที่มีสองด้านดูเป็นคนจริงกว่าตัวละครที่นิสัยไปทางเดียวหมด</p>
                    <p>ปัญหาที่ขวางเป้าหมายของตัวละคร ให้เขียนที่ “ความขัดแย้ง” ในมิติตัวละครด้านล่าง</p>
                </>}
                onChange={(v) => set("contradiction", v)} placeholder="เช่น ใจดีกับคนแปลกหน้า แต่ใจร้ายกับคนในบ้าน" />

            </section>

            <section className="space-y-6">
            <GroupHead n="②" title="ป้ายเสริม" sub="ส่วนเสริมของนิสัย ไม่จำเป็นต้องกรอก — ใช้เป็นทางลัด หรือกับตัวร้าย / แอนตี้ฮีโร่" />
            <div className="grid sm:grid-cols-2 gap-x-8">
                <ChipPicker label="ความซื่อสัตย์เมื่อไม่มีใครเห็น" sub="จะโกงหรือเอาเปรียบไหมถ้าทำได้" value={p.honestyHumility} onChange={(v) => set("honestyHumility", v)}
                    info={<>
                        <p><b>เอาเปรียบได้</b> — ประจบเพื่อได้ประโยชน์ โกงถ้าคุ้มและไม่โดนจับ อยากรวยอยากมีหน้ามีตา คิดว่าตัวเองสมควรได้มากกว่าคนอื่น</p>
                        <p><b>ซื่อแม้เสียประโยชน์</b> — ไม่โกงแม้ไม่มีใครรู้ ไม่อวด ไม่สนสถานะ</p>
                        <p>ต่างจาก “ประนีประนอม”: คนพูดเพราะอาจโกงได้ คนปากร้ายอาจซื่อมาก (มิติ H จากโมเดล HEXACO)</p>
                    </>}
                    options={[{ value: "low", label: "เอาเปรียบได้" }, { value: "mid", label: "แล้วแต่สถานการณ์" }, { value: "high", label: "ซื่อแม้เสียประโยชน์" }]} />
                <ChipPicker label="ด้านมืด" sub="สำหรับตัวร้าย / แอนตี้ฮีโร่ · ตัวละครทั่วไปเลือก &quot;ไม่มี&quot;" value={p.darkPattern} onChange={(v) => set("darkPattern", v)}
                    info={<>
                        <p><b>นักวางแผน</b> — เย็นชา คำนวณ หลอกใช้คนเป็นเกมยาว</p>
                        <p><b>หลงตัวเอง</b> — ต้องการคำชม โอ้อวด พังเมื่อถูกดูถูก (จุดอ่อนที่ฝ่ายตรงข้ามใช้ได้)</p>
                        <p><b>ไร้ความรู้สึก</b> — หุนหัน ไม่กลัว ไม่สำนึกผิด</p>
                        <p>ทั้งสามแบบมักประนีประนอมต่ำและซื่อสัตย์ต่ำ ที่เหลือต่างกัน</p>
                    </>}
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
                    <InfoHead label="MBTI" sub="ทางลัดยอดนิยม · ไม่บอกความหวั่นไหวทางอารมณ์ (ดูแกน N)"
                        right={<span className="font-display text-lg tabular-nums">{mbtiCode ?? "—"}</span>}
                        info={<>
                            <p>4 แกน: E/I พลังจากคนหรือจากตัวเอง · S/N เชื่อสิ่งที่เห็นหรือมองภาพรวม · T/F ตัดสินด้วยเหตุผลหรือคุณค่า · J/P ชอบวางแผนหรือยืดหยุ่น</p>
                            <p>ยิ่งดึงไปสุดทาง ยิ่งชัด กลาง ๆ = ก้ำกึ่ง · MBTI เป็นป้ายเรียกง่าย ใช้คู่กับ Big Five ดีกว่าใช้แทน</p>
                        </>} />
                    {MBTI.map((m) => (
                        <BipolarBar key={m.key} left={m.left} right={m.right} label={`${m.left} หรือ ${m.right}`}
                            value={mbti[m.key]} onChange={(v) => set("mbti", { ...mbti, [m.key]: v })} />
                    ))}
                    <MbtiSuggestCard characterId={character.id} trigger={runAll} hasValue={!!mbtiCode}
                        onApply={(v) => set("mbti", { ...mbti, ...v })} />
                </div>

                <div>
                    <InfoHead label="Enneagram" sub="ความกลัวและความปรารถนาลึก ๆ · งานวิจัยรองรับน้อย"
                        right={<span className="font-display text-lg">{enn ? `${enn.type}${enn.wing ? `w${enn.wing}` : ""} · ${ENNEAGRAM[enn.type]}` : "—"}</span>}
                        info={<>
                            <p>9 แบบ แต่ละแบบมีความกลัวลึก ๆ ที่ขับพฤติกรรม เลือกแล้วจะมีคำอธิบายขึ้นด้านล่าง</p>
                            <p>ปีก = แบบข้างเคียงที่เติมสีให้ (เลือกหรือไม่ก็ได้) · ใช้เป็นแรงบันดาลใจเรื่องแรงขับ ไม่ใช่ตัวทำนายนิสัย</p>
                        </>} />
                    <div className="flex gap-1" role="radiogroup" aria-label="Enneagram type">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={enn?.type === n} title={ENNEAGRAM[n]} aria-label={`${n} ${ENNEAGRAM[n]}`}
                                onClick={() => set("enneagram", enn?.type === n ? undefined : { type: n })}
                                className={cn("h-7 flex-1 chamfered-sm border text-xs tabular-nums cursor-pointer transition-[color,background-color,border-color,transform] duration-200 active:scale-95 motion-reduce:active:scale-100",
                                    enn?.type === n ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/80 text-background font-semibold" : "border-border text-muted-foreground hover:border-[var(--forge-gold)]/60 hover:text-foreground")}>
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
                                    className={cn("chamfered-sm border px-2.5 py-0.5 transition-colors duration-200 cursor-pointer",
                                        enn.wing === w ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/80 text-background" : "border-border hover:border-[var(--forge-gold)]/60 hover:text-foreground")}>
                                    w{w} · {ENNEAGRAM[w]}
                                </button>
                            ))}
                        </div>
                    )}
                    {enn && (() => {
                        const d = ENN_DETAILS[enn.type];
                        const rows: [string, string][] = [["กลัวลึก ๆ", d.fear], ["ปรารถนาลึก ๆ", d.desire], ["ตอนเครียด", d.stress], ["ตอนมั่นคง", d.secure], ["ใช้ในฉาก", d.scene]];
                        if (enn.wing) rows.push([`ปีก w${enn.wing}`, ENN_DETAILS[enn.wing].asWing]);
                        return (
                            <dl className="mt-3 border-l-2 border-[var(--forge-gold)] pl-3 py-1 space-y-1 text-xs animate-in fade-in duration-200 motion-reduce:animate-none">
                                {rows.map(([k, v]) => (
                                    <div key={k} className="grid grid-cols-[88px_1fr] gap-2">
                                        <dt className="text-muted-foreground">{k}</dt><dd>{v}</dd>
                                    </div>
                                ))}
                            </dl>
                        );
                    })()}
                    <EnneagramSuggestCard characterId={character.id} trigger={runAll} hasValue={!!enn}
                        onApply={(t) => set("enneagram", { type: t, wing: enn?.type === t ? enn.wing : undefined })} />
                </div>
            </div>
            <CoherencePanel mbti={mbti} bigFive={b5} />
            </section>
            {after}
        </div>
    );
}
