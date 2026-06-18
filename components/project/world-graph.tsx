"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Maximize } from "lucide-react";
import { getNovelGraph, WorldGraphData } from "@/server/graph";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading Graph...
        </div>
    ),
});

// สีตามชนิด entity
const TYPE_COLORS: Record<string, string> = {
    character: "#3b82f6",
    location: "#10b981",
    lore: "#a855f7",
    power: "#f59e0b",
    faction: "#ef4444",
    item: "#14b8a6",
    era: "#8b5cf6",
    entity: "#f97316",
    note: "#64748b",
    chapter: "#0ea5e9",
    timelineEvent: "#ec4899",
    idea: "#eab308",
    plotThread: "#22c55e",
};
const colorFor = (type: string) => TYPE_COLORS[type] ?? "#71717a";

interface WorldGraphProps {
    novelId: string;
    height?: number;
}

export function WorldGraph({ novelId, height = 600 }: WorldGraphProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<WorldGraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [dims, setDims] = useState({ width: 800, height });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const result = await getNovelGraph(novelId);
        if (result.success && result.data) setData(result.data);
        setLoading(false);
    }, [novelId]);

    useEffect(() => { fetchData(); }, [fetchData]);

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

    const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const size = 5 + (node.val || 1) * 1.5;
        const fontSize = 11 / globalScale;
        const color = colorFor(node.type);

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fill();

        const label = node.label as string;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = theme === "dark" ? "#e2e8f0" : "#1e293b";
        ctx.fillText(label, node.x, node.y + size + fontSize + 1);
    }, [theme]);

    // type ที่ปรากฏจริง สำหรับ legend
    const presentTypes = Array.from(new Set(data.nodes.map((n) => n.type)));

    return (
        <Card className="relative overflow-hidden border bg-background" style={{ height }}>
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <Button variant="secondary" size="icon" onClick={fetchData} title="Refresh">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => fgRef.current?.zoomToFit(400)} title="Fit View">
                    <Maximize className="h-4 w-4" />
                </Button>
            </div>

            {presentTypes.length > 0 && (
                <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur p-2 rounded border text-xs grid grid-cols-2 gap-x-3 gap-y-1 max-w-[280px]">
                    {presentTypes.map((type) => (
                        <div key={type} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(type) }} />
                            <span>{type}</span>
                        </div>
                    ))}
                </div>
            )}

            <div ref={containerRef} className="w-full h-full cursor-move">
                {!loading && data.nodes.length === 0 && (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        ยังไม่มีเส้นเชื่อม — ลองเพิ่ม @-mention หรือรัน sync ตัวละคร
                    </div>
                )}
                {!loading && data.nodes.length > 0 && (
                    <ForceGraph2D
                        ref={fgRef}
                        width={dims.width}
                        height={dims.height}
                        graphData={data}
                        nodeLabel={(n: any) => `${n.type}: ${n.label}`}
                        nodeCanvasObject={drawNode}
                        nodeCanvasObjectMode={() => "replace"}
                        onNodeClick={(n: any) => { if (n.href) router.push(n.href); }}
                        linkColor={() => (theme === "dark" ? "#475569" : "#cbd5e1")}
                        linkWidth={1}
                        linkLabel={(l: any) => l.relation}
                        linkDirectionalArrowLength={3}
                        linkDirectionalArrowRelPos={1}
                        linkCurvature={0.15}
                        cooldownTicks={100}
                        onNodeDragEnd={(node: any) => { node.fx = node.x; node.fy = node.y; }}
                    />
                )}
            </div>
        </Card>
    );
}
