"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Pencil,
    User,
    Target,
    Heart,
    Swords,
    BookOpen,
    Users,
    Zap,
    Compass,
    Shield,
    AlertTriangle,
    Calendar,
    Sparkles,
    Download,
    Lightbulb,
    Palette,
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
import { Character } from "@/db/schema";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface CharacterDetailContentProps {
    character: Character;
    novelId: string;
    ideas?: any[]; // Ideas linked to this character
}

const ROLE_CONFIG = {
    protagonist: {
        label: "ตัวเอก",
        color: "from-amber-500/20 to-orange-500/10",
        badgeClass: "bg-amber-500/20 text-amber-700 border-amber-500/50",
        accentColor: "amber",
    },
    antagonist: {
        label: "ตัวร้าย",
        color: "from-red-500/20 to-rose-500/10",
        badgeClass: "bg-red-500/20 text-red-700 border-red-500/50",
        accentColor: "red",
    },
    supporting: {
        label: "ตัวรอง",
        color: "from-blue-500/20 to-indigo-500/10",
        badgeClass: "bg-blue-500/20 text-blue-700 border-blue-500/50",
        accentColor: "blue",
    },
    minor: {
        label: "ตัวประกอบ",
        color: "from-slate-500/20 to-gray-500/10",
        badgeClass: "bg-slate-500/20 text-slate-700 border-slate-500/50",
        accentColor: "slate",
    },
};

interface InfoSectionProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    className?: string;
}

function InfoSection({ icon, title, children, className }: InfoSectionProps) {
    const textContent = typeof children === "string" ? children : null;

    return (
        <div className={cn("space-y-2 tech-border-left", className)}>
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <h3 className="font-technical text-xs font-semibold uppercase tracking-[0.15em]">{title}</h3>
            </div>
            {textContent ? (
                <FormattedTextSection text={textContent} className="text-sm" />
            ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {children}
                </div>
            )}
        </div>
    );
}

