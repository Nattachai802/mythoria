"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCharacterFieldDef, deleteCharacterFieldDef } from "@/server/character-field";
import { FIELD_TYPES, type FieldType } from "@/lib/character-profile";
import { aiQuote } from "@/lib/character-autofill";
import { Plus, X } from "lucide-react";
import type { Character, CharacterFieldDef } from "@/db/schema";
import type { CharacterProfile, CharacterCustomValues } from "@/lib/character-profile";
import { useSection, type SaveState } from "./use-section";
import { InlineField, LevelPicker, numOrUndef } from "./inline-field";

type Identity = NonNullable<CharacterProfile["identity"]>;
type Body = NonNullable<CharacterProfile["body"]>;
type Social = NonNullable<CharacterProfile["social"]>;
type Speech = NonNullable<CharacterProfile["speech"]>;
type FamilyRow = NonNullable<CharacterProfile["family"]>[number];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2.5 mb-1">
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground whitespace-nowrap">{title}</span>
                <span className="flex-1 h-px bg-border/50" />
            </div>
            <div className="divide-y divide-border/50">{children}</div>
        </div>
    );
}

export function SaveBadge({ state }: { state: SaveState }) {
    // "บันทึกแล้ว" หายเองหลัง 2 วินาที · error ค้างไว้จนกว่าจะบันทึกใหม่
    const [hidden, setHidden] = useState(false);
    useEffect(() => {
        setHidden(false); // eslint-disable-line react-hooks/set-state-in-effect
        if (state !== "saved") return;
        const t = setTimeout(() => setHidden(true), 2000);
        return () => clearTimeout(t);
    }, [state]);
    const text = { idle: "", saving: "กำลังบันทึก…", saved: "บันทึกแล้ว", error: "บันทึกไม่สำเร็จ" }[state];
    return (
        <span aria-live="polite" className={cn(
            "text-[10px] transition-opacity duration-300",
            state === "error" ? "text-red-500" : "text-muted-foreground",
            hidden || !text ? "opacity-0" : "opacity-100",
        )}>
            {text}
        </span>
    );
}

/** ส่วนสูงเทียบกับคนทั่วไป 150/170/190 ซม. — บอกด้วยตัวเลขด้วย ไม่ใช้สีอย่างเดียว */
function HeightChart({ cm }: { cm?: number }) {
    if (!cm) return null;
    const max = Math.max(200, cm);
    const bars = [
        { label: "150", h: 150 },
        { label: "170", h: 170 },
        { label: "190", h: 190 },
        { label: "ตัวละคร", h: cm, me: true },
    ];
    return (
        <div className="flex items-end gap-2 h-20 pt-2" aria-label={`ส่วนสูง ${cm} ซม.`}>
            {bars.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                        className={b.me ? "w-full bg-[var(--forge-gold)] transition-[height] duration-500 ease-out" : "w-full bg-muted"}
                        style={{ height: `${(b.h / max) * 100}%` }}
                    />
                    <span className="mt-1 text-[9px] tabular-nums text-muted-foreground">{b.me ? `${cm}` : b.label}</span>
                </div>
            ))}
        </div>
    );
}

