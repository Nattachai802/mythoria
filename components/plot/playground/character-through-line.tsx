"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Route, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getElementSceneHistory } from "@/server/scene-element-details";
import { ROLES } from "./scene-participants-panel";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    novelId: string;
    elementType: "character" | "faction";
    elementId: string;
    elementName: string;
    currentSceneId?: string;
}

// เส้นเรื่องของตัวละคร/กลุ่มฝ่ายข้ามทุกฉากในนิยาย (B) — เชื่อม action ต่อซีนเข้าเป็น arc เดียว
export function CharacterThroughLine({
    open, onOpenChange, novelId, elementType, elementId, elementName, currentSceneId,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<any[]>([]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        getElementSceneHistory(novelId, elementType, elementId).then(res => {
            if (cancelled) return;
            const data = res.success && res.data ? res.data : [];
            // เรียงตามลำดับฉาก แล้วเก็บเฉพาะรายการที่มี action/outcome จริง
            const sorted = [...data]
                .filter(d => d.action || d.outcome)
                .sort((a, b) => (a.scene?.orderIndex ?? 0) - (b.scene?.orderIndex ?? 0));
            setRows(sorted);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [open, novelId, elementType, elementId]);

    const Icon = elementType === "faction" ? Shield : User;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Route className="w-5 h-5 text-[var(--forge-amber)]" />
                        <span>เส้นเรื่อง: {elementName}</span>
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                        ยังไม่มีการกระทำของ{elementName}ในฉากใดเลย
                    </p>
                ) : (
                    <ol className="relative border-l border-border ml-3 space-y-4 py-2">
                        {rows.map((d) => {
                            const isCurrent = d.sceneId === currentSceneId;
                            const role = ROLES.find(r => r.value === d.role);
                            return (
                                <li key={d.id} className="ml-4">
                                    <span className={cn(
                                        "absolute -left-[7px] w-3.5 h-3.5 rounded-full border-2 border-background",
                                        isCurrent ? "bg-[var(--forge-amber)]" : "bg-muted-foreground/40"
                                    )} />
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                                        <span className="text-xs font-semibold text-foreground truncate">
                                            {d.scene?.title || "(ฉากไม่มีชื่อ)"}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-[9px] uppercase tracking-wide text-[var(--forge-amber)] shrink-0">ฉากนี้</span>
                                        )}
                                        {role && (
                                            <span className={cn("px-1.5 py-0.5 rounded-[3px] text-[8px] uppercase border tracking-wider shrink-0", role.cls)}>
                                                {role.label}
                                            </span>
                                        )}
                                    </div>
                                    {d.action && (
                                        <p className="text-sm text-foreground/90">{d.action}</p>
                                    )}
                                    {d.outcome && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            <span className="font-semibold">→ </span>{d.outcome}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                )}
            </DialogContent>
        </Dialog>
    );
}
