"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle,
    Loader2,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlotHoleCheckerProps {
    novelId: string;
    noteId: string;
    content: string;
    characterIds?: string[];
}

interface PlotIssue {
    type: string;
    description: string;
}

interface AnalysisResult {
    analysis: string;
    issues: PlotIssue[];
    tool_calls: { tool: string; args: any }[];
}

export function PlotHoleChecker({
    novelId,
    noteId,
    content,
    characterIds = []
}: PlotHoleCheckerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async () => {
        if (!content || content.trim().length < 10) {
            toast.warning("เนื้อหาสั้นเกินไป", {
                description: "กรุณาเขียนเนื้อหาอย่างน้อย 10 ตัวอักษร",
            });
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Extract plain text from HTML
            const plainText = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();

            const response = await fetch("http://localhost:8000/analyze-plot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    novel_id: novelId,
                    content_text: plainText,
                    character_ids: characterIds,
                    note_id: noteId,
                }),
            });

            if (!response.ok) {
                throw new Error("Python service error");
            }

            const data: AnalysisResult = await response.json();
            setResult(data);
            setIsOpen(true);

            if (data.issues.length > 0) {
                toast.warning("พบปัญหาที่อาจเป็น Plot Hole", {
                    description: `พบ ${data.issues.length} ปัญหา`,
                });
            } else {
                toast.success("ไม่พบปัญหา Plot Hole", {
                    description: "เนื้อหาสอดคล้องดี",
                });
            }
        } catch (err) {
            setError("ไม่สามารถเชื่อมต่อ Python service ได้ (port 8000)");
            toast.error("ตรวจสอบไม่สำเร็จ", {
                description: "Python service อาจไม่ได้รัน",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const issueCount = result?.issues.length || 0;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCheck}
                    disabled={isLoading}
                    className="h-6 px-2 text-xs gap-1.5"
                >
                    {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : issueCount > 0 ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                    ) : result ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                        <AlertTriangle className="h-3 w-3" />
                    )}
                    {isLoading ? "กำลังตรวจ..." : "Check Plot Hole"}
                </Button>

                {result && (
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            {isOpen ? (
                                <ChevronUp className="h-3 w-3" />
                            ) : (
                                <ChevronDown className="h-3 w-3" />
                            )}
                        </Button>
                    </CollapsibleTrigger>
                )}

                {issueCount > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                        {issueCount} issues
                    </Badge>
                )}
            </div>

            <CollapsibleContent>
                {result && (
                    <div className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-3 text-sm">
                        {/* Issues */}
                        {result.issues.length > 0 && (
                            <div className="space-y-2">
                                <div className="font-medium text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    ปัญหาที่พบ:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    {result.issues.map((issue, i) => (
                                        <li key={i} className="text-xs">
                                            <span className="font-medium">[{issue.type}]</span> {issue.description}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* AI Analysis */}
                        <div className="space-y-1">
                            <div className="font-medium text-xs">การวิเคราะห์จาก AI:</div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {result.analysis || "ไม่มีการวิเคราะห์เพิ่มเติม"}
                            </p>
                        </div>

                        {/* Tools Used */}
                        {result.tool_calls.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">Tools ที่ใช้:</span>
                                {result.tool_calls.map((tc, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                        {tc.tool}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
