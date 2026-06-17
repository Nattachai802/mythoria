"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    X, Clock, MapPin, Globe, Layers, Pencil, Maximize2, ChevronRight, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LoreEntry {
    id: string;
    title: string;
    content?: string | null;
    type?: string | null;
    scope?: string | null;
    location?: { name: string } | null;
    era?: { id: string; name: string; color: string; icon?: string } | null;
    group?: { id: string; name: string; color: string; icon?: string } | null;
    icon?: string | null;
    color?: string | null;
    importance?: number | null;
    parentLoreId?: string | null;
}

const TYPE_ICONS: Record<string, string> = {
    event: "⚡", legend: "📜", prophecy: "🔮", mythology: "🐉", history: "📚",
};
const TYPE_COLORS: Record<string, string> = {
    event: "#f59e0b", legend: "#8b5cf6", prophecy: "#ec4899", mythology: "#10b981", history: "#3b82f6",
};
const TYPE_LABELS: Record<string, string> = {
    event: "เหตุการณ์", legend: "ตำนาน", prophecy: "คำพยากรณ์", mythology: "เทพปกรณัม", history: "ประวัติศาสตร์",
};

function stripHtml(html: string | null | undefined): string {
    if (!html) return "";
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .trim();
}

interface Props {
    entry: LoreEntry | null;
    children?: LoreEntry[];     // node ย่อยของ entry นี้
    onClose: () => void;
    onEdit: (entry: LoreEntry) => void;
    onOpenFull: (entry: LoreEntry) => void;
    onInspectChild: (child: LoreEntry) => void;
}

export function LoreInspectorPanel({
    entry, children = [], onClose, onEdit, onOpenFull, onInspectChild,
}: Props) {
    // ปิดด้วย Escape
    useEffect(() => {
        if (!entry) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [entry, onClose]);

    const open = !!entry;
    const color = entry?.color || TYPE_COLORS[entry?.type || "event"] || "#8b5cf6";
    const icon = entry?.icon || TYPE_ICONS[entry?.type || "event"] || "⚡";
    const typeLabel = entry?.type ? (TYPE_LABELS[entry.type] || entry.type) : null;
    const importance = entry?.importance ?? 0;
    const text = stripHtml(entry?.content);

    return (
        <div
            className={cn(
                "fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] bg-background border-l border-border shadow-2xl",
                "flex flex-col transition-transform duration-300 ease-out",
                open ? "translate-x-0" : "translate-x-full pointer-events-none"
            )}
            role="complementary"
            aria-hidden={!open}
        >
            {entry && (
                <>
                    {/* Header */}
                    <div className="relative p-4 border-b" style={{ borderTop: `4px solid ${color}` }}>
                        <div className="flex items-start gap-3 pr-8">
                            <div
                                className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0"
                                style={{ background: `${color}1a`, border: `1px solid ${color}33` }}
                            >
                                {icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1 mb-1">
                                    {typeLabel && (
                                        <Badge variant="outline" className="text-[9px] uppercase font-bold border-0 px-1.5"
                                            style={{ color, background: `${color}15` }}>
                                            {typeLabel}
                                        </Badge>
                                    )}
                                    {entry.era && (
                                        <Badge variant="outline" className="text-[9px] gap-0.5">
                                            <Clock className="w-2 h-2" />{entry.era.name}
                                        </Badge>
                                    )}
                                    {entry.group && (
                                        <Badge variant="outline" className="text-[9px] gap-0.5">
                                            <Layers className="w-2 h-2" />{entry.group.name}
                                        </Badge>
                                    )}
                                </div>
                                <h3 className="font-bold text-base leading-snug text-foreground">{entry.title}</h3>
                                {importance > 0 && (
                                    <div className="flex items-center gap-0.5 mt-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} className={cn("h-3 w-3", i < importance ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            aria-label="ปิด"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Content */}
                        <div className="space-y-1.5">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">เนื้อหา</h4>
                            {text ? (
                                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{text}</p>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">ยังไม่มีเนื้อหา</p>
                            )}
                        </div>

                        {/* Scope / location */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/30 border">
                            {entry.scope === "location" && entry.location ? (
                                <><MapPin className="w-3.5 h-3.5 text-emerald-500" /><span>สถานที่: {entry.location.name}</span></>
                            ) : (
                                <><Globe className="w-3.5 h-3.5 text-blue-500" /><span>ระดับโลก (World Lore)</span></>
                            )}
                        </div>

                        {/* Children navigation */}
                        {children.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    node ย่อย ({children.length})
                                </h4>
                                <div className="space-y-1">
                                    {children.map(child => {
                                        const cColor = child.color || TYPE_COLORS[child.type || "event"] || "#8b5cf6";
                                        return (
                                            <button
                                                key={child.id}
                                                onClick={() => onInspectChild(child)}
                                                className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/40 transition-colors text-left group"
                                            >
                                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cColor }} />
                                                <span className="text-xs flex-1 truncate text-foreground">{child.title}</span>
                                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="p-3 border-t bg-muted/10 flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => onEdit(entry)}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />แก้ไข
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => onOpenFull(entry)}>
                            <Maximize2 className="h-3.5 w-3.5 mr-1.5" />เปิดเต็ม
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
