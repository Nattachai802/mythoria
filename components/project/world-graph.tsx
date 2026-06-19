"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw, Maximize2, Users, Sparkles, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNovelGraph, WorldGraphData } from "@/server/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังโหลดกราฟ...
        </div>
    ),
});

// สี + ชื่อไทย ต่อชนิด entity
const TYPE_META: Record<string, { color: string; label: string }> = {
    character: { color: "#5b9bd5", label: "ตัวละคร" },
    location: { color: "#3fa796", label: "สถานที่" },
    lore: { color: "#9b6dd6", label: "ตำนาน" },
    power: { color: "#e0a13c", label: "พลัง" },
    faction: { color: "#d9534f", label: "ก๊ก" },
    item: { color: "#2e9e9e", label: "ไอเทม" },
    era: { color: "#7e6bd0", label: "ยุค" },
    entity: { color: "#e07b39", label: "สิ่งมีชีวิต" },
    note: { color: "#6b7689", label: "บันทึก" },
    chapter: { color: "#4a90c2", label: "บท" },
    timelineEvent: { color: "#d56aa0", label: "ฉาก" },
    idea: { color: "#cbb53e", label: "ไอเดีย" },
    plotThread: { color: "#56b56b", label: "ปม" },
};
const metaFor = (t: string) => TYPE_META[t] ?? { color: "#71717a", label: t };

type Filter = "all" | "user" | "ai";
const FILTERS: { key: Filter; label: string; icon: typeof Users | null }[] = [
    { key: "all", label: "ทั้งหมด", icon: null },
    { key: "user", label: "ผู้เขียน", icon: Users },
    { key: "ai", label: "AI", icon: Sparkles },
];

interface WorldGraphProps {
    novelId: string;
    height?: number;
}

