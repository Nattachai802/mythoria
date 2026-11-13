"use client";

import { useEffect, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { Button } from "@/components/ui/button";
import {
    User,
    BookOpen,
    Users,
    Zap,
    Compass,
    Calendar,
    Download,
    Lightbulb,
    Palette,
    Network,
} from "lucide-react";
import { CharacterRelationships } from "@/components/project/character/character-relationships";
import { CharacterJourney } from "@/components/project/character/character-journey";
import { CharacterPowerManager } from "@/components/project/character/character-power-manager";
import { CharacterLifeEvents } from "@/components/project/character/character-life-events";
import { CharacterTimelineSlider } from "@/components/project/character/character-timeline-slider";
import { CharacterAffiliations } from "@/components/project/character/character-affiliations";
import { ExportCharacterDialog } from "@/components/project/character/export-character-dialog";
import { CharacterIdeasTab } from "@/components/project/character/character-ideas-tab";
import { CharacterDesignBoard } from "@/components/project/character/character-design-board";
import { Character, CharacterFieldDef, Idea } from "@/db/schema";
import { ProfileSection, profileCompleteness } from "@/components/project/character/v2/profile-section";
import { RolePicker, AliasesField, PortraitUpload } from "@/components/project/character/v2/header-controls";
import { OverviewSection, DimensionsSection, StrengthsSection, EditableText } from "@/components/project/character/v2/overview-section";
import { PsychSection } from "@/components/project/character/v2/psych-section";
import { GroupHead } from "@/components/project/character/v2/inline-field";
import { MotiveSection, ArcSection, NarrationSection, type ChapterOption } from "@/components/project/character/v2/story-sections";
import { cn } from "@/lib/utils";

interface CharacterPowerLite {
    id: string;
    currentLevel: number | null;
    power: { name: string | null; color: string | null; maxLevel: number | null } | null;
}

interface CharacterDetailContentProps {
    character: Character;
    novelId: string;
    ideas?: Idea[];
    powers?: CharacterPowerLite[]; // character powers with joined `power` (name, color, maxLevel) + currentLevel
    fieldDefs?: CharacterFieldDef[];
    chapters?: ChapterOption[];
}

// แท็บของหน้า — จำแท็บล่าสุดต่อเครื่องใน localStorage
const FILTERS = [
    { key: "story", label: "ภาพรวม" },
    { key: "basic", label: "ข้อมูลพื้นฐาน" },
    { key: "psych", label: "จิตใจ" },
    { key: "arc", label: "เส้นเรื่อง" },
    { key: "relations", label: "ความสัมพันธ์" },
    { key: "tools", label: "คลัง" },
] as const;
type _FK = (typeof FILTERS)[number]["key"];
// แท็บที่ถูกรวมไป — ค่าที่จำไว้ในเครื่องจากรุ่นก่อนพาไปแท็บใหม่ที่ถูกต้อง
const LEGACY_TAB: Record<string, _FK> = { motive: "psych", narration: "arc", events: "arc" };
type FilterKey = (typeof FILTERS)[number]["key"];
const FILTER_STORE = "mythoria.character.tab";

// Role → restrained, theme-aware badge (no gradient wash). Protagonist earns the brand gold.
const ROLE_CONFIG: Record<string, { label: string; badge: string }> = {
    protagonist: { label: "ตัวเอก", badge: "border-[var(--forge-gold)]/45 bg-[var(--forge-gold)]/15 text-[var(--forge-amber)]" },
    antagonist: { label: "ตัวร้าย", badge: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" },
    supporting: { label: "ตัวรอง", badge: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    minor: { label: "ตัวประกอบ", badge: "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300" },
};

// Typographic section header — resume-style label + hairline rule (replaces card chrome)
function Section({
    icon,
    title,
    meta,
    children,
    className,
}: {
    icon: React.ReactNode;
    title: string;
    meta?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("space-y-3", className)}>
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                    {icon}
                    {title}
                </span>
                {meta && (
                    <span className="font-technical text-[9px] tabular-nums text-muted-foreground/60 whitespace-nowrap">
                        {meta}
                    </span>
                )}
                <span className="flex-1 h-px bg-border/70" />
            </div>
            {children}
        </section>
    );
}

// Small labelled stat for the identity rail
function VitalRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-right">{value}</span>
        </div>
    );
}

