"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AISuggestionCard, type AISuggestion } from "./ai-suggestion-card";

interface AIAnalysisDialogProps {
    novelId: string;
    characterId?: string;
    characterName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuggestionsApplied?: () => void;
}

interface AnalysisProgress {
    type: "start" | "info" | "progress" | "result" | "complete" | "error";
    current?: string;
    progress?: number;
    total?: number;
    message?: string;
    suggestions?: {
        relationships: unknown[];
        life_events: unknown[];
        chapters_analyzed: string[];
    };
}

export function AIAnalysisDialog({
    novelId,
    characterId,
    characterName,
    open,
    onOpenChange,
    onSuggestionsApplied,
}: AIAnalysisDialogProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState<AnalysisProgress | null>(null);
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [pendingSuggestions, setPendingSuggestions] = useState<AISuggestion[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Fetch existing pending suggestions - show all for the novel
    const fetchPendingSuggestions = useCallback(async () => {
        try {
            const url = new URL(
                `/api/novel/${novelId}/ai-suggestions`,
                window.location.origin
            );
            url.searchParams.set("status", "pending");
            // Show all suggestions for the novel, not filtered by character

            const response = await fetch(url.toString());
            const data = await response.json();

            if (data.success) {
                setPendingSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error("Error fetching suggestions:", error);
        }
    }, [novelId]);

    useEffect(() => {
        if (open) {
            fetchPendingSuggestions();
        }
    }, [open, fetchPendingSuggestions]);

    // Start AI analysis using fetch streaming
    const startAnalysis = async () => {
        setIsAnalyzing(true);
        setProgress({ type: "start" });
        setSuggestions([]);

        try {
            const url = new URL(
                `http://localhost:8000/analyze-characters-stream/${novelId}`,
            );
            if (characterId) {
                url.searchParams.set("character_id", characterId);
            }

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Accept": "text/event-stream",
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const jsonStr = line.slice(6);
                            const data: AnalysisProgress = JSON.parse(jsonStr);
                            setProgress(data);

                            if (data.type === "complete") {
                                setIsAnalyzing(false);

                                // Save suggestions and mark chapters as analyzed
                                if (data.suggestions) {
                                    await saveSuggestions(data.suggestions);
                                    await markChaptersAnalyzed(data.suggestions.chapters_analyzed);

                                    // Fetch updated pending suggestions
                                    await fetchPendingSuggestions();
                                }

                                toast.success("วิเคราะห์เสร็จสิ้น!");
                                return;
                            }

                            if (data.type === "error") {
                                setIsAnalyzing(false);
                                toast.error(data.message || "เกิดข้อผิดพลาด");
                                return;
                            }
                        } catch (e) {
                            console.error("Error parsing SSE:", e, line);
                        }
                    }
                }
            }

            setIsAnalyzing(false);
        } catch (error) {
            setIsAnalyzing(false);
            toast.error("ไม่สามารถเริ่มการวิเคราะห์: " + String(error));
            console.error(error);
        }
    };

    // Save suggestions to database
    const saveSuggestions = async (data: {
        relationships: unknown[];
        life_events: unknown[];
    }) => {
        const allSuggestions = [
            ...data.relationships.map((r) => ({
                ...(r as Record<string, unknown>),
                suggestionType: "opinion_level",
            })),
            ...data.life_events.map((e) => ({
                ...(e as Record<string, unknown>),
                suggestionType: "life_event",
            })),
        ];

        if (allSuggestions.length === 0) return;

        await fetch(`/api/novel/${novelId}/ai-suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ suggestions: allSuggestions }),
        });
    };

    // Mark chapters as analyzed
    const markChaptersAnalyzed = async (chapterIds: string[]) => {
        if (!chapterIds.length) return;

        await fetch(`/api/novel/${novelId}/analysis-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chapterIds }),
        });
    };

    // Handle accept suggestion
    const handleAccept = async (suggestion: AISuggestion) => {
        setProcessingId(suggestion.id);
        try {
            const response = await fetch(`/api/novel/${novelId}/ai-suggestions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    suggestionId: suggestion.id,
                    action: "accept",
                }),
            });

            const data = await response.json();
            if (data.success) {
                setPendingSuggestions((prev) =>
                    prev.filter((s) => s.id !== suggestion.id)
                );
                toast.success("บันทึกข้อมูลแล้ว");
                onSuggestionsApplied?.();
            } else {
                toast.error("เกิดข้อผิดพลาด");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };

    // Handle reject suggestion
    const handleReject = async (suggestion: AISuggestion) => {
        setProcessingId(suggestion.id);
        try {
            const response = await fetch(`/api/novel/${novelId}/ai-suggestions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    suggestionId: suggestion.id,
                    action: "reject",
                }),
            });

            const data = await response.json();
            if (data.success) {
                setPendingSuggestions((prev) =>
                    prev.filter((s) => s.id !== suggestion.id)
                );
                toast.success("ปฏิเสธแล้ว");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };

    // Handle modify suggestion
    const handleModify = async (
        suggestion: AISuggestion,
        modifiedData: Record<string, unknown>
    ) => {
        setProcessingId(suggestion.id);
        try {
            const response = await fetch(`/api/novel/${novelId}/ai-suggestions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    suggestionId: suggestion.id,
                    action: "modify",
                    modifiedData,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setPendingSuggestions((prev) =>
                    prev.filter((s) => s.id !== suggestion.id)
                );
                toast.success("บันทึกข้อมูลที่แก้ไขแล้ว");
                onSuggestionsApplied?.();
            } else {
                toast.error("เกิดข้อผิดพลาด");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
            console.error(error);
        } finally {
            setProcessingId(null);
        }
    };

    const progressPercent = progress?.total
        ? ((progress.progress || 0) / progress.total) * 100
        : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-500" />
                        AI วิเคราะห์ตัวละคร
                        {characterName && ` - ${characterName}`}
                    </DialogTitle>
                    <DialogDescription>
                        AI จะวิเคราะห์เนื้อหาจาก chapters
                        เพื่อแนะนำข้อมูลความสัมพันธ์และเหตุการณ์สำคัญ
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Analysis Controls */}
                    {!isAnalyzing && (
                        <div className="flex justify-center">
                            <Button onClick={startAnalysis} size="lg">
                                <Sparkles className="h-4 w-4 mr-2" />
                                เริ่มวิเคราะห์
                            </Button>
                        </div>
                    )}

                    {/* Progress */}
                    {isAnalyzing && progress && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                <span className="text-sm">
                                    กำลังวิเคราะห์: {progress.current || "..."}
                                </span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                            <div className="text-xs text-muted-foreground text-right">
                                {progress.progress || 0} / {progress.total || 0}
                            </div>
                        </div>
                    )}

                    {/* Pending Suggestions */}
                    {pendingSuggestions.length > 0 && (
                        <div className="flex flex-col min-h-0">
                            <div className="flex items-center justify-between pb-2">
                                <h3 className="font-medium">
                                    ข้อเสนอแนะ ({pendingSuggestions.length})
                                </h3>
                                <div className="text-xs text-muted-foreground">
                                    ตรวจสอบและยืนยันข้อมูลที่ AI แนะนำ
                                </div>
                            </div>

                            <ScrollArea className="max-h-[50vh] pr-4">
                                <div className="space-y-3">
                                    {pendingSuggestions.map((suggestion) => (
                                        <AISuggestionCard
                                            key={suggestion.id}
                                            suggestion={suggestion}
                                            onAccept={() => handleAccept(suggestion)}
                                            onReject={() => handleReject(suggestion)}
                                            onModify={(data) =>
                                                handleModify(suggestion, data)
                                            }
                                            isProcessing={processingId === suggestion.id}
                                        />
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {/* No suggestions */}
                    {!isAnalyzing &&
                        pendingSuggestions.length === 0 &&
                        progress?.type === "complete" && (
                            <div className="text-center py-8 text-muted-foreground">
                                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                                <p>ไม่มีข้อเสนอแนะใหม่</p>
                                <p className="text-sm">
                                    Chapters ทั้งหมดได้รับการวิเคราะห์แล้ว
                                </p>
                            </div>
                        )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