export function WorldGraph({ novelId, height = 640 }: WorldGraphProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<WorldGraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [dims, setDims] = useState({ width: 800, height });
    const [filter, setFilter] = useState<Filter>("all");
    const [hover, setHover] = useState<string | null>(null);

    const isDark = theme === "dark";

    const fetchData = useCallback(async () => {
        setLoading(true);
        const opts = filter === "all" ? undefined : { createdBy: [filter] };
        const result = await getNovelGraph(novelId, opts);
        if (result.success && result.data) setData(result.data);
        setLoading(false);
    }, [novelId, filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // adjacency สำหรับ highlight เพื่อนบ้านตอน hover
    const adjacency = useMemo(() => {
        const m = new Map<string, Set<string>>();
        for (const l of data.links) {
            const s = typeof l.source === "object" ? (l.source as any).id : l.source;
            const t = typeof l.target === "object" ? (l.target as any).id : l.target;
            (m.get(s) ?? m.set(s, new Set()).get(s)!).add(t);
            (m.get(t) ?? m.set(t, new Set()).get(t)!).add(s);
        }
        return m;
    }, [data]);

    // type ที่ปรากฏ + จำนวน (สำหรับ legend)
    const typeCounts = useMemo(() => {
        const c = new Map<string, number>();
        for (const n of data.nodes) c.set(n.type, (c.get(n.type) ?? 0) + 1);
        return [...c.entries()].sort((a, b) => b[1] - a[1]);
    }, [data]);

    // resize
    useEffect(() => {
        const ro = new ResizeObserver((entries) => {
            for (const e of entries) {
                const { width, height: h } = e.contentRect;
                setDims({ width, height: h > 0 ? h : height });
            }
        });
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [height]);

    // แรงผลัก + ระยะเส้น ให้กระจายไม่กระจุก
    useEffect(() => {
        const fg = fgRef.current;
        if (!fg || data.nodes.length === 0) return;
        fg.d3Force("charge")?.strength(-210);
        fg.d3Force("link")?.distance(75);
        fg.d3ReheatSimulation?.();
    }, [data]);

    const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const size = Math.min(13, 3 + Math.sqrt(node.val || 1) * 1.9);
        const { color } = metaFor(node.type);

        const active = hover === null
            || hover === node.id
            || adjacency.get(hover)?.has(node.id);
        ctx.globalAlpha = active ? 1 : 0.12;

        // glow บางๆ ให้รู้สึก "มีชีวิต"
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        if (hover === node.id) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 16;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // วงแหวนทองตอน hover
        if (hover === node.id) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 2.5, 0, 2 * Math.PI, false);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#e0a13c";
            ctx.stroke();
        }

        // label เฉพาะตอนซูมเข้า / node สำคัญ / hover
        if (globalScale > 1.5 || (node.val || 1) >= 6 || hover === node.id) {
            const fontSize = Math.max(3.5, 11 / globalScale);
            const label = (node.label as string)?.slice(0, 22) ?? "";
            ctx.font = `${fontSize}px var(--font-sarabun), sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = isDark ? "#cdd3de" : "#1e293b";
            ctx.fillText(label, node.x, node.y + size + fontSize + 1);
        }
        ctx.globalAlpha = 1;
    }, [hover, adjacency, isDark]);

    const linkColor = useCallback((link: any) => {
        if (hover) {
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (s === hover || t === hover) return "#e0a13c";
            return isDark ? "rgba(120,130,150,0.06)" : "rgba(100,116,139,0.08)";
        }
        return isDark ? "rgba(120,130,150,0.22)" : "rgba(100,116,139,0.25)";
    }, [hover, isDark]);

    const empty = !loading && data.nodes.length === 0;

    return (
        <div
            className="relative overflow-hidden border border-border chamfered bg-card/40"
            style={{ height }}
        >
            {/* แถบควบคุมบน */}
            <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-card/90 to-transparent pointer-events-none">
                {/* filter segmented + นับ */}
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="flex items-center border border-border/70 chamfered-sm bg-card/80 backdrop-blur-sm overflow-hidden">
                        {FILTERS.map((f) => {
                            const Icon = f.icon;
                            const on = filter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setFilter(f.key)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                                        on
                                            ? "bg-[var(--forge-gold)]/15 text-[var(--forge-gold)]"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                                    )}
                                >
                                    {Icon && <Icon className="h-3 w-3" />}
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                    <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums font-[family-name:var(--font-technical)]">
                        <Network className="h-3 w-3 text-[var(--forge-gold)]" />
                        {data.nodes.length} โหนด · {data.links.length} เส้น
                    </span>
                </div>

                {/* actions */}
                <div className="flex items-center gap-1.5 pointer-events-auto">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm border border-border/70 chamfered-sm" onClick={fetchData}>
                                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>รีเฟรช</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm border border-border/70 chamfered-sm" onClick={() => fgRef.current?.zoomToFit(400, 60)}>
                                <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>จัดให้พอดีจอ</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* legend */}
            {typeCounts.length > 0 && (
                <div className="absolute bottom-4 left-4 z-20 bg-card/85 backdrop-blur-sm border border-border/70 chamfered-sm p-3 max-w-[260px]">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-[family-name:var(--font-technical)]">
                        ชนิดของโหนด
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {typeCounts.map(([type, count]) => {
                            const { color, label } = metaFor(type);
                            return (
                                <div key={type} className="flex items-center gap-2 text-xs">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-foreground/90 truncate">{label}</span>
                                    <span className="ml-auto text-muted-foreground tabular-nums">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* canvas / states */}
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing">
                {loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--forge-gold)]" />
                        <span className="text-sm">กำลังประกอบกราฟ...</span>
                    </div>
                )}

                {empty && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                        <div className="p-3 chamfered-sm bg-muted/40 border border-border/60">
                            <Network className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            {filter === "all" ? "ยังไม่มีเส้นเชื่อมในเรื่องนี้" : "ไม่มีเส้นเชื่อมจากตัวกรองนี้"}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                            พิมพ์ <span className="text-[var(--forge-gold)] font-medium">@</span> ในตอนเพื่อเชื่อมตัวละคร/สถานที่/ตำนาน
                            หรือรันวิเคราะห์ตัวละคร แล้วเส้นเชื่อมจะปรากฏที่นี่
                        </p>
                    </div>
                )}

                {!loading && data.nodes.length > 0 && (
                    <ForceGraph2D
                        ref={fgRef}
                        width={dims.width}
                        height={dims.height}
                        graphData={data}
                        nodeLabel={(n: any) => `${metaFor(n.type).label} · ${n.label}`}
                        nodeCanvasObject={drawNode}
                        nodeCanvasObjectMode={() => "replace"}
                        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                            const size = Math.min(13, 3 + Math.sqrt(node.val || 1) * 1.9);
                            ctx.fillStyle = color;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
                            ctx.fill();
                        }}
                        onNodeHover={(n: any) => setHover(n?.id ?? null)}
                        onNodeClick={(n: any) => { if (n.href) router.push(n.href); }}
                        linkColor={linkColor}
                        linkWidth={(l: any) => {
                            if (!hover) return 1;
                            const s = typeof l.source === "object" ? l.source.id : l.source;
                            const t = typeof l.target === "object" ? l.target.id : l.target;
                            return s === hover || t === hover ? 1.8 : 0.6;
                        }}
                        linkDirectionalArrowLength={3}
                        linkDirectionalArrowRelPos={1}
                        linkCurvature={0.12}
                        cooldownTicks={120}
                        warmupTicks={20}
                    />
                )}
            </div>
        </div>
    );
}