export function CharacterDetailContent({
    character,
    novelId,
    ideas = [],
    powers = [],
    fieldDefs = [],
    chapters = [],
}: CharacterDetailContentProps) {
    const [tab, setTab] = useState<FilterKey>("story");
    useEffect(() => {
        try {
            const raw = localStorage.getItem(FILTER_STORE);
            // localStorage อ่านได้เฉพาะฝั่ง client — ตั้งค่าหลัง hydrate กัน SSR ไม่ตรง
            const k = raw ? (LEGACY_TAB[raw] ?? raw) : null;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (k && FILTERS.some((f) => f.key === k)) setTab(k as FilterKey);
        } catch { /* storage ปิดอยู่ = แท็บแรก */ }
    }, []);
    const select = (k: FilterKey) => {
        setTab(k);
        try { localStorage.setItem(FILTER_STORE, k); } catch { /* ignore */ }
    };
    const show = (k: FilterKey) => tab === k;
    const completeness = profileCompleteness(character.profile);
    const roleConfig = ROLE_CONFIG[character.role] || ROLE_CONFIG.minor;

    return (
        <>
            {/* ── Header band ── */}
            <div className="relative -mx-8 -mt-4 mb-8 border-b border-border bg-card/30 noise-texture overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 h-px hazard-stripe-subtle opacity-40" />
                <div className="relative max-w-5xl mx-auto px-8 pt-8 pb-7">
                    <div className="flex items-end justify-between gap-6 flex-wrap">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--forge-gold)] opacity-75 animate-forge-pulse" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--forge-gold)]" />
                                </span>
                                <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                    แฟ้มประวัติตัวละคร
                                </span>
                            </div>
                            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                                <EditableText character={character} field="name" label="ชื่อตัวละคร" required multiline={false}
                                    placeholder="ชื่อตัวละคร" className="font-display font-bold tracking-tight" />
                            </h1>
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <RolePicker character={character} roles={ROLE_CONFIG} />
                                <span className="text-muted-foreground/40">·</span>
                                <AliasesField character={character} />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                <div className="flex items-end gap-3 mb-6 border-b border-border">
                <MotionConfig reducedMotion="user"><div className="flex flex-1 min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="หมวดข้อมูลตัวละคร">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            role="tab"
                            aria-selected={show(f.key)}
                            onClick={() => select(f.key)}
                            className={cn(
                                "relative whitespace-nowrap px-3 py-2 text-sm transition-colors duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-gold)]/60 rounded-sm",
                                show(f.key) ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {f.label}
                            {show(f.key) && (
                                <motion.span layoutId="character-tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--forge-gold)]"
                                    transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                            )}
                        </button>
                    ))}
                </div></MotionConfig>
                    <div className="flex items-center gap-3 shrink-0 pb-1.5">
                        <ExportCharacterDialog
                            characters={[character]}
                            novelTitle={novelId}
                            singleCharacter={character}
                            trigger={
                                <Button variant="ghost" size="icon" className="h-8 w-8 chamfered-sm" aria-label="ส่งออกตัวละคร" title="ส่งออกตัวละคร">
                                    <Download className="h-4 w-4" />
                                </Button>
                            }
                        />
                    </div>
                </div>
                {/* ── Dossier: identity rail + narrative ── */}
                <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
                    {/* Identity rail */}
                    <aside className="space-y-6 lg:sticky lg:top-6">
                        {/* Portrait */}
                        <div className="group relative aspect-[3/4] chamfered overflow-hidden border border-border bg-muted/40">
                            {character.image ? (
                                <img
                                    src={character.image}
                                    alt={character.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-16 h-16 text-muted-foreground/30" />
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] hazard-stripe-dark opacity-60" />
                            <PortraitUpload character={character} />
                        </div>

                        {/* Vital stats */}
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ข้อมูลพื้นฐาน</span>
                                <span className="flex-1 h-px bg-border/70" />
                            </div>
                            <div className="divide-y divide-border/50">
                                <VitalRow label="บทบาท" value={roleConfig.label} />
                                {([["age", "อายุ"], ["gender", "เพศ"], ["species", "เผ่าพันธุ์"]] as const).map(([field, label]) => (
                                    <VitalRow key={field} label={label} value={
                                        <EditableText character={character} field={field} label={label} multiline={false} showBadge={false}
                                            placeholder="—" className="text-right text-sm font-medium" />
                                    } />
                                ))}
                            </div>
                            <button type="button" onClick={() => select("basic")} title="ไปที่แท็บข้อมูลพื้นฐาน"
                                className="mt-3 w-full space-y-1.5 text-left -mx-1 px-1 py-1 rounded-sm hover:bg-muted/40 transition-colors duration-200 cursor-pointer">
                                <span className="block font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">ข้อมูลพื้นฐานกรอกแล้ว →</span>
                                {["ตัวตน", "ร่างกาย", "สังคม", "การพูด"].map((label, i) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <span className="w-14 font-technical text-[9px] text-muted-foreground">{label}</span>
                                        <div className="h-1 flex-1 bg-muted overflow-hidden">
                                            <div className="h-full bg-[var(--forge-gold)] transition-[width] duration-500 ease-out" style={{ width: `${completeness[i]}%` }} />
                                        </div>
                                        <span className="w-8 text-right font-technical text-[9px] tabular-nums text-muted-foreground">{completeness[i]}%</span>
                                    </div>
                                ))}
                            </button>
                        </div>

                        {/* Powers — skill bars */}
                        <div>
                            <div className="flex items-center gap-2.5 mb-3">
                                <span className="flex items-center gap-2 font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                    <Zap className="w-3 h-3" />
                                    พลัง
                                </span>
                                <span className="flex-1 h-px bg-border/70" />
                            </div>
                            {powers.length === 0 ? (
                                <p className="text-xs text-muted-foreground">ยังไม่มีพลังที่กำหนด</p>
                            ) : (
                                <div className="space-y-3">
                                    {powers.map((cp) => {
                                        const max = cp.power?.maxLevel || 10;
                                        const lvl = cp.currentLevel || 0;
                                        const accent = cp.power?.color || "var(--forge-gold)";
                                        return (
                                            <div key={cp.id}>
                                                <div className="flex items-baseline justify-between gap-2 mb-1">
                                                    <span className="text-sm font-medium truncate">{cp.power?.name || "—"}</span>
                                                    <span className="font-technical text-[10px] tabular-nums text-muted-foreground shrink-0">
                                                        {lvl}/{max}
                                                    </span>
                                                </div>
                                                <div className="h-1 w-full bg-muted chamfered-sm overflow-hidden">
                                                    <div
                                                        className="h-full transition-all"
                                                        style={{ width: `${Math.min(100, Math.round((lvl / max) * 100))}%`, backgroundColor: accent }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Narrative column */}
                    <div key={tab} className="space-y-8 min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
                        {show("story") && <OverviewSection character={character} />}

                        {show("basic") && (
                            <Section icon={<User className="w-3 h-3" />} title="ข้อมูลพื้นฐาน" meta="กดที่ช่องเพื่อเขียน">
                                {/* key = ร่องรอย AI: AI เติมเสร็จแล้ว refresh → remount ให้ช่องได้ค่าใหม่ (state ในช่องตั้งจาก props ตอน mount เท่านั้น) */}
                                <ProfileSection key={JSON.stringify((character.profile as { _ai?: unknown } | null)?._ai ?? null)} character={character} fieldDefs={fieldDefs} />
                            </Section>
                        )}

                        {/* จิตใจ = นิสัย + แรงขับ */}
                        {show("psych") && (<>
                            {/* ① นิสัย → ② ป้ายเสริม (ส่วนเสริมของนิสัย) → ③ แรงขับ → จุดแข็ง/จุดอ่อน */}
                            <PsychSection character={character} after={
                                <section className="space-y-6">
                                    <GroupHead n="③" title="แรงขับ" sub="ตัวละครอยากได้อะไร และอะไรจะทำให้เขาเปลี่ยน" />
                                    <DimensionsSection character={character} />
                                    <MotiveSection character={character} />
                                    <StrengthsSection character={character} />
                                </section>
                            } />
                        </>)}

                        {/* เส้นเรื่อง = ทุกอย่างที่เดินไปตามบท */}
                        {show("arc") && (<>
                            <Section icon={<Compass className="w-3 h-3" />} title="พัฒนาการ">
                                <ArcSection character={character} chapters={chapters} />
                            </Section>
                            <Section icon={<Calendar className="w-3 h-3" />} title="เหตุการณ์สำคัญ" meta="ไทม์ไลน์ตามบท">
                                <CharacterLifeEvents characterId={character.id} novelId={novelId} />
                            </Section>
                            <Section icon={<Compass className="w-3 h-3" />} title="สถานะและเส้นทางในเรื่อง">
                                <div className="space-y-6">
                                    <CharacterTimelineSlider characterId={character.id} novelId={novelId} />
                                    <CharacterJourney characterId={character.id} novelId={novelId} />
                                </div>
                            </Section>
                            <Section icon={<BookOpen className="w-3 h-3" />} title="การเล่าเรื่อง">
                                <NarrationSection character={character} chapters={chapters} />
                            </Section>
                        </>)}

                        {show("relations") && (<>
                            <Section icon={<Users className="w-3 h-3" />} title="ความสัมพันธ์">
                                <CharacterRelationships characterId={character.id} novelId={novelId} />
                            </Section>
                            <Section icon={<Network className="w-3 h-3" />} title="สังกัด" meta="ฝ่าย บทบาท และช่วงบท">
                                <CharacterAffiliations characterId={character.id} novelId={novelId} />
                            </Section>
                        </>)}

                        {/* คลัง = ของประกอบ */}
                        {show("tools") && (<>
                            <Section icon={<Zap className="w-3 h-3" />} title="พลัง">
                                <CharacterPowerManager characterId={character.id} novelId={novelId} />
                            </Section>
                            <Section icon={<Palette className="w-3 h-3" />} title="ดีไซน์ตัวละคร">
                                <CharacterDesignBoard characterId={character.id} novelId={novelId} />
                            </Section>
                            <Section icon={<Lightbulb className="w-3 h-3" />} title="ไอเดียที่เกี่ยวข้อง">
                                <CharacterIdeasTab characterId={character.id} characterName={character.name} novelId={novelId} ideas={ideas} />
                            </Section>
                        </>)}
                    </div>
                </div>

                {/* ── Full-width workbench band (interactive tools) ── */}
            </div>

        </>
    );
}
