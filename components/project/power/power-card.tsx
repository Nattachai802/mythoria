"use client";

import { Power, PowerLevel } from "@/db/schema";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreVertical,
    Pencil,
    Trash2,
    Zap,
    ChevronRight,
    Flame,
    Dumbbell,
    Brain,
    HeartPulse,
    Sparkles,
    AlertTriangle,
    type LucideIcon,
} from "lucide-react";
import { deletePower } from "@/server/power";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface PowerCardProps {
    power: Power & { levels?: PowerLevel[] };
    novelId: string;
    onEdit?: () => void;
    onClick?: () => void;
}

// Rarity tiers — distinct hues (meaningful, not decorative), tuned for both themes; legendary ties to the forge gold
const rarityConfig: Record<string, { label: string; className: string }> = {
    common: { label: "ทั่วไป", className: "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300" },
    rare: { label: "หายาก", className: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    epic: { label: "มหากาพย์", className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    legendary: { label: "ตำนาน", className: "border-[var(--forge-gold)]/40 bg-[var(--forge-gold)]/15 text-[var(--forge-amber)]" },
};

// Lucide icons replace the old emoji map (font-dependent, off-brand)
const typeConfig: Record<string, { label: string; Icon: LucideIcon }> = {
    elemental: { label: "ธาตุ", Icon: Flame },
    physical: { label: "กายภาพ", Icon: Dumbbell },
    mental: { label: "จิต", Icon: Brain },
    support: { label: "สนับสนุน", Icon: HeartPulse },
    special: { label: "พิเศษ", Icon: Sparkles },
};

export function PowerCard({ power, novelId, onEdit, onClick }: PowerCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm(`ต้องการลบพลัง "${power.name}" ใช่ไหม?`)) {
            return;
        }

        setIsDeleting(true);
        const result = await deletePower(power.id);

        if (result.success) {
            toast.success("ลบพลังเรียบร้อย");
        } else {
            toast.error(result.error || "ลบพลังไม่สำเร็จ");
            setIsDeleting(false);
        }
    };

    const handleCardClick = () => {
        if (onClick) {
            onClick();
        } else {
            router.push(`/dashboard/project/${novelId}/powers/${power.id}`);
        }
    };

    const levelCount = power.levels?.length || 0;
    const maxLevel = power.maxLevel || 10;
    const levelProgress = Math.min(100, Math.round((levelCount / maxLevel) * 100));

    const accent = power.color || "var(--forge-gold)";
    const rarity = rarityConfig[power.rarity || "common"] ?? rarityConfig.common;
    const type = typeConfig[power.type || "special"] ?? typeConfig.special;
    const TypeIcon = type.Icon;
    const limitations = (power.limitations as string[] | null) || [];

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick();
                }
            }}
            className="group chamfered border border-border bg-card/50 p-5 flex flex-col cursor-pointer transition-colors hover:border-[var(--forge-gold)]/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-gold)]/50"
        >
            {/* Header: icon tile + name + dropdown */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                        className="w-11 h-11 chamfered-sm flex items-center justify-center shrink-0 border"
                        style={{ backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)`, borderColor: `color-mix(in oklch, ${accent} 35%, transparent)` }}
                    >
                        {power.icon ? (
                            <span className="text-xl leading-none">{power.icon}</span>
                        ) : (
                            <TypeIcon className="w-5 h-5" style={{ color: accent }} strokeWidth={2} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="font-display font-bold text-lg leading-tight truncate">
                            {power.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn("inline-flex items-center chamfered-sm border px-1.5 py-0.5 text-[10px] font-medium", rarity.className)}>
                                {rarity.label}
                            </span>
                            <span className="inline-flex items-center gap-1 font-technical text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                                <TypeIcon className="w-3 h-3" />
                                {type.label}
                            </span>
                        </div>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button
                            className="h-8 w-8 chamfered-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-gold)]/50"
                            aria-label="ตัวเลือกพลัง"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            แก้ไข
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            disabled={isDeleting}
                            className="text-red-600 focus:text-red-600"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isDeleting ? "กำลังลบ…" : "ลบ"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Description */}
            {power.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-3">
                    {power.description}
                </p>
            )}

            {/* Limitations */}
            {limitations.length > 0 && (
                <div className="mt-3 space-y-1">
                    {limitations.slice(0, 2).map((limitation, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{limitation}</span>
                        </div>
                    ))}
                    {limitations.length > 2 && (
                        <span className="text-xs text-muted-foreground pl-[18px]">
                            และอีก {limitations.length - 2} ข้อ
                        </span>
                    )}
                </div>
            )}

            {/* Footer: level progress */}
            <div className="mt-4 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        ระดับพลัง
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="font-display text-sm font-bold tabular-nums leading-none">
                            {levelCount}<span className="text-muted-foreground font-normal">/{maxLevel}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground -mr-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                </div>
                <div className="h-1 w-full bg-muted chamfered-sm overflow-hidden">
                    <div
                        className="h-full transition-all"
                        style={{ width: `${levelProgress}%`, backgroundColor: accent }}
                    />
                </div>
            </div>
        </div>
    );
}
