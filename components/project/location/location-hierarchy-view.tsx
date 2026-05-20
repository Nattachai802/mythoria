"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EditLocationDialog } from "./edit-location-dialog";
import { CreateLocationDialog } from "./create-location-dialog";
import { Location } from "@/db/schema";
import { Input } from "@/components/ui/input";
import {
    ChevronRight,
    CornerDownRight,
    MoreVertical,
    Pencil,
    Trash2,
    Plus,
    MapPin,
    ArrowUpRight,
    Search,
    ChevronDown,
    FolderMinus,
    FolderPlus
} from "lucide-react";
import Link from "next/link";
import { deleteLocation } from "@/server/locations";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LocationHierarchyViewProps {
    locations: any[];
    novelId: string;
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
    city: { color: "text-blue-500", icon: "🏙️", bg: "bg-blue-500/10" },
    country: { color: "text-purple-500", icon: "🗺️", bg: "bg-purple-500/10" },
    building: { color: "text-orange-500", icon: "🏛️", bg: "bg-orange-500/10" },
    forest: { color: "text-green-500", icon: "🌲", bg: "bg-green-500/10" },
    mountain: { color: "text-gray-500", icon: "⛰️", bg: "bg-gray-500/10" },
    ocean: { color: "text-cyan-500", icon: "🌊", bg: "bg-cyan-500/10" },
    desert: { color: "text-yellow-500", icon: "🏜️", bg: "bg-yellow-500/10" },
    village: { color: "text-amber-500", icon: "🏘️", bg: "bg-amber-500/10" },
    dungeon: { color: "text-rose-500", icon: "🏰", bg: "bg-rose-500/10" },
    cave: { color: "text-stone-500", icon: "🕳️", bg: "bg-stone-500/10" },
};

const TYPE_BADGE_CONFIG: Record<string, string> = {
    city: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30",
    country: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30",
    building: "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/30",
    forest: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30",
    mountain: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-200/50 dark:border-slate-900/30",
    ocean: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-900/30",
    desert: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30",
    village: "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-900/30",
    dungeon: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30",
    cave: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-900/30",
};

// ⚡ Pulsing Ley-line SVG Connector
function LeyLine({
    isLast,
    isHoveredPath
}: {
    isLast: boolean;
    isHoveredPath: boolean;
}) {
    return (
        <div className="absolute left-[-20px] top-0 bottom-0 w-[20px] pointer-events-none">
            {/* เส้นแนวตั้งคงที่ */}
            <div
                className={`absolute left-0 top-0 transition-all duration-300 ${
                    isLast ? "h-[24px]" : "bottom-0"
                } border-l border-dashed ${
                    isHoveredPath 
                        ? "border-primary border-solid border-l-[2px]" 
                        : "border-muted-foreground/15"
                }`}
            />
            
            {/* เส้นโค้งเลี้ยวหักมุม L-shape */}
            <svg 
                className="absolute left-0 top-0 w-[20px] h-[24px]" 
                viewBox="0 0 20 24" 
                fill="none"
            >
                <path
                    d="M 0 0 V 12 Q 0 24 20 24"
                    className={`${
                        isHoveredPath 
                            ? "stroke-primary stroke-2" 
                            : "stroke-muted-foreground/15 stroke-[1.5]"
                    } transition-colors duration-300`}
                    strokeLinecap="round"
                />
                
                {/* แสงเอฟเฟกต์ไหลเรืองแสงบนเส้นทางที่มีการ Hover (Ley-line Animation) */}
                {isHoveredPath && (
                    <>
                        <path
                            d="M 0 0 V 12 Q 0 24 20 24"
                            className="stroke-primary/30 stroke-[4] blur-[2px]"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 0 0 V 12 Q 0 24 20 24"
                            stroke="url(#pulse-gradient)"
                            className="pulse-path stroke-2"
                            strokeLinecap="round"
                        />
                    </>
                )}
            </svg>
        </div>
    );
}

