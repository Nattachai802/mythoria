"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Check, Edit, X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
export interface AISuggestion {
    id: string;
    novelId: string;
    characterId?: string;
    suggestionType: string;
    targetTable: string;
    suggestedData: Record<string, unknown>;
    confidence?: number;
    reasoning?: string;
    sourceChapterId?: string;
    sourceExcerpt?: string;
    status: string;
    character?: {
        id: string;
        name: string;
        image?: string;
    };
    sourceChapter?: {
        id: string;
        title: string;
        orderIndex: number;
    };
}

interface AISuggestionCardProps {
    suggestion: AISuggestion;
    onAccept: () => void;
    onReject: () => void;
    onModify: (modifiedData: Record<string, unknown>) => void;
    isProcessing?: boolean;
}

export function AISuggestionCard({
    suggestion,
    onAccept,
    onReject,
    onModify,
    isProcessing = false,
}: AISuggestionCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<Record<string, unknown>>(
        suggestion.suggestedData
    );
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSaveEdit = () => {
        onModify(editedData);
        setIsEditing(false);
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return "bg-green-500";
        if (confidence >= 60) return "bg-yellow-500";
        return "bg-orange-500";
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "opinion_level":
                return "ระดับความสัมพันธ์";
            case "life_event":
                return "เหตุการณ์สำคัญ";
            case "relationship_history":
                return "ประวัติความสัมพันธ์";
            case "faction_change":
                return "เปลี่ยนฝ่าย";
            default:
                return type;
        }
    };

    return (
        <Card className="border-blue-500/50 bg-blue-500/5 overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">AI แนะนำ</span>
                        <Badge variant="outline" className="text-xs">
                            {getTypeLabel(suggestion.suggestionType)}
                        </Badge>
                    </div>
                    {suggestion.confidence && (
                        <Badge
                            variant="secondary"
                            className={cn(
                                "text-white",
                                getConfidenceColor(suggestion.confidence)
                            )}
                        >
                            {suggestion.confidence}% confident
                        </Badge>
                    )}
                </div>
                {/* Character name */}
                {suggestion.character && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">ตัวละคร:</span>
                        <Badge variant="secondary" className="text-xs font-medium">
                            {suggestion.character.name}
                        </Badge>
                    </div>
                )}
            </CardHeader>

            <CardContent className="pb-2">
                {/* Render based on suggestion type */}
                {suggestion.suggestionType === "opinion_level" && (
                    <OpinionLevelSuggestion
                        data={suggestion.suggestedData}
                        isEditing={isEditing}
                        editedData={editedData}
                        onEdit={setEditedData}
                    />
                )}

                {suggestion.suggestionType === "life_event" && (
                    <LifeEventSuggestion
                        data={suggestion.suggestedData}
                        isEditing={isEditing}
                        editedData={editedData}
                        onEdit={setEditedData}
                    />
                )}

                {/* Reasoning (collapsible) */}
                {suggestion.reasoning && (
                    <div className="mt-3">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                            เหตุผล
                        </button>
                        {isExpanded && (
                            <p className="mt-1 text-sm text-muted-foreground pl-5">
                                {suggestion.reasoning}
                            </p>
                        )}
                    </div>
                )}

                {/* Source note/chapter */}
                {(suggestion.suggestedData?.chapter_title || suggestion.sourceChapter) && (
                    <div className="mt-2 text-xs text-muted-foreground">
                        จาก: {(suggestion.suggestedData?.chapter_title as string) || suggestion.sourceChapter?.title}
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex gap-2 pt-2">
                {isEditing ? (
                    <>
                        <Button
                            onClick={handleSaveEdit}
                            size="sm"
                            disabled={isProcessing}
                        >
                            <Check className="h-4 w-4 mr-1" /> บันทึก
                        </Button>
                        <Button
                            onClick={() => {
                                setEditedData(suggestion.suggestedData);
                                setIsEditing(false);
                            }}
                            variant="outline"
                            size="sm"
                        >
                            ยกเลิก
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={onAccept}
                            size="sm"
                            disabled={isProcessing}
                        >
                            <Check className="h-4 w-4 mr-1" /> ยอมรับ
                        </Button>
                        <Button
                            onClick={() => setIsEditing(true)}
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                        >
                            <Edit className="h-4 w-4 mr-1" /> แก้ไข
                        </Button>
                        <Button
                            onClick={onReject}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={isProcessing}
                        >
                            <X className="h-4 w-4 mr-1" /> ปฏิเสธ
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}

// Sub-component for Opinion Level suggestions
interface OpinionLevelSuggestionProps {
    data: Record<string, unknown>;
    isEditing: boolean;
    editedData: Record<string, unknown>;
    onEdit: (data: Record<string, unknown>) => void;
}

function OpinionLevelSuggestion({
    data,
    isEditing,
    editedData,
    onEdit,
}: OpinionLevelSuggestionProps) {
    const opinionLevel = (isEditing ? editedData.opinion_level : data.opinion_level) as number;
    const sentiment = (isEditing ? editedData.sentiment : data.sentiment) as string;
    const sourceCharacterName = data.source_character_name as string | undefined;
    const targetCharacterName = data.target_character_name as string | undefined;

    const getOpinionLabel = (level: number) => {
        if (level >= 80) return "สนิทมาก";
        if (level >= 60) return "เป็นมิตร";
        if (level >= 40) return "ปกติ";
        if (level >= 20) return "ไม่ชอบ";
        return "เป็นศัตรู";
    };

    const getOpinionColor = (level: number) => {
        if (level >= 80) return "text-emerald-500";
        if (level >= 60) return "text-green-400";
        if (level >= 40) return "text-yellow-400";
        if (level >= 20) return "text-orange-400";
        return "text-red-500";
    };

    return (
        <div className="space-y-3">
            {/* Character names */}
            {(sourceCharacterName || targetCharacterName) && (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                    {sourceCharacterName && (
                        <Badge variant="secondary" className="font-medium">
                            {sourceCharacterName}
                        </Badge>
                    )}
                    {sourceCharacterName && targetCharacterName && (
                        <span className="text-muted-foreground">→</span>
                    )}
                    {targetCharacterName && (
                        <Badge variant="secondary" className="font-medium">
                            {targetCharacterName}
                        </Badge>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between text-sm">
                <span>ระดับความสัมพันธ์:</span>
                <span className={cn("font-semibold", getOpinionColor(opinionLevel))}>
                    {opinionLevel}/100 ({getOpinionLabel(opinionLevel)})
                </span>
            </div>

            {isEditing ? (
                <Slider
                    value={[opinionLevel]}
                    onValueChange={([value]) =>
                        onEdit({ ...editedData, opinion_level: value })
                    }
                    max={100}
                    step={5}
                    className="w-full"
                />
            ) : (
                <div className="w-full bg-muted rounded-full h-2">
                    <div
                        className={cn(
                            "h-2 rounded-full",
                            opinionLevel >= 80 ? "bg-emerald-500" :
                                opinionLevel >= 60 ? "bg-green-400" :
                                    opinionLevel >= 40 ? "bg-yellow-400" :
                                        opinionLevel >= 20 ? "bg-orange-400" : "bg-red-500"
                        )}
                        style={{ width: `${opinionLevel}%` }}
                    />
                </div>
            )}

            <div className="flex items-center gap-2 text-sm">
                <span>อารมณ์:</span>
                <Badge variant="outline">{sentiment}</Badge>
            </div>
        </div>
    );
}

// Sub-component for Life Event suggestions
interface LifeEventSuggestionProps {
    data: Record<string, unknown>;
    isEditing: boolean;
    editedData: Record<string, unknown>;
    onEdit: (data: Record<string, unknown>) => void;
}

function LifeEventSuggestion({
    data,
    isEditing,
    editedData,
    onEdit,
}: LifeEventSuggestionProps) {
    const title = (isEditing ? editedData.title : data.title) as string;
    const description = (isEditing ? editedData.description : data.description) as string;
    const eventType = data.event_type as string;
    const impact = data.impact as string;
    const importance = data.importance as number;

    const getEventTypeIcon = (type: string) => {
        switch (type) {
            case "trauma": return "💔";
            case "achievement": return "🏆";
            case "loss": return "⚰️";
            case "discovery": return "💡";
            case "transformation": return "🦋";
            case "relationship": return "💕";
            case "power": return "⚡";
            default: return "📌";
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case "positive": return "text-green-500";
            case "negative": return "text-red-500";
            default: return "text-gray-500";
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <span className="text-lg">{getEventTypeIcon(eventType)}</span>
                {isEditing ? (
                    <input
                        type="text"
                        value={title}
                        onChange={(e) =>
                            onEdit({ ...editedData, title: e.target.value })
                        }
                        className="flex-1 bg-background border rounded px-2 py-1 text-sm"
                    />
                ) : (
                    <span className="font-medium">{title}</span>
                )}
            </div>

            {isEditing ? (
                <Textarea
                    value={description}
                    onChange={(e) =>
                        onEdit({ ...editedData, description: e.target.value })
                    }
                    className="text-sm"
                    rows={2}
                />
            ) : (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}

            <div className="flex items-center gap-4 text-xs">
                <span className={getImpactColor(impact)}>
                    ผลกระทบ: {impact === "positive" ? "ดี" : impact === "negative" ? "แย่" : "กลาง"}
                </span>
                <span>ความสำคัญ: {importance}/10</span>
            </div>
        </div>
    );
}
