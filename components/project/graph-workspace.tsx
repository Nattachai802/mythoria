"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { WorldGraph } from "./world-graph";
import { LibrarianPanel } from "./librarian-panel";
import { Button } from "@/components/ui/button";
import { BookMarked, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibrarianSource } from "@/server/librarian";

interface GraphWorkspaceProps {
    novelId: string;
    height?: number;
}

const keysOf = (sources: LibrarianSource[], via: LibrarianSource["via"]) =>
    sources.filter((s) => s.via === via).map((s) => `${s.type}:${s.id}`);

export function GraphWorkspace({ novelId, height = 680 }: GraphWorkspaceProps) {
    const [panelOpen, setPanelOpen] = useState(true);
    // node key (`type:id`) ที่บรรณารักษ์ใช้ตอบ → ส่งให้ WorldGraph ไฮไลต์ traversal
    const [highlight, setHighlight] = useState<{ search: string[]; graph: string[] }>({
        search: [],
        graph: [],
    });
    const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSources = useCallback((sources: LibrarianSource[]) => {
        if (stageTimer.current) clearTimeout(stageTimer.current);
        const search = keysOf(sources, "search");
        const graph = keysOf(sources, "graph");
        // เล่าเป็นลำดับ: search hit (จุดที่ตอบมาจาก) สว่างก่อน → เพื่อนบ้านค่อยกระจายตาม
        setHighlight({ search, graph: [] });
        if (graph.length) {
            stageTimer.current = setTimeout(() => setHighlight({ search, graph }), 300);
        }
    }, []);

    useEffect(() => () => {
        if (stageTimer.current) clearTimeout(stageTimer.current);
    }, []);

    return (
        <div className="relative flex gap-3 items-stretch">
            {/* Graph (เต็มความกว้างบนจอแคบ — panel ลอยทับ) */}
            <div className="flex-1 min-w-0">
                <WorldGraph novelId={novelId} height={height} highlight={highlight} />
            </div>

            {/* backdrop เฉพาะจอแคบตอนเปิด panel */}
            {panelOpen && (
                <div
                    className="absolute inset-0 z-20 bg-black/30 lg:hidden"
                    onClick={() => setPanelOpen(false)}
                    aria-hidden
                />
            )}

            {/* Librarian panel — จอแคบ: overlay ลอยขวา · lg+: docked ในแถว */}
            <div
                className={cn(
                    "overflow-hidden border rounded-xl bg-card transition-all duration-300",
                    "absolute inset-y-0 right-0 z-30 shadow-2xl",
                    "lg:relative lg:inset-auto lg:z-auto lg:shadow-none lg:shrink-0",
                    panelOpen ? "w-[min(340px,85vw)]" : "w-0 border-0 shadow-none",
                )}
                style={{ height }}
            >
                {panelOpen && <LibrarianPanel novelId={novelId} onSources={handleSources} />}
            </div>

            {/* Toggle — handle แนวตั้งกลางตะเข็บ */}
            <Button
                variant="outline"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2 z-40 h-14 w-6 rounded-md shadow-sm"
                style={{ right: panelOpen ? "min(330px, 85vw)" : 4 }}
                onClick={() => setPanelOpen((v) => !v)}
                title={panelOpen ? "ซ่อนบรรณารักษ์" : "เปิดบรรณารักษ์"}
            >
                {panelOpen ? (
                    <PanelRightClose className="w-4 h-4" />
                ) : (
                    <BookMarked className="w-4 h-4 text-[var(--forge-gold,#e0a13c)]" />
                )}
            </Button>
        </div>
    );
}