export function CharacterDetailContent({
    character,
    novelId,
    ideas = []
}: CharacterDetailContentProps) {
    const router = useRouter();
    const [sheetOpen, setSheetOpen] = useState(false);
    const roleConfig = ROLE_CONFIG[character.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.minor;

    return (
        <>
            <div className={cn(
                "relative -mx-8 -mt-8 mb-8 bg-gradient-to-b",
                roleConfig.color
            )}>
                {/* Top fade for smooth transition from header */}
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background to-transparent" />
                {/* Bottom fade for smooth transition */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />

                <div className="relative px-8 pt-16 py-12 pb-16">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            {/* Character Portrait */}
                            <div className="relative group">
                                <div className="w-48 h-64 chamfered overflow-hidden shadow-2xl border-2 border-primary/30 backdrop-blur-sm">
                                    {character.image ? (
                                        <img
                                            src={character.image}
                                            alt={character.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                            <User className="w-20 h-20 text-muted-foreground/40" />
                                        </div>
                                    )}
                                </div>
                                {/* Forge glow on hover */}
                                <div className="absolute -inset-2 bg-gradient-to-br from-primary/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                            </div>

                            {/* Character Info */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                                            {character.name}
                                        </h1>
                                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                                            <Badge className={cn("border text-sm px-3 py-1", roleConfig.badgeClass)}>
                                                {roleConfig.label}
                                            </Badge>
                                            {Array.isArray(character.aliases) && (character.aliases as string[]).length > 0 && (
                                                <>
                                                    <span className="text-muted-foreground/50">•</span>
                                                    {(character.aliases as string[]).map((alias, i) => (
                                                        <Badge key={i} variant="outline" className="font-normal">
                                                            {String(alias)}
                                                        </Badge>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ExportCharacterDialog
                                            characters={[character]}
                                            novelTitle={novelId}
                                            singleCharacter={character}
                                            trigger={
                                                <Button variant="outline" className="shadow-lg">
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Export
                                                </Button>
                                            }
                                        />
                                        <Button onClick={() => setSheetOpen(true)} className="shadow-lg">
                                            <Pencil className="h-4 w-4 mr-2" />
                                            แก้ไข
                                        </Button>
                                    </div>
                                </div>

                                {character.description && (
                                    <p className="text-base text-muted-foreground/80 leading-relaxed max-w-2xl font-light">
                                        {character.description}
                                    </p>
                                )}

                                {/* Quick Stats */}
                                <div className="flex flex-wrap gap-6 pt-2">
                                    {character.age && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">อายุ</p>
                                                <p className="font-semibold">{character.age}</p>
                                            </div>
                                        </div>
                                    )}
                                    {character.gender && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center">
                                                <Heart className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">เพศ</p>
                                                <p className="font-semibold">{character.gender}</p>
                                            </div>
                                        </div>
                                    )}
                                    {character.species && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center">
                                                <Swords className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">เผ่าพันธุ์</p>
                                                <p className="font-semibold">{character.species}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="max-w-5xl mx-auto">
                <Tabs defaultValue="profile" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="profile" className="gap-2">
                            <BookOpen className="w-4 h-4" />
                            โปรไฟล์
                        </TabsTrigger>
                        <TabsTrigger value="relationships" className="gap-2">
                            <Users className="w-4 h-4" />
                            ความสัมพันธ์
                        </TabsTrigger>
                        <TabsTrigger value="powers" className="gap-2">
                            <Zap className="w-4 h-4" />
                            พลัง
                        </TabsTrigger>
                        <TabsTrigger value="journey" className="gap-2">
                            <Compass className="w-4 h-4" />
                            เส้นทาง
                        </TabsTrigger>
                        <TabsTrigger value="life-events" className="gap-2">
                            <Calendar className="w-4 h-4" />
                            เหตุการณ์สำคัญ
                        </TabsTrigger>
                        <TabsTrigger value="ideas" className="gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Ideas
                        </TabsTrigger>
                        <TabsTrigger value="design" className="gap-2">
                            <Palette className="w-4 h-4" />
                            Design
                        </TabsTrigger>
                    </TabsList>

                    {/* Profile Tab */}
                    <TabsContent value="profile" className="space-y-6">
                        {/* Appearance & Personality */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {character.appearance && (
                                <Card className="border-l-4 border-l-blue-500">
                                    <CardContent className="pt-6">
                                        <InfoSection
                                            icon={<User className="w-4 h-4" />}
                                            title="รูปลักษณ์"
                                        >
                                            {character.appearance}
                                        </InfoSection>
                                    </CardContent>
                                </Card>
                            )}
                            {character.personality && (
                                <Card className="border-l-4 border-l-purple-500">
                                    <CardContent className="pt-6">
                                        <InfoSection
                                            icon={<Heart className="w-4 h-4" />}
                                            title="บุคลิกภาพ"
                                        >
                                            {character.personality}
                                        </InfoSection>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Backstory */}
                        {character.backstory && (
                            <Card className="bg-gradient-to-br from-card to-muted/20">
                                <CardContent className="pt-6">
                                    <InfoSection
                                        icon={<BookOpen className="w-4 h-4" />}
                                        title="ปูมหลัง"
                                    >
                                        {character.backstory}
                                    </InfoSection>
                                </CardContent>
                            </Card>
                        )}

                        {/* Goals, Motivation, Conflict */}
                        {(character.goals || character.motivation || character.conflict) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Target className="w-5 h-5" />
                                        มิติตัวละคร
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {character.goals && (
                                        <InfoSection
                                            icon={<Target className="w-4 h-4 text-green-500" />}
                                            title="เป้าหมาย"
                                        >
                                            {character.goals}
                                        </InfoSection>
                                    )}
                                    {character.motivation && (
                                        <InfoSection
                                            icon={<Sparkles className="w-4 h-4 text-yellow-500" />}
                                            title="แรงจูงใจ"
                                        >
                                            {character.motivation}
                                        </InfoSection>
                                    )}
                                    {character.conflict && (
                                        <InfoSection
                                            icon={<Swords className="w-4 h-4 text-red-500" />}
                                            title="ความขัดแย้ง"
                                        >
                                            {character.conflict}
                                        </InfoSection>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Strengths & Weaknesses */}
                        {(character.strengths || character.weaknesses) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {character.strengths && (
                                    <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
                                        <CardContent className="pt-6">
                                            <InfoSection
                                                icon={<Shield className="w-4 h-4 text-green-600" />}
                                                title="จุดแข็ง"
                                            >
                                                {character.strengths}
                                            </InfoSection>
                                        </CardContent>
                                    </Card>
                                )}
                                {character.weaknesses && (
                                    <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
                                        <CardContent className="pt-6">
                                            <InfoSection
                                                icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
                                                title="จุดอ่อน"
                                            >
                                                {character.weaknesses}
                                            </InfoSection>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* Relationships Tab */}
                    <TabsContent value="relationships" className="space-y-6">
                        <Card>
                            <CardContent className="pt-6">
                                <CharacterRelationships characterId={character.id} novelId={novelId} />
                            </CardContent>
                        </Card>

                        {/* Faction Timeline */}
                        <FactionTimelineView novelId={novelId} />
                    </TabsContent>

                    {/* Powers Tab */}
                    <TabsContent value="powers">
                        <Card>
                            <CardContent className="pt-6">
                                <CharacterPowerManager characterId={character.id} novelId={novelId} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Journey Tab */}
                    <TabsContent value="journey" className="space-y-6">
                        {/* Timeline Slider */}
                        <CharacterTimelineSlider characterId={character.id} novelId={novelId} />

                        {/* Location Journey */}
                        <Card>
                            <CardContent className="pt-6">
                                <CharacterJourney characterId={character.id} novelId={novelId} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Life Events Tab */}
                    <TabsContent value="life-events">
                        <CharacterLifeEvents characterId={character.id} novelId={novelId} />
                    </TabsContent>

                    {/* Ideas Tab */}
                    <TabsContent value="ideas">
                        <CharacterIdeasTab
                            characterId={character.id}
                            characterName={character.name}
                            novelId={novelId}
                            ideas={ideas}
                        />
                    </TabsContent>

                    {/* Design Tab */}
                    <TabsContent value="design">
                        <CharacterDesignBoard characterId={character.id} novelId={novelId} />
                    </TabsContent>
                </Tabs>
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

