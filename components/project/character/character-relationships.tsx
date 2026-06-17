"use client";

import { useEffect, useState } from "react";
import { getCharacterRelationships, deleteCharacterRelationship, updateCharacterRelationship } from "@/server/character";
import { getCharacterFactions, removeCharacterFromFaction } from "@/server/factions";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, User, Users, ArrowRight, ArrowLeft, History } from "lucide-react";
import { AddRelationshipDialog } from "./add-relationship-dialog";
import { ManageFactionDialog } from "./manage-faction-dialog";
import { RelationshipTimeline } from "./relationship-timeline";
import { RELATIONSHIP_COLORS } from "./relationship-constants";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { getChapters } from "@/server/chapter";
import { getCharactersInChapter } from "@/server/chapter-characters";

interface CharacterRelationshipsProps {
    characterId: string;
    novelId: string;
}

export function CharacterRelationships({ characterId, novelId }: CharacterRelationshipsProps) {
    const [relationships, setRelationships] = useState<any[]>([]);
    const [factions, setFactions] = useState<any[]>([]);
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>("all");
    const [chapterCharacters, setChapterCharacters] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isFactionAddOpen, setIsFactionAddOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteFactionId, setDeleteFactionId] = useState<string | null>(null);
    const [editingOpinion, setEditingOpinion] = useState<string | null>(null);
    const [timelineRelId, setTimelineRelId] = useState<string | null>(null);
    const [timelineCharName, setTimelineCharName] = useState<string>("");

    // Helper function to get opinion level color
    const getOpinionColor = (level: number) => {
        if (level >= 80) return "bg-emerald-500";
        if (level >= 60) return "bg-green-400";
        if (level >= 40) return "bg-yellow-400";
        if (level >= 20) return "bg-orange-400";
        return "bg-red-500";
    };

    const getOpinionLabel = (level: number) => {
        if (level >= 80) return "สนิทมาก";
        if (level >= 60) return "เป็นมิตร";
        if (level >= 40) return "ปกติ";
        if (level >= 20) return "ไม่ชอบ";
        return "เป็นศัตรู";
    };

    const handleOpinionChange = async (relationshipId: string, newLevel: number) => {
        const result = await updateCharacterRelationship(relationshipId, {
            opinionLevel: newLevel,
            sentiment: newLevel >= 60 ? "positive" : newLevel >= 40 ? "neutral" : "negative"
        });
        if (result.success) {
            setRelationships(prev => prev.map(rel =>
                rel.id === relationshipId
                    ? { ...rel, opinionLevel: newLevel }
                    : rel
            ));
        } else {
            toast.error("ไม่สามารถอัปเดตระดับความสัมพันธ์");
        }
    };

    const fetchData = async () => {
        const [relResult, facResult, chapResult] = await Promise.all([
            getCharacterRelationships(characterId),
            getCharacterFactions(characterId),
            getChapters(novelId)
        ]);

        if (relResult.success && relResult.data) {
            setRelationships(relResult.data);
        }
        if (facResult.success && facResult.data) {
            setFactions(facResult.data);
        }
        if (chapResult.success && chapResult.chapters) {
            setChapters(chapResult.chapters);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, [characterId]);

    // Fetch characters in selected chapter
    useEffect(() => {
        async function fetchChapterCharacters() {
            if (selectedChapter === "all") {
                setChapterCharacters(new Set());
                return;
            }

            const result = await getCharactersInChapter(selectedChapter);
            if (result.success && result.data) {
                const charIds = new Set<string>(result.data.map((cc: any) => cc.character.id as string));
                setChapterCharacters(charIds);
            }
        }

        fetchChapterCharacters();
    }, [selectedChapter]);

    const handleDelete = async () => {
        if (!deleteId) return;

        const result = await deleteCharacterRelationship(deleteId);
        if (result.success) {
            toast.success("ลบความสัมพันธ์แล้ว");
            fetchData();
        } else {
            toast.error("ลบความสัมพันธ์ไม่สำเร็จ");
        }
        setDeleteId(null);
    };

    const handleRemoveFaction = async () => {
        if (!deleteFactionId) return;

        const result = await removeCharacterFromFaction(deleteFactionId, novelId);
        if (result.success) {
            toast.success("ออกจากกลุ่มแล้ว");
            fetchData();
        } else {
            toast.error("ออกจากกลุ่มไม่สำเร็จ");
        }
        setDeleteFactionId(null);
    };

    return (
        <>
            <div className="space-y-8">
                {/* Relationships */}
                <div>
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        {chapters.length > 0 ? (
                            <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                                <SelectTrigger className="w-[210px] chamfered-sm h-9">
                                    <SelectValue placeholder="กรองตามบท" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทุกบท</SelectItem>
                                    {chapters.map((chapter) => (
                                        <SelectItem key={chapter.id} value={chapter.id}>
                                            บทที่ {chapter.orderIndex}: {chapter.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : <span />}
                        <Button onClick={() => setIsAddOpen(true)} size="sm" variant="outline" className="chamfered-sm">
                            <Plus className="h-4 w-4 mr-2" />
                            เพิ่มความสัมพันธ์
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="text-sm text-muted-foreground py-4">กำลังโหลด…</div>
                    ) : relationships.filter((rel) => selectedChapter === "all" || chapterCharacters.has(rel.character.id)).length === 0 ? (
                        <div className="flex flex-col items-center text-center py-10 chamfered border border-dashed border-border bg-card/40">
                            <Users className="w-9 h-9 text-[var(--forge-gold)]/50 mb-3" />
                            <p className="text-sm text-muted-foreground">
                                {selectedChapter === "all" ? "ยังไม่มีความสัมพันธ์" : "ไม่มีความสัมพันธ์กับตัวละครในบทนี้"}
                            </p>
                            {selectedChapter === "all" && (
                                <Button variant="link" onClick={() => setIsAddOpen(true)} className="text-[var(--forge-amber)]">
                                    เพิ่มความสัมพันธ์แรก
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {relationships
                                .filter((rel) => selectedChapter === "all" || chapterCharacters.has(rel.character.id))
                                .map((rel) => (
                                            <div
                                                key={rel.id}
                                                className="flex items-start gap-3 p-3 chamfered border border-border bg-card/50 transition-colors hover:border-[var(--forge-gold)]/40"
                                            >
                                                <Link href={`/dashboard/project/${novelId}/characters/${rel.character.id}`} className="shrink-0">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
                                                        {rel.character.image ? (
                                                            <img
                                                                src={rel.character.image}
                                                                alt={rel.character.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <User className="h-6 w-6 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <Link href={`/dashboard/project/${novelId}/characters/${rel.character.id}`} className="hover:underline">
                                                            <span className="font-medium">{rel.character.name}</span>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                                            onClick={() => setDeleteId(rel.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <Badge className={`chamfered-sm border-transparent ${RELATIONSHIP_COLORS[rel.relationshipType] || "bg-gray-500"}`}>
                                                            {rel.relationshipType}
                                                        </Badge>

                                                        {/* Direction Indicator */}
                                                        <div className="text-xs text-muted-foreground flex items-center" title={rel.isSource ? "ตัวละครนี้มองอีกฝ่ายว่า…" : "อีกฝ่ายมองตัวละครนี้ว่า…"}>
                                                            {rel.isSource ? (
                                                                <ArrowRight className="w-3 h-3 mr-1" />
                                                            ) : (
                                                                <ArrowLeft className="w-3 h-3 mr-1" />
                                                            )}
                                                            {rel.isSource ? "มองออก" : "ถูกมอง"}
                                                        </div>
                                                    </div>

                                                    {rel.description && (
                                                        <p className="text-sm text-muted-foreground break-words line-clamp-2 mb-2">
                                                            {rel.description}
                                                        </p>
                                                    )}

                                                    {/* Opinion Level */}
                                                    <div className="mt-2 pt-2 border-t">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-muted-foreground">ระดับความสัมพันธ์</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-5 w-5"
                                                                    onClick={() => {
                                                                        setTimelineRelId(rel.id);
                                                                        setTimelineCharName(rel.character.name);
                                                                    }}
                                                                    title="ดูประวัติความสัมพันธ์"
                                                                >
                                                                    <History className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                            <span className={`text-xs font-medium px-2 py-0.5 chamfered-sm ${getOpinionColor(rel.opinionLevel)} text-white tabular-nums`}>
                                                                {rel.opinionLevel}% · {getOpinionLabel(rel.opinionLevel)}
                                                            </span>
                                                        </div>
                                                        {editingOpinion === rel.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <Slider
                                                                    value={[rel.opinionLevel]}
                                                                    onValueChange={(value) => {
                                                                        setRelationships(prev => prev.map(r =>
                                                                            r.id === rel.id ? { ...r, opinionLevel: value[0] } : r
                                                                        ));
                                                                    }}
                                                                    onValueCommit={(value) => {
                                                                        handleOpinionChange(rel.id, value[0]);
                                                                        setEditingOpinion(null);
                                                                    }}
                                                                    max={100}
                                                                    min={0}
                                                                    step={5}
                                                                    className="flex-1"
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditingOpinion(null)}
                                                                >
                                                                    ยกเลิก
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="h-2 chamfered-sm bg-muted overflow-hidden cursor-pointer hover:ring-2 ring-[var(--forge-gold)]/50 transition-all"
                                                                onClick={() => setEditingOpinion(rel.id)}
                                                                title="คลิกเพื่อแก้ไข"
                                                            >
                                                                <div
                                                                    className={`h-full transition-all ${getOpinionColor(rel.opinionLevel)}`}
                                                                    style={{ width: `${rel.opinionLevel}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                            </div>
                        )}
                </div>

                {/* Factions membership */}
                <div>
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">สังกัด / กลุ่ม</span>
                        <span className="flex-1 h-px bg-border/70" />
                        <Button onClick={() => setIsFactionAddOpen(true)} size="sm" variant="ghost" className="h-7 px-2 text-xs">
                            <Plus className="h-3.5 w-3.5 mr-1" />เข้าร่วม
                        </Button>
                    </div>
                    {isLoading ? null : factions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">ยังไม่ได้สังกัดกลุ่มใด</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {factions.map((membership) => (
                                <div key={membership.id} className="flex items-center gap-2 py-1.5 pl-1.5 pr-2 chamfered-sm border border-border bg-card/50">
                                    <div className="w-7 h-7 chamfered-sm bg-[var(--forge-gold)]/15 flex items-center justify-center font-display font-bold text-sm text-[var(--forge-amber)]">
                                        {membership.faction.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-sm font-medium">{membership.faction.name}</span>
                                        <span className="font-technical text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{membership.role || "สมาชิก"}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-muted-foreground hover:text-red-500" onClick={() => setDeleteFactionId(membership.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <AddRelationshipDialog
                    novelId={novelId}
                    sourceCharacterId={characterId}
                    open={isAddOpen}
                    onOpenChange={setIsAddOpen}
                    onSuccess={fetchData}
                />

                <ManageFactionDialog
                    novelId={novelId}
                    characterId={characterId}
                    open={isFactionAddOpen}
                    onOpenChange={setIsFactionAddOpen}
                    onSuccess={fetchData}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>ลบความสัมพันธ์</AlertDialogTitle>
                            <AlertDialogDescription>
                                ต้องการลบความสัมพันธ์นี้ใช่ไหม?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                ลบ
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!deleteFactionId} onOpenChange={(open) => !open && setDeleteFactionId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>ออกจากกลุ่ม</AlertDialogTitle>
                            <AlertDialogDescription>
                                ต้องการออกจากกลุ่มนี้ใช่ไหม?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRemoveFaction} className="bg-red-600 hover:bg-red-700">
                                ออก
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Relationship Timeline Dialog */}
                {timelineRelId && (
                    <RelationshipTimeline
                        relationshipId={timelineRelId}
                        novelId={novelId}
                        currentOpinionLevel={
                            relationships.find(r => r.id === timelineRelId)?.opinionLevel ?? 50
                        }
                        characterName={timelineCharName}
                        open={!!timelineRelId}
                        onOpenChange={(open) => !open && setTimelineRelId(null)}
                        onUpdate={fetchData}
                    />
                )}
            </div>
        </>
    );
}
