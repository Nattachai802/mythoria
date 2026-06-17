"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Pencil,
    User,
    Target,
    Flame,
    Swords,
    BookOpen,
    Users,
    Zap,
    Compass,
    Shield,
    AlertTriangle,
    Calendar,
    Download,
    Lightbulb,
    Palette,
    Network,
} from "lucide-react";
import { CharacterSheet } from "@/components/project/character/character-sheet";
import { CharacterRelationships } from "@/components/project/character/character-relationships";
import { CharacterJourney } from "@/components/project/character/character-journey";
import { CharacterPowerManager } from "@/components/project/character/character-power-manager";
import { CharacterLifeEvents } from "@/components/project/character/character-life-events";
import { CharacterTimelineSlider } from "@/components/project/character/character-timeline-slider";
import { FactionTimelineView } from "@/components/project/character/faction-timeline-view";
import { ExportCharacterDialog } from "@/components/project/character/export-character-dialog";
import { CharacterIdeasTab } from "@/components/project/character/character-ideas-tab";
import { CharacterDesignBoard } from "@/components/project/character/character-design-board";
import { FormattedTextSection } from "@/components/ui/formatted-text-section";
import { Character, Idea } from "@/db/schema";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
}

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
}: CharacterDetailContentProps) {
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);
    const roleConfig = ROLE_CONFIG[character.role] || ROLE_CONFIG.minor;
    const aliases = (Array.isArray(character.aliases) ? (character.aliases as string[]) : []).filter(Boolean);

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
                            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-balance">
                                {character.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <span className={cn("inline-flex items-center chamfered-sm border px-2.5 py-0.5 text-xs font-medium", roleConfig.badge)}>
                                    {roleConfig.label}
                                </span>
                                {aliases.length > 0 && (
                                    <>
                                        <span className="text-muted-foreground/40">·</span>
                                        <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                            หรือ {aliases.join(" · ")}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <ExportCharacterDialog
                                characters={[character]}
                                novelTitle={novelId}
                                singleCharacter={character}
                                trigger={
                                    <Button variant="outline" className="chamfered-sm">
                                        <Download className="h-4 w-4 mr-2" />
                                        ส่งออก
                                    </Button>
                                }
                            />
                            <Button onClick={() => setSheetOpen(true)} className="chamfered-sm">
                                <Pencil className="h-4 w-4 mr-2" />
                                แก้ไข
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto">
                {/* ── Dossier: identity rail + narrative ── */}
                <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-8 items-start">
                    {/* Identity rail */}
                    <aside className="space-y-6 lg:sticky lg:top-6">
                        {/* Portrait */}
                        <div className="relative aspect-[3/4] chamfered overflow-hidden border border-border bg-muted/40">
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
                        </div>

                        {/* Vital stats */}
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ข้อมูลพื้นฐาน</span>
                                <span className="flex-1 h-px bg-border/70" />
                            </div>
                            <div className="divide-y divide-border/50">
                                <VitalRow label="บทบาท" value={roleConfig.label} />
                                {character.age && <VitalRow label="อายุ" value={character.age} />}
                                {character.gender && <VitalRow label="เพศ" value={character.gender} />}
                                {character.species && <VitalRow label="เผ่าพันธุ์" value={character.species} />}
                            </div>
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
                    <div className="space-y-8 min-w-0">
                        {character.description && (
                            <Section icon={<BookOpen className="w-3 h-3" />} title="สรุป">
                                <FormattedTextSection text={character.description} className="text-[15px] leading-relaxed" />
                            </Section>
                        )}

                        {character.appearance && (
                            <Section icon={<User className="w-3 h-3" />} title="รูปลักษณ์">
                                <FormattedTextSection text={character.appearance} className="text-sm leading-relaxed" />
                            </Section>
                        )}

                        {character.personality && (
                            <Section icon={<Flame className="w-3 h-3" />} title="บุคลิกภาพ">
                                <FormattedTextSection text={character.personality} className="text-sm leading-relaxed" />
                            </Section>
                        )}

                        {character.backstory && (
                            <Section icon={<BookOpen className="w-3 h-3" />} title="ปูมหลัง">
                                <FormattedTextSection text={character.backstory} className="text-sm leading-relaxed" />
                            </Section>
                        )}

                        {(character.goals || character.motivation || character.conflict) && (
                            <Section icon={<Target className="w-3 h-3" />} title="มิติตัวละคร">
                                <div className="grid sm:grid-cols-3 gap-x-6 gap-y-4">
                                    {character.goals && (
                                        <div className="space-y-1.5">
                                            <span className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                                                <Target className="w-3 h-3 text-emerald-500" />เป้าหมาย
                                            </span>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{character.goals}</p>
                                        </div>
                                    )}
                                    {character.motivation && (
                                        <div className="space-y-1.5">
                                            <span className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                                                <Flame className="w-3 h-3 text-[var(--forge-amber)]" />แรงจูงใจ
                                            </span>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{character.motivation}</p>
                                        </div>
                                    )}
                                    {character.conflict && (
                                        <div className="space-y-1.5">
                                            <span className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                                                <Swords className="w-3 h-3 text-red-500" />ความขัดแย้ง
                                            </span>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{character.conflict}</p>
                                        </div>
                                    )}
                                </div>
                            </Section>
                        )}

                        {(character.strengths || character.weaknesses) && (
                            <div className="grid sm:grid-cols-2 gap-6">
                                {character.strengths && (
                                    <Section icon={<Shield className="w-3 h-3 text-emerald-500" />} title="จุดแข็ง">
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{character.strengths}</p>
                                    </Section>
                                )}
                                {character.weaknesses && (
                                    <Section icon={<AlertTriangle className="w-3 h-3 text-red-500" />} title="จุดอ่อน">
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{character.weaknesses}</p>
                                    </Section>
                                )}
                            </div>
                        )}

                        {/* Relationships — core dossier content */}
                        <Section icon={<Users className="w-3 h-3" />} title="ความสัมพันธ์">
                            <CharacterRelationships characterId={character.id} novelId={novelId} />
                        </Section>

                        {/* Life events — the "experience" timeline */}
                        <Section icon={<Calendar className="w-3 h-3" />} title="เหตุการณ์สำคัญ" meta="ไทม์ไลน์ตามบท">
                            <CharacterLifeEvents characterId={character.id} novelId={novelId} />
                        </Section>
                    </div>
                </div>

                {/* ── Full-width workbench band (interactive tools) ── */}
                <div className="mt-14 space-y-12">
                    <Section icon={<Zap className="w-3 h-3" />} title="จัดการพลัง">
                        <CharacterPowerManager characterId={character.id} novelId={novelId} />
                    </Section>

                    <Section icon={<Compass className="w-3 h-3" />} title="เส้นทางในเรื่อง">
                        <div className="space-y-6">
                            <CharacterTimelineSlider characterId={character.id} novelId={novelId} />
                            <CharacterJourney characterId={character.id} novelId={novelId} />
                        </div>
                    </Section>

                    <Section icon={<Network className="w-3 h-3" />} title="สังกัดและกลุ่ม">
                        <FactionTimelineView novelId={novelId} />
                    </Section>

                    <Section icon={<Palette className="w-3 h-3" />} title="ดีไซน์ตัวละคร">
                        <CharacterDesignBoard characterId={character.id} novelId={novelId} />
                    </Section>

                    <Section icon={<Lightbulb className="w-3 h-3" />} title="ไอเดียที่เกี่ยวข้อง">
                        <CharacterIdeasTab
                            characterId={character.id}
                            characterName={character.name}
                            novelId={novelId}
                            ideas={ideas}
                        />
                    </Section>
                </div>
            </div>

            <CharacterSheet
                character={character}
                novelId={novelId}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onSaved={() => router.refresh()}
            />
        </>
    );
}