function TreeNode({
    location,
    locations,
    novelId,
    onEdit,
    depth = 0,
    allExpanded,
    globalKey,
    searchQuery,
    isLast,
    hoveredNodeId,
    setHoveredNodeId,
    hoveredAncestors
}: {
    location: any;
    locations: any[];
    novelId: string;
    onEdit: (loc: any) => void;
    depth?: number;
    allExpanded: boolean | null;
    globalKey: number;
    searchQuery: string;
    isLast: boolean;
    hoveredNodeId: string | null;
    setHoveredNodeId: (id: string | null) => void;
    hoveredAncestors: string[];
}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);

    const children = locations.filter(loc => loc.parentLocationId === location.id);
    const typeConfig = TYPE_CONFIG[location.type || ""] || { color: "text-gray-500", icon: "📍", bg: "bg-gray-500/10" };
    const badgeStyle = TYPE_BADGE_CONFIG[location.type || ""] || "bg-muted text-muted-foreground border border-border";

    // 🧠 Logic สำหรับ Fog of War: หากสถานที่เพิ่งถูกสร้าง ไม่มีคำอธิบายและไม่มีรูปภาพ = ร่างเขียน (Draft)
    const isDraft = !location.description && !location.image;

    // ตรวจสอบการพับ/กางทั้งหมด
    useEffect(() => {
        if (allExpanded !== null) {
            setIsExpanded(allExpanded);
        }
    }, [allExpanded, globalKey]);

    // จัดการพฤติกรรมเมื่อกำลังค้นหาข้อมูล (Auto expansion)
    useEffect(() => {
        if (searchQuery) {
            const hasMatchingChild = children.some(child => {
                const childMatches = 
                    child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    child.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    child.description?.toLowerCase().includes(searchQuery.toLowerCase());
                if (childMatches) return true;

                const grandchildren = locations.filter(l => l.parentLocationId === child.id);
                return grandchildren.some(gc => 
                    gc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    gc.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    gc.description?.toLowerCase().includes(searchQuery.toLowerCase())
                );
            });

            if (hasMatchingChild) {
                setIsExpanded(true);
            }
        }
    }, [searchQuery, locations]);

    const handleDelete = async () => {
        if (!confirm(`ต้องการลบสถานที่ "${location.name}" หรือไม่? (สถานที่ย่อยภายใต้ตัวนี้จะกลายเป็นสถานที่อิสระ)`)) {
            return;
        }

        setIsDeleting(true);
        const result = await deleteLocation(location.id);

        if (result.success) {
            toast.success("ลบสถานที่สำเร็จ");
        } else {
            toast.error(result.error || "เกิดข้อผิดพลาดในการลบสถานที่");
            setIsDeleting(false);
        }
    };

    // 🎴 กำหนดสไตล์การ์ด Glassmorphism แยกตามความลึก (Visual Depth Layout)
    const getCardStyles = () => {
        if (depth === 0) {
            return "bg-white/70 dark:bg-zinc-950/70 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm rounded-2xl hover:border-primary/40";
        } else if (depth === 1) {
            return "bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200/30 dark:border-zinc-800/30 hover:bg-zinc-200/30 dark:hover:bg-zinc-800/30 rounded-xl";
        } else {
            return "bg-zinc-50/20 dark:bg-zinc-950/10 border border-dashed border-zinc-200/40 dark:border-zinc-800/30 hover:bg-zinc-100/10 dark:hover:bg-zinc-900/10 rounded-lg";
        }
    };

    const matchesSearch = (loc: any): boolean => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();

        const selfMatches = 
            loc.name.toLowerCase().includes(q) || 
            (loc.type && loc.type.toLowerCase().includes(q)) || 
            (loc.description && loc.description.toLowerCase().includes(q));

        if (selfMatches) return true;

        const nodeChildren = locations.filter(l => l.parentLocationId === loc.id);
        return nodeChildren.some(child => matchesSearch(child));
    };

    const filteredChildren = children.filter(child => matchesSearch(child));

    // Ancestry Highlighting Logic
    const isHoveredSelf = hoveredNodeId === location.id;
    const isHoveredAncestor = hoveredAncestors.includes(location.id);
    const isHoveredPath = hoveredNodeId !== null && (isHoveredSelf || isHoveredAncestor);

    // ปรับการดึงแสงโฟกัส (Dimming) ของการ์ดอื่นๆ ที่ไม่เกี่ยวข้อง
    const getDimmingStyles = () => {
        if (!hoveredNodeId) return "opacity-100 scale-100 blur-0";
        if (isHoveredSelf || isHoveredAncestor) return "opacity-100 scale-[1.01] shadow-md border-primary/40 dark:border-primary/30 z-10";
        return "opacity-20 scale-[0.98] blur-[0.5px] pointer-events-none";
    };

    // ปรับสไตล์หมอกจางของ Fog of War (Draft State)
    const getFogStyles = () => {
        if (!isDraft) return "";
        return "opacity-40 backdrop-blur-md hover:opacity-100 hover:backdrop-blur-none transition-all duration-300";
    };

    return (
        <div className={`space-y-1 relative transition-all duration-300 ${getDimmingStyles()}`}>
            {/* วาดสายแร่เรืองแสงเมื่อเป็นชั้นลูก */}
            {depth > 0 && (
                <LeyLine isLast={isLast} isHoveredPath={isHoveredPath} />
            )}

            <div 
                className="flex items-center gap-1 group relative"
                onMouseEnter={() => setHoveredNodeId(location.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
            >
                {/* ปุ่มพับ/กางของกิ่งไม้ */}
                {filteredChildren.length > 0 ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0 z-20"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                    </Button>
                ) : (
                    <div className="w-6 h-6 flex-shrink-0" />
                )}

                {/* ตัวการ์ดสำรวจสถานที่ */}
                <Card className={`flex-1 transition-all duration-300 backdrop-blur-sm ${getCardStyles()} ${getFogStyles()}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                        <Link 
                            href={`/dashboard/project/${novelId}/locations/${location.id}`} 
                            className="flex items-center gap-3 min-w-0 flex-1 group/link"
                        >
                            {/* Thumbnail รูปภาพของสถานที่ */}
                            <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner border border-muted-foreground/10 transition-all duration-300 group-hover:scale-105 group-hover:border-primary/30">
                                {location.image ? (
                                    <img
                                        src={location.image}
                                        alt={location.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-xl">{typeConfig.icon}</span>
                                )}
                            </div>

                            {/* กล่องข้อความ */}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm sm:text-base group-hover/link:underline group-hover/link:text-primary truncate transition-colors duration-150">
                                        {location.name}
                                    </span>
                                    {location.type && (
                                        <Badge
                                            variant="secondary"
                                            className={`${badgeStyle} text-[10px] font-medium py-0 px-2 rounded-full`}
                                        >
                                            {location.type}
                                        </Badge>
                                    )}
                                    {isDraft && (
                                        <Badge 
                                            variant="outline" 
                                            className="bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 text-[9px] py-0 px-1.5 rounded-full border-zinc-300/30 flex items-center gap-0.5"
                                        >
                                            🌫️ ยังไม่สำรวจ
                                        </Badge>
                                    )}
                                </div>
                                {location.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[400px] mt-0.5">
                                        {location.description}
                                    </p>
                                )}
                            </div>
                        </Link>

                        {/* แผงควบคุมเมนูด้านขวา (แสดงอัตโนมัติบนมือถือ / สไลด์โฮเวอร์บนเดสก์ท็อป) */}
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:translate-x-2 md:group-hover:translate-x-0 transition-all duration-200 flex-shrink-0 z-20">
                            {depth < 2 && (
                                <CreateLocationDialog
                                    novelId={novelId}
                                    defaultParentId={location.id}
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full"
                                            title="เพิ่มพื้นที่รอง"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    }
                                />
                            )}
                            
                            <Link href={`/dashboard/project/${novelId}/locations/${location.id}`}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                                    title="ดูรายละเอียด"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                </Button>
                            </Link>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 rounded-full"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEdit(location)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        แก้ไขข้อมูล
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        ลบสถานที่
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* การเรียกซ้อนตัวเองแบบยืดหยุ่น (Recursive Tree List Rendering) */}
            {filteredChildren.length > 0 && isExpanded && (
                <div className="pl-6 ml-2 space-y-2 mt-1 py-1 relative transition-all duration-300">
                    {filteredChildren.map((child, index) => (
                        <TreeNode
                            key={child.id}
                            location={child}
                            locations={locations}
                            novelId={novelId}
                            onEdit={onEdit}
                            depth={depth + 1}
                            allExpanded={allExpanded}
                            globalKey={globalKey}
                            searchQuery={searchQuery}
                            isLast={index === filteredChildren.length - 1}
                            hoveredNodeId={hoveredNodeId}
                            setHoveredNodeId={setHoveredNodeId}
                            hoveredAncestors={hoveredAncestors}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function LocationHierarchyView({ locations, novelId }: LocationHierarchyViewProps) {
    const [editLocation, setEditLocation] = useState<Location | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [allExpanded, setAllExpanded] = useState<boolean | null>(null);
    const [globalKey, setGlobalKey] = useState(0);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const handleExpandAll = () => {
        setAllExpanded(true);
        setGlobalKey(prev => prev + 1);
    };

    const handleCollapseAll = () => {
        setAllExpanded(false);
        setGlobalKey(prev => prev + 1);
    };

    // ฟังก์ชันค้นหาเส้นสายสายเลือดสืบทอด
    const getAncestors = (locId: string): string[] => {
        const ancestors: string[] = [];
        let current = locations.find(l => l.id === locId);
        while (current && current.parentLocationId) {
            ancestors.push(current.parentLocationId);
            current = locations.find(l => l.id === current.parentLocationId);
        }
        return ancestors;
    };

    const hoveredAncestors = hoveredNodeId ? getAncestors(hoveredNodeId) : [];

    const matchesSearch = (loc: any): boolean => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();

        const selfMatches = 
            loc.name.toLowerCase().includes(q) || 
            (loc.type && loc.type.toLowerCase().includes(q)) || 
            (loc.description && loc.description.toLowerCase().includes(q));

        if (selfMatches) return true;

        const children = locations.filter(l => l.parentLocationId === loc.id);
        return children.some(child => matchesSearch(child));
    };

    const rootLocations = locations
        .filter(loc => !loc.parentLocationId)
        .filter(loc => matchesSearch(loc));

    return (
        <>
            {/* อนิเมชันการไหลเวียนของชีพจรพลังงานบนเส้น SVG */}
            <style>{`
                @keyframes pulse {
                    0% {
                        stroke-dashoffset: 40;
                    }
                    100% {
                        stroke-dashoffset: 0;
                    }
                }
                .pulse-path {
                    stroke-dasharray: 8, 32;
                    animation: pulse 1.5s linear infinite;
                }
            `}</style>

            {/* โทนสี Gradient เรืองแสงสีชมพู/น้ำเงิน */}
            <svg className="absolute w-0 h-0" width="0" height="0">
                <defs>
                    <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
                        <stop offset="50%" stopColor="#ec4899" stopOpacity="1" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>

            <div className="space-y-4 max-w-4xl mx-auto px-1">
                {/* ส่วนหัวและเกจจำนวน */}
                <div className="flex flex-col gap-3 pb-4 border-b border-muted sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            🧭 ผังโครงสร้างและชีพจรพื้นที่ (Location Ley-lines)
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            จำลองความเชื่อมโยงระหว่างพื้นที่และระดับการสำรวจด้วยเส้นสายแร่อัญมณี (สูงสุด 3 ระดับ)
                        </p>
                    </div>
                    <Badge variant="secondary" className="px-2.5 py-0.5 self-start sm:self-auto bg-primary/5 text-primary border border-primary/10">
                        ทั้งหมด {locations.length} สถานที่
                    </Badge>
                </div>

                {/* แผงฟิลเตอร์และการพับ/กางด่วน */}
                {locations.length > 0 && (
                    <div className="flex flex-col gap-2 min-[500px]:flex-row min-[500px]:items-center min-[500px]:justify-between pt-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาสถานที่, คำอธิบาย..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm focus-visible:ring-primary"
                            />
                        </div>

                        <div className="flex items-center gap-2 self-end min-[500px]:self-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExpandAll}
                                className="h-9 text-xs gap-1.5 hover:bg-accent px-3 border-muted"
                                title="กางทุกระดับชั้น"
                            >
                                <FolderPlus className="h-3.5 w-3.5" />
                                กางทั้งหมด
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCollapseAll}
                                className="h-9 text-xs gap-1.5 hover:bg-accent px-3 border-muted"
                                title="ยุบทุกระดับชั้น"
                            >
                                <FolderMinus className="h-3.5 w-3.5" />
                                ยุบทั้งหมด
                            </Button>
                        </div>
                    </div>
                )}

                {/* โหนดโครงสร้างแผนที่ */}
                {rootLocations.length > 0 ? (
                    <div className="space-y-3 pt-2">
                        {rootLocations.map((location, index) => (
                            <TreeNode
                                key={location.id}
                                location={location}
                                locations={locations}
                                novelId={novelId}
                                onEdit={(loc) => setEditLocation(loc)}
                                allExpanded={allExpanded}
                                globalKey={globalKey}
                                searchQuery={searchQuery}
                                isLast={index === rootLocations.length - 1}
                                hoveredNodeId={hoveredNodeId}
                                setHoveredNodeId={setHoveredNodeId}
                                hoveredAncestors={hoveredAncestors}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 border border-dashed rounded-xl bg-card/40 flex flex-col items-center justify-center max-w-xl mx-auto mt-4 px-4">
                        <MapPin className="h-10 w-10 text-muted-foreground/25 mb-3" />
                        <h3 className="font-semibold text-base text-foreground/80">
                            {searchQuery ? "ไม่พบสถานที่ที่ตรงกับการค้นหา" : "ยังไม่มีข้อมูลสถานที่"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1.5 text-center max-w-xs leading-normal">
                            {searchQuery 
                                ? "ลองค้นหาด้วยคำอื่น หรือยกเลิกการค้นหาเพื่อดูข้อมูลทั้งหมด" 
                                : "เริ่มต้นจำลองแผนที่ของคุณโดยการสร้างสถานที่แม่ (Root Location) แรกได้เลย"}
                        </p>
                        {!searchQuery && (
                            <CreateLocationDialog
                                novelId={novelId}
                                trigger={
                                    <Button className="mt-5 shadow-sm gap-2 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground">
                                        <Plus className="h-4 w-4" />
                                        สร้างสถานที่แรกของคุณ
                                    </Button>
                                }
                            />
                        )}
                    </div>
                )}
            </div>

            {/* กล่องแก้ไขข้อมูล */}
            {editLocation && (
                <EditLocationDialog
                    location={editLocation}
                    open={!!editLocation}
                    onOpenChange={(open) => !open && setEditLocation(null)}
                />
            )}
        </>
    );
}
