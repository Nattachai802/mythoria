"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { getCharacterNetwork, GraphData, GraphNode, GraphLink } from "@/server/graph";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading Graph...</div>
});

interface CharacterNetworkGraphProps {
    novelId: string;
    height?: number;
}

const RELATIONSHIP_COLORS: Record<string, string> = {
    family: "#3b82f6", // Blue
    friend: "#22c55e", // Green
    enemy: "#ef4444", // Red
    romantic: "#ec4899", // Pink
    business: "#a855f7", // Purple
    mentor: "#f59e0b", // Amber
    rival: "#f97316", // Orange
    other: "#71717a", // Gray
};

export function CharacterNetworkGraph({ novelId, height = 600 }: CharacterNetworkGraphProps) {
    const { theme } = useTheme();
    const fgRef = useRef<any>(null);
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [containerDimensions, setContainerDimensions] = useState({ width: 800, height });

    const containerRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const result = await getCharacterNetwork(novelId);
        if (result.success && result.data) {
            setData(result.data);
        }
        setLoading(false);
    }, [novelId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle Resize
    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height: h } = entry.contentRect;
                setContainerDimensions({ width, height: h > 0 ? h : height });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [height]);

    // Node Rendering
    const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const size = 6 + (node.val || 1) * 2;
        const fontSize = 12 / globalScale;

        // Draw Circle Background
        ctx.beginPath();
        const color = node.role === 'protagonist' ? '#3b82f6' :
            node.role === 'antagonist' ? '#ef4444' :
                node.role === 'supporting' ? '#10b981' : '#6b7280';

        ctx.fillStyle = theme === 'dark' ? '#1e293b' : '#ffffff';
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();

        // Draw Image (if exists) or Text
        if (node.img) {
            const img = new Image();
            img.src = node.img;
            // Note: In real implementation, need to preload/cache images for performance
            // For now, simple circle clipping
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, size - 2, 0, 2 * Math.PI, false);
            ctx.clip();
            try {
                ctx.drawImage(img, node.x - size + 2, node.y - size + 2, (size - 2) * 2, (size - 2) * 2);
            } catch (e) { } // Handle load errors
            ctx.restore();
        }

        // Draw Label text
        const label = node.name;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = theme === 'dark' ? '#e2e8f0' : '#1e293b';
        ctx.fillText(label, node.x, node.y + size + fontSize + 2);

    }, [theme]);

    return (
        <Card className="relative overflow-hidden border bg-background" style={{ height }}>
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <Button variant="secondary" size="icon" onClick={() => fetchData()} title="Refresh">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => fgRef.current?.zoomToFit(400)} title="Fit View">
                    <Maximize className="h-4 w-4" />
                </Button>
            </div>

            {/* Legend (Optional, simplified) */}
            <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur p-2 rounded border text-xs space-y-1">
                <div className="font-bold mb-1">Relationships</div>
                {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-2">
                        <span className="w-3 h-0.5" style={{ backgroundColor: color }}></span>
                        <span className="capitalize">{type}</span>
                    </div>
                ))}
            </div>

            {/* Graph Container */}
            <div ref={containerRef} className="w-full h-full cursor-move">
                {!loading && (
                    <ForceGraph2D
                        ref={fgRef}
                        width={containerDimensions.width}
                        height={containerDimensions.height}
                        graphData={data}
                        nodeLabel="name"
                        nodeCanvasObject={drawNode}
                        nodeCanvasObjectMode={() => 'replace'} // We draw everything
                        linkWidth={2}
                        linkColor={(link: any) => RELATIONSHIP_COLORS[link.type] || RELATIONSHIP_COLORS.other}
                        linkDirectionalArrowLength={3.5}
                        linkDirectionalArrowRelPos={1}
                        linkCurvature={0.25}
                        cooldownTicks={100}
                        onNodeDragEnd={node => {
                            node.fx = node.x;
                            node.fy = node.y;
                        }}
                    />
                )}
            </div>
        </Card>
    );
}
