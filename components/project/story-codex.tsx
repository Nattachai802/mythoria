"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ArrowUpRight, BookText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNovelGraph, WorldGraphData } from "@/server/graph";

// ชื่อไทยต่อชนิด + สี (เทียบ world-graph)
const TYPE_META: Record<string, { label: string; color: string }> = {
    character: { label: "ตัวละคร", color: "#5b9bd5" },
    location: { label: "สถานที่", color: "#3fa796" },
    lore: { label: "ตำนาน", color: "#9b6dd6" },
    power: { label: "พลัง", color: "#e0a13c" },
    faction: { label: "ก๊ก", color: "#d9534f" },
    item: { label: "ไอเทม", color: "#2e9e9e" },
    era: { label: "ยุค", color: "#7e6bd0" },
    entity: { label: "สิ่งมีชีวิต", color: "#e07b39" },
    note: { label: "บันทึก", color: "#6b7689" },
    chapter: { label: "บท", color: "#4a90c2" },
    timelineEvent: { label: "ฉาก", color: "#d56aa0" },
    idea: { label: "ไอเดีย", color: "#cbb53e" },
    plotThread: { label: "ปม", color: "#56b56b" },
};
const meta = (t: string) => TYPE_META[t] ?? { label: t, color: "#71717a" };

// ความหมายไทยของ relation (ทิศ from → to)
const REL_OUT: Record<string, string> = {
    member_of: "สังกัด", wields: "ครอบครองพลัง", related_to: "สัมพันธ์กับ",
    connects_to: "เชื่อมไป", features: "มีตัวละคร", inhabits: "อาศัยที่",
    linked_to: "เกี่ยวข้องกับ", derived_from: "ต่อยอดจาก", combines_into: "ผสมเป็น",
    mentions: "กล่าวถึง", set_in: "เกิดที่", grouped_in: "อยู่ในกลุ่ม",
    advances: "ขับเคลื่อน", located_in: "อยู่ใน",
};
const relLabel = (r: string) => REL_OUT[r] ?? r;

export function StoryCodex({ novelId }: { novelId: string }) {
    const [data, setData] = useState<WorldGraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            const res = await getNovelGraph(novelId);
            if (active && res.success && res.data) setData(res.data);
            if (active) setLoading(false);
        })();
        return () => { active = false; };
    }, [novelId]);

    const nodeMap = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);

    // จัดกลุ่ม entity ตามชนิด (กรองด้วย search)
    const grouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        const g = new Map<string, typeof data.nodes>();
        for (const n of data.nodes) {
            if (q && !n.label.toLowerCase().includes(q)) continue;
            (g.get(n.type) ?? g.set(n.type, []).get(n.type)!).push(n);
        }
        return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [data, query]);

    // ความเชื่อมโยงของ entity ที่เลือก (out = ออกจากตัวมัน, in = ถูกอ้างถึง)
    const connections = useMemo(() => {
        if (!selectedId) return { out: [], incoming: [] };
        const out = data.links.filter((l) => l.source === selectedId).map((l) => ({ rel: l.relation, node: nodeMap.get(l.target) }));
        const incoming = data.links.filter((l) => l.target === selectedId).map((l) => ({ rel: l.relation, node: nodeMap.get(l.source) }));
        return {
            out: out.filter((x) => x.node),
            incoming: incoming.filter((x) => x.node),
        };
    }, [selectedId, data, nodeMap]);

    const selected = selectedId ? nodeMap.get(selectedId) : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> กำลังรวบรวมคลังเรื่อง...
            </div>
        );
    }

    if (data.nodes.length === 0) {
        return (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
                <BookText className="w-8 h-8 mb-3 text-[var(--forge-gold,#e0a13c)]" />
                <p className="text-sm font-medium text-foreground mb-1">ยังไม่มีข้อมูลในคลังเรื่อง</p>
                <p className="text-xs max-w-[280px]">เพิ่มตัวละคร/สถานที่/พลัง แล้วเชื่อมโยงกัน — codex จะรวบรวมให้อัตโนมัติ</p>
            </div>
        );
    }

    return (
        <div className="flex gap-4 items-start">
            {/* รายการ entity จัดกลุ่มตามชนิด */}
            <div className="w-[300px] shrink-0 border rounded-xl bg-card/50 flex flex-col" style={{ height: 640 }}>
                <div className="relative p-3 border-b shrink-0">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ค้นในคลังเรื่อง..."
                        className="w-full bg-transparent border rounded-md pl-7 pr-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--forge-gold,#e0a13c)]"
                        aria-label="ค้นหา"
                    />
                </div>
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2">
                        {grouped.map(([type, nodes]) => (
                            <div key={type} className="mb-3">
                                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta(type).color }} />
                                    {meta(type).label} <span className="opacity-60">({nodes.length})</span>
                                </div>
                                {nodes.map((n) => (
                                    <button
                                        key={n.id}
                                        onClick={() => setSelectedId(n.id)}
                                        className={cn(
                                            "w-full text-left text-sm px-2.5 py-1.5 rounded-md truncate hover:bg-muted transition-colors",
                                            selectedId === n.id && "bg-muted font-medium",
                                        )}
                                    >
                                        {n.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                        {grouped.length === 0 && <p className="text-xs text-muted-foreground p-3">ไม่พบ</p>}
                    </div>
                </ScrollArea>
            </div>

            {/* รายละเอียด + ความเชื่อมโยง */}
            <div className="flex-1 min-w-0 border rounded-xl bg-card/50 p-5" style={{ minHeight: 640 }}>
                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                        <BookText className="w-6 h-6 mb-2 opacity-60" />
                        เลือกรายการทางซ้ายเพื่อดูความเชื่อมโยง
                    </div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                                <Badge variant="secondary" className="text-[10px] mb-1.5" style={{ color: meta(selected.type).color }}>
                                    {meta(selected.type).label}
                                </Badge>
                                <h2 className="text-xl font-display font-bold tracking-tight break-words">{selected.label}</h2>
                            </div>
                            {selected.href && (
                                <Link href={selected.href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0 mt-1">
                                    เปิดหน้าเต็ม <ArrowUpRight className="w-3 h-3" />
                                </Link>
                            )}
                        </div>

                        <ConnGroup title="เชื่อมโยงไป" items={connections.out} relLabel={relLabel} meta={meta} onPick={setSelectedId} />
                        <ConnGroup title="ถูกอ้างถึงโดย" items={connections.incoming} relLabel={relLabel} meta={meta} onPick={setSelectedId} />

                        {connections.out.length === 0 && connections.incoming.length === 0 && (
                            <p className="text-sm text-muted-foreground">ยังไม่มีความเชื่อมโยง — ลองเชื่อมในหน้าตัวละคร/ก๊ก/พลัง</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function ConnGroup({
    title, items, relLabel, meta, onPick,
}: {
    title: string;
    items: { rel: string; node: { id: string; label: string; type: string } | undefined }[];
    relLabel: (r: string) => string;
    meta: (t: string) => { label: string; color: string };
    onPick: (id: string) => void;
}) {
    if (items.length === 0) return null;
    return (
        <div className="mb-5">
            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{title}</span>
            <div className="mt-2 flex flex-col gap-1">
                {items.map((x, i) => (
                    <button
                        key={i}
                        onClick={() => x.node && onPick(x.node.id)}
                        className="flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                    >
                        <span className="text-[11px] text-muted-foreground w-24 shrink-0">{relLabel(x.rel)}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta(x.node!.type).color }} />
                        <span className="truncate">{x.node!.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
