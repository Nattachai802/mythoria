"use client";

import { useState, useCallback } from "react";
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

export function GraphWorkspace({ novelId, height = 680 }: GraphWorkspaceProps) {
    const [panelOpen, setPanelOpen] = useState(true);
    // เก็บ node key (`type:id`) ที่บรรณารักษ์ใช้ตอบ — จะส่งให้ WorldGraph ไฮไลต์ (step ถัดไป)
    const [, setHighlight] = useState<{ search: string[]; graph: string[] }>({
        search: [],
        graph: [],
    });

    const handleSources = useCallback((sources: LibrarianSource[]) => {
        setHighlight({
            search: sources.filter((s) => s.via === "search").map((s) => `${s.type}:${s.id}`),
            graph: sources.filter((s) => s.via === "graph").map((s) => `${s.type}:${s.id}`),
        });
    }, []);

    return (
        <div className="relative flex gap-3 items-stretch">
            {/* Graph */}
            <div className="flex-1 min-w-0">
                <WorldGraph novelId={novelId} height={height} />
            </div>

            {/* Librarian panel (docked, collapsible) */}
            <div
                className={cn(
                    "shrink-0 border rounded-xl overflow-hidden transition-all duration-300",
                    panelOpen ? "w-[340px]" : "w-0 border-0",
                )}
                style={{ height }}
            >
                {panelOpen && <LibrarianPanel novelId={novelId} onSources={handleSources} />}
            </div>

            {/* Toggle — handle แนวตั้งกลางตะเข็บ (เลี่ยงทับ header panel + controls กราฟ) */}
            <Button
                variant="outline"
                size="icon"
                className="absolute top-1/2 -translate-y-1/2 z-20 h-14 w-6 rounded-md shadow-sm"
                style={{ right: panelOpen ? 330 : 4 }}
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