/** เพิ่ม/ลบช่องที่ผู้เขียนตั้งเอง (ใช้ร่วมทุกตัวละครในนิยาย) — ลบช่องแล้วค่าที่กรอกไว้ยังอยู่ใน DB */
function FieldManager({ novelId, fieldDefs }: { novelId: string; fieldDefs: CharacterFieldDef[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState("");
    const [type, setType] = useState<FieldType>("text");
    const [options, setOptions] = useState("");
    const [pending, start] = useTransition();
    const TYPE_LABEL: Record<FieldType, string> = { text: "ข้อความ", number: "ตัวเลข", select: "ตัวเลือก" };

    const add = () => start(async () => {
        const opts = options.split(",").map((o) => o.trim()).filter(Boolean);
        if (type === "select" && opts.length === 0) { toast.error("ใส่ตัวเลือกอย่างน้อย 1 ค่า คั่นด้วยจุลภาค"); return; }
        const res = await createCharacterFieldDef(novelId, { label, type, options: type === "select" ? opts : undefined, position: fieldDefs.length });
        if (!res.success) { toast.error("เพิ่มช่องไม่สำเร็จ", { description: res.error }); return; }
        setLabel(""); setOptions(""); router.refresh();
    });
    const remove = (f: CharacterFieldDef) => {
        if (!confirm(`ลบช่อง "${f.label}" ออกจากทุกตัวละคร?\nค่าที่กรอกไว้ยังเก็บอยู่ แต่จะไม่แสดง`)) return;
        start(async () => {
            const res = await deleteCharacterFieldDef(f.id);
            if (!res.success) toast.error("ลบไม่สำเร็จ", { description: res.error });
            router.refresh();
        });
    };

    if (!open) return (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> ตั้งช่องข้อมูลเอง
        </button>
    );
    return (
        <div className="mt-2 border border-border/70 chamfered-sm p-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">ช่องที่ตั้งเองจะโผล่ในทุกตัวละครของนิยายเรื่องนี้</span>
                <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">ปิด</button>
            </div>
            {fieldDefs.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                    <span>{f.label} <span className="text-[10px] text-muted-foreground">· {TYPE_LABEL[f.type as FieldType] ?? f.type}{f.options?.length ? ` (${f.options.join(", ")})` : ""}</span></span>
                    <button type="button" disabled={pending} aria-label={`ลบช่อง ${f.label}`} onClick={() => remove(f)} className="p-1 text-muted-foreground hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); if (label.trim()) add(); }} className="flex flex-wrap items-center gap-2 pt-1">
                <input aria-label="ชื่อช่อง" placeholder="ชื่อช่อง เช่น กรุ๊ปเลือด" value={label} onChange={(e) => setLabel(e.target.value)}
                    className="flex-1 min-w-[140px] bg-transparent outline-none border-b border-border focus:border-[var(--forge-gold)]" />
                <select aria-label="ชนิด" value={type} onChange={(e) => setType(e.target.value as FieldType)} className="bg-transparent text-xs outline-none cursor-pointer">
                    {FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
                {type === "select" && (
                    <input aria-label="ตัวเลือก" placeholder="A, B, O, AB" value={options} onChange={(e) => setOptions(e.target.value)}
                        className="min-w-[120px] bg-transparent outline-none border-b border-border focus:border-[var(--forge-gold)]" />
                )}
                <button type="submit" disabled={pending || !label.trim()} className="chamfered-sm border border-[var(--forge-gold)]/60 px-3 py-1 text-xs disabled:opacity-40 cursor-pointer">
                    {pending ? "กำลังเพิ่ม…" : "เพิ่ม"}
                </button>
            </form>
        </div>
    );
}

export function ProfileSection({
    character,
    fieldDefs,
}: {
    character: Character;
    fieldDefs: CharacterFieldDef[];
}) {
    const { value: p, set, state } = useSection<CharacterProfile>(character.id, "profile", character.profile);
    const custom = useSection<CharacterCustomValues>(character.id, "customValues", character.customValues);

    const aiOf = (path: string) => aiQuote(p as Record<string, unknown>, path);
    const id = (p.identity ?? {}) as Identity;
    const body = (p.body ?? {}) as Body;
    const social = (p.social ?? {}) as Social;
    const speech = (p.speech ?? {}) as Speech;

    const setId = (k: keyof Identity, v: Identity[keyof Identity]) => set("identity", { ...id, [k]: v });
    const setBody = (k: keyof Body, v: Body[keyof Body]) => set("body", { ...body, [k]: v });
    const setSocial = (k: keyof Social, v: Social[keyof Social]) => set("social", { ...social, [k]: v });
    const setSpeech = (k: keyof Speech, v: Speech[keyof Speech]) => set("speech", { ...speech, [k]: v });

    // แถวครอบครัวที่ยังไม่มีชื่อ เก็บไว้แค่ในจอ (schema บังคับชื่อ) — บันทึกเฉพาะแถวที่มีชื่อ
    const [family, setFamily] = useState<FamilyRow[]>(p.family ?? []);
    const saveFamily = (rows: FamilyRow[]) => {
        setFamily(rows);
        set("family", rows.filter((r) => r.name.trim()));
    };

    const text = (s: string) => (s.trim() === "" ? undefined : s);

    return (
        <div className="space-y-6">
            <div className="flex justify-end -mt-1">
                <SaveBadge state={state === "idle" ? custom.state : state} />
            </div>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                <Group title="ตัวตน">
                    <InlineField label="ชื่อเต็ม" value={id.fullName} ai={aiOf("identity.fullName")} onChange={(v) => setId("fullName", text(v))} />
                    <InlineField label="ชื่อเดิม" value={id.birthName} ai={aiOf("identity.birthName")} onChange={(v) => setId("birthName", text(v))} />
                    <InlineField label="อายุตอนเริ่มเรื่อง" type="number" suffix="ปี" value={id.ageAtStart} ai={aiOf("identity.ageAtStart")} onChange={(v) => setId("ageAtStart", numOrUndef(v))} />
                    <InlineField label="วันเกิด" placeholder="เช่น คืนเดือนดับ ปีมังกร" value={id.birthLabel} ai={aiOf("identity.birthLabel")} onChange={(v) => setId("birthLabel", text(v))} />
                    <InlineField label="บ้านเกิด" value={id.homeland} ai={aiOf("identity.homeland")} onChange={(v) => setId("homeland", text(v))} />
                    <InlineField label="สัญชาติ" value={id.nationality} ai={aiOf("identity.nationality")} onChange={(v) => setId("nationality", text(v))} />
                    <InlineField label="ศาสนา/ความเชื่อ" value={id.belief} ai={aiOf("identity.belief")} onChange={(v) => setId("belief", text(v))} />
                </Group>

                <Group title="ร่างกาย">
                    <InlineField
                        label="ส่วนสูง"
                        type="number"
                        suffix="ซม."
                        value={body.heightCm} ai={aiOf("body.heightCm")}
                        onChange={(v) => {
                            const n = numOrUndef(v);
                            setBody("heightCm", n !== undefined && n >= 10 && n <= 1000 ? n : undefined);
                        }}
                    />
                    <HeightChart cm={body.heightCm} />
                    <InlineField label="รูปร่าง" value={body.build} ai={aiOf("body.build")} onChange={(v) => setBody("build", text(v))} />
                    <InlineField label="ผม" value={body.hair} ai={aiOf("body.hair")} onChange={(v) => setBody("hair", text(v))} />
                    <InlineField label="ตา" value={body.eyes} ai={aiOf("body.eyes")} onChange={(v) => setBody("eyes", text(v))} />
                    <InlineField label="ผิว" value={body.skin} ai={aiOf("body.skin")} onChange={(v) => setBody("skin", text(v))} />
                    <InlineField label="ตำหนิ/แผลเป็น" value={body.marks} ai={aiOf("body.marks")} onChange={(v) => setBody("marks", text(v))} />
                    <InlineField label="ถนัดมือ" value={body.handedness} ai={aiOf("body.handedness")} onChange={(v) => setBody("handedness", text(v))} />
                    <InlineField label="สุขภาพ" value={body.health} ai={aiOf("body.health")} onChange={(v) => setBody("health", text(v))} />
                </Group>

                <Group title="สังคม">
                    <InlineField label="อาชีพ" value={social.occupation} ai={aiOf("social.occupation")} onChange={(v) => setSocial("occupation", text(v))} />
                    <InlineField label="ตำแหน่งเดิม" value={social.formerTitle} ai={aiOf("social.formerTitle")} onChange={(v) => setSocial("formerTitle", text(v))} />
                    <InlineField label="การศึกษา" value={social.education} ai={aiOf("social.education")} onChange={(v) => setSocial("education", text(v))} />
                    <InlineField label="สถานะสมรส" value={social.maritalStatus} ai={aiOf("social.maritalStatus")} onChange={(v) => setSocial("maritalStatus", text(v))} />
                    <InlineField label="ที่อยู่" value={social.residence} ai={aiOf("social.residence")} onChange={(v) => setSocial("residence", text(v))} />
                    <LevelPicker label="ฐานะ" lowLabel="ยากไร้" highLabel="มั่งคั่ง" value={social.wealth} onChange={(v) => setSocial("wealth", v)} />
                    <LevelPicker label="ชนชั้น" lowLabel="ล่าง" highLabel="สูง" value={social.status} onChange={(v) => setSocial("status", v)} />
                    <LevelPicker label="ชื่อเสียง" lowLabel="ไม่มีใครรู้จัก" highLabel="ทั้งแผ่นดิน" value={social.fame} onChange={(v) => setSocial("fame", v)} />
                </Group>

                <Group title="การพูดและนิสัย">
                    <InlineField label="แทนตัวเอง" placeholder="ข้า / ผม / เรา" value={speech.selfPronoun} ai={aiOf("speech.selfPronoun")} onChange={(v) => setSpeech("selfPronoun", text(v))} />
                    <InlineField label="เรียกคนอื่น" value={speech.addressOthers} ai={aiOf("speech.addressOthers")} onChange={(v) => setSpeech("addressOthers", text(v))} />
                    <InlineField label="น้ำเสียง" value={speech.voice} ai={aiOf("speech.voice")} onChange={(v) => setSpeech("voice", text(v))} />
                    <InlineField label="คำติดปาก" value={speech.catchphrase} ai={aiOf("speech.catchphrase")} onChange={(v) => setSpeech("catchphrase", text(v))} />
                    <InlineField label="ภาษา" value={speech.languages} ai={aiOf("speech.languages")} onChange={(v) => setSpeech("languages", text(v))} />
                    <InlineField label="นิสัยเล็กๆ" value={speech.habits} ai={aiOf("speech.habits")} onChange={(v) => setSpeech("habits", text(v))} />
                    <InlineField label="ชอบ" value={speech.likes} ai={aiOf("speech.likes")} onChange={(v) => setSpeech("likes", text(v))} />
                    <InlineField label="ไม่ชอบ" value={speech.dislikes} ai={aiOf("speech.dislikes")} onChange={(v) => setSpeech("dislikes", text(v))} />
                    <InlineField label="กลัว" value={speech.fears} ai={aiOf("speech.fears")} onChange={(v) => setSpeech("fears", text(v))} />
                </Group>
            </div>

            <Group title="ครอบครัว">
                {family.length === 0 && <p className="py-2 text-xs text-muted-foreground">ยังไม่มี — พ่อแม่ พี่น้อง หรือคนที่เลี้ยงดูมา</p>}
                {family.map((r, i) => {
                    const upd = (patch: Partial<FamilyRow>) => saveFamily(family.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 py-1.5 items-center animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                            <input aria-label="ชื่อ" placeholder="ชื่อ" value={r.name} onChange={(e) => upd({ name: e.target.value })} className="bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                            <input aria-label="ความเกี่ยวข้อง" placeholder="เป็นอะไรกัน" value={r.relation} onChange={(e) => upd({ relation: e.target.value })} className="bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                            <input aria-label="สถานะ" placeholder="ยังอยู่ / เสียแล้ว" value={r.status ?? ""} onChange={(e) => upd({ status: e.target.value || undefined })} className="bg-transparent text-sm outline-none border-b border-transparent hover:border-border focus:border-[var(--forge-gold)]" />
                            <button type="button" aria-label={`ลบ ${r.name || "แถวนี้"}`} onClick={() => saveFamily(family.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500 cursor-pointer">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
                <button type="button" onClick={() => setFamily([...family, { name: "", relation: "" }])} className="flex items-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> เพิ่มคนในครอบครัว
                </button>
            </Group>

            <Group title="ข้อมูลเพิ่มเติม">
                    {fieldDefs.map((f) => {
                        const v = custom.value[f.id];
                        if (f.type === "select") {
                            return (
                                <label key={f.id} className="flex items-baseline justify-between gap-3 py-1.5">
                                    <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{f.label}</span>
                                    <select
                                        value={typeof v === "string" ? v : ""}
                                        onChange={(e) => custom.set(f.id, e.target.value || null)}
                                        className="bg-transparent text-sm font-medium text-right outline-none cursor-pointer"
                                    >
                                        <option value="">—</option>
                                        {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </label>
                            );
                        }
                        return (
                            <InlineField
                                key={f.id}
                                label={f.label}
                                type={f.type === "number" ? "number" : "text"}
                                value={v ?? undefined}
                                onChange={(s) => custom.set(f.id, f.type === "number" ? (numOrUndef(s) ?? null) : (s || null))}
                            />
                        );
                    })}
                <FieldManager novelId={character.novelId} fieldDefs={fieldDefs} />
            </Group>
        </div>
    );
}

/** % ช่องที่กรอกแล้ว — ใช้กับแถบความครบในกล่องซ้าย */
export function profileCompleteness(p: CharacterProfile | null | undefined) {
    const groups = [p?.identity, p?.body, p?.social, p?.speech];
    const sizes = [7, 8, 8, 9];
    return groups.map((g, i) => {
        const filled = g ? Object.values(g).filter((v) => v !== undefined && v !== "").length : 0;
        return Math.round((Math.min(filled, sizes[i]) / sizes[i]) * 100);
    });
}
