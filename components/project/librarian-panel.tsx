"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    BookMarked,
    Send,
    Loader2,
    Trash2,
    Search,
    Network,
    Sparkles,
    Database,
    RefreshCw,
    AlertTriangle,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { rebuildNovelReferences } from "@/server/references";
import {
    askLibrarian,
    retrieveLibrarianSources,
    getLibrarianThread,
    clearLibrarianThread,
    type LibrarianSource,
} from "@/server/librarian";
import type { LibrarianMessage } from "@/db/schema";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    sources?: LibrarianSource[];
}

interface LibrarianPanelProps {
    novelId: string;
    /** เรียกเมื่อได้คำตอบ — ส่ง source ให้หน้า graph ไฮไลต์ traversal */
    onSources?: (sources: LibrarianSource[]) => void;
    className?: string;
}

export function LibrarianPanel({ novelId, onSources, className }: LibrarianPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isAsking, setIsAsking] = useState(false);
    const [loadingThread, setLoadingThread] = useState(true);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    // โหลดประวัติเธรด
    useEffect(() => {
        let active = true;
        (async () => {
            const res = await getLibrarianThread(novelId);
            if (active && res.success) {
                setMessages(
                    res.data.map((m: LibrarianMessage) => ({
                        role: m.role as "user" | "assistant",
                        content: m.content,
                        sources: (m.sources as LibrarianSource[] | null) ?? undefined,
                    })),
                );
            }
            if (active) setLoadingThread(false);
        })();
        return () => {
            active = false;
        };
    }, [novelId]);

    // auto-scroll ลงล่างสุดเมื่อมีข้อความใหม่
    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isAsking]);

    const handleAsk = useCallback(async () => {
        const q = input.trim();
        if (!q || isAsking) return;

        setMessages((prev) => [...prev, { role: "user", content: q }]);
        setInput("");
        setIsAsking(true);

        // early highlight: ไฮไลต์กราฟทันทีที่ retrieval เสร็จ ไม่ต้องรอ LLM ตอบ (ขนานกัน)
        retrieveLibrarianSources(novelId, q).then((r) => {
            if (r.sources.length) onSources?.(r.sources);
        });

        const res = await askLibrarian(novelId, q);

        if (res.success && res.answer) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: res.answer!, sources: res.sources },
            ]);
            if (res.sources) onSources?.(res.sources);
        } else {
            toast.error(res.error || "เกิดข้อผิดพลาด");
            // คืนคำถามให้ผู้ใช้ retry (เอา bubble user ที่เพิ่ง push ออก)
            setMessages((prev) => prev.slice(0, -1));
            setInput(q);
        }
        setIsAsking(false);
    }, [input, isAsking, novelId, onSources]);

    const handleClear = useCallback(async () => {
        if (messages.length === 0) return;
        if (!confirm("ล้างประวัติการสนทนากับบรรณารักษ์ทั้งหมด?")) return;
        const res = await clearLibrarianThread(novelId);
        if (res.success) {
            setMessages([]);
            onSources?.([]);
            toast.success("ล้างประวัติเรียบร้อย");
        } else {
            toast.error(res.error || "ล้างไม่สำเร็จ");
        }
    }, [messages.length, novelId, onSources]);

    return (
        <div className={cn("flex flex-col h-full bg-card", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-[var(--forge-gold,#e0a13c)]" />
                    <span className="font-semibold text-sm">บรรณารักษ์</span>
                </div>
                {messages.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={handleClear}
                        title="ล้างประวัติ"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>

            {/* Sync status + ปุ่มซิงค์ในตัว */}
            <SyncBar novelId={novelId} />

            {/* Chat log */}
            <ScrollArea className="flex-1 min-h-0 px-4">
                <div className="py-4 space-y-4">
                    {loadingThread ? (
                        <div className="flex justify-center py-8 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                    ) : messages.length === 0 ? (
                        <EmptyHint />
                    ) : (
                        messages.map((m, i) =>
                            m.role === "user" ? (
                                <div key={i} className="flex justify-end">
                                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
                                        {m.content}
                                    </div>
                                </div>
                            ) : (
                                <AssistantMessage key={i} content={m.content} sources={m.sources} />
                            ),
                        )
                    )}
                    {isAsking && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            กำลังค้นคลังข้อมูล...
                        </div>
                    )}
                    <div ref={scrollEndRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 shrink-0">
                <div className="relative">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAsk();
                            }
                        }}
                        placeholder="ถามเกี่ยวกับนิยายของคุณ..."
                        className="min-h-[44px] max-h-[120px] resize-none pr-11 text-sm"
                        rows={1}
                    />
                    <Button
                        size="icon"
                        className="absolute right-1.5 bottom-1.5 h-8 w-8"
                        disabled={!input.trim() || isAsking}
                        onClick={handleAsk}
                    >
                        {isAsking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                    ตอบจากเนื้อหาที่ Vector Sync แล้วเท่านั้น · กด Enter เพื่อส่ง
                </p>
            </div>
        </div>
    );
}

const PYTHON_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || "http://localhost:8000";

/** แถบสถานะคลังข้อมูล + ปุ่มซิงค์ในตัว panel
 *  - จำนวนรายการในคลัง: จาก /status (จริง, cross-device)
 *  - เวลาซิงค์ล่าสุด: localStorage (best-effort ต่ออุปกรณ์)
 */
function SyncBar({ novelId }: { novelId: string }) {
    const lsKey = `librarian-sync-${novelId}`;
    const [count, setCount] = useState<number | null>(null);
    const [state, setState] = useState<"loading" | "ok" | "down">("loading");
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${PYTHON_URL}/status/${novelId}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            // /status คืน { novel_id, total, character, note, ... } → ใช้ total ตรงๆ (กันนับเบิ้ล)
            setCount(typeof data.total === "number" ? data.total : 0);
            setState("ok");
        } catch {
            setState("down");
        }
    }, [novelId]);

    useEffect(() => {
        setLastSync(localStorage.getItem(lsKey));
        fetchStatus();
    }, [fetchStatus, lsKey]);

    const handleSync = useCallback(async () => {
        setSyncing(true);
        try {
            const res = await fetch(`${PYTHON_URL}/sync/${novelId}`, { method: "POST" });
            const result = await res.json();
            if (result.success) {
                await rebuildNovelReferences(novelId); // graph index สดพร้อม vector
                const now = new Date().toISOString();
                localStorage.setItem(lsKey, now);
                setLastSync(now);
                toast.success("ซิงค์ข้อมูลสำเร็จ");
                await fetchStatus();
            } else {
                toast.error("ซิงค์ล้มเหลว", { description: result.errors?.[0] || "เกิดข้อผิดพลาด" });
            }
        } catch {
            toast.error("ซิงค์ล้มเหลว", { description: "Python service ไม่ได้รัน (port 8000)" });
            setState("down");
        } finally {
            setSyncing(false);
        }
    }, [novelId, lsKey, fetchStatus]);

    return (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/20 text-[11px] text-muted-foreground">
            {state === "down" ? (
                <>
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-amber-600 dark:text-amber-400">เชื่อม AI service ไม่ได้</span>
                </>
            ) : (
                <>
                    <Database className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                        {state === "loading"
                            ? "ตรวจสอบคลัง..."
                            : `คลัง ${count ?? 0} รายการ`}
                        {lastSync && state === "ok" && (
                            <> · ซิงค์{formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: th })}</>
                        )}
                    </span>
                </>
            )}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="ml-auto h-6 px-2 text-[11px] gap-1 shrink-0 hover:text-foreground"
            >
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                {syncing ? "ซิงค์..." : "ซิงค์"}
            </Button>
        </div>
    );
}

// บริบทดิบมาเป็น HTML — ลอก tag + ยุบช่องว่างให้เหลือข้อความล้วน ไม่ตกขอบ
const stripHtml = (s: string) =>
    s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function AssistantMessage({
    content,
    sources,
}: {
    content: string;
    sources?: LibrarianSource[];
}) {
    const [showContext, setShowContext] = useState(false);
    const hasSources = !!sources && sources.length > 0;

    return (
        <div className="flex flex-col gap-2">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed">
                {content}
            </div>
            {hasSources && (
                <>
                    <SourceChips sources={sources!} />
                    <button
                        onClick={() => setShowContext((v) => !v)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-fit"
                    >
                        <ChevronRight
                            className={cn("w-3 h-3 transition-transform", showContext && "rotate-90")}
                        />
                        ทำไมตอบแบบนี้ — ดูบริบทที่ใช้ ({sources!.length})
                    </button>
                    {showContext && (
                        <div className="space-y-1.5 max-w-[90%] min-w-0 pl-1">
                            {sources!.map((s, i) => (
                                <div
                                    key={i}
                                    className="rounded-md border bg-muted/30 p-2 text-[11px] space-y-1 overflow-hidden"
                                >
                                    <div className="flex items-center gap-1.5 font-medium">
                                        {s.via === "search" ? (
                                            <Search className="w-3 h-3 text-amber-500 shrink-0" />
                                        ) : (
                                            <Network className="w-3 h-3 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="truncate min-w-0">{s.title}</span>
                                        <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                                            {s.type}
                                        </Badge>
                                    </div>
                                    {s.via === "search" && s.content ? (
                                        <p className="text-muted-foreground line-clamp-3 leading-relaxed break-words">
                                            {stripHtml(s.content)}
                                        </p>
                                    ) : (
                                        <p className="text-muted-foreground italic break-words">
                                            เชื่อมโยงผ่าน: {s.relation ?? "—"}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function SourceChips({ sources }: { sources: LibrarianSource[] }) {
    const search = sources.filter((s) => s.via === "search");
    const graph = sources.filter((s) => s.via !== "search");
    return (
        <div className="flex flex-col gap-2 max-w-[90%]">
            <SourceGroup
                icon={Search}
                label="ค้นพบ"
                hint="จุดที่คำตอบมาจาก"
                sources={search}
                tone="search"
            />
            <SourceGroup
                icon={Network}
                label="เชื่อมโยง"
                hint="เอนทิตีที่เกี่ยวข้อง"
                sources={graph}
                tone="graph"
            />
        </div>
    );
}

const CHIP_CAP = 5;

function SourceGroup({
    icon: Icon,
    label,
    hint,
    sources,
    tone,
}: {
    icon: typeof Search;
    label: string;
    hint: string;
    sources: LibrarianSource[];
    tone: "search" | "graph";
}) {
    const [expanded, setExpanded] = useState(false);
    if (sources.length === 0) return null;
    const shown = expanded ? sources : sources.slice(0, CHIP_CAP);
    const rest = sources.length - shown.length;

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                <Icon className={cn("w-3 h-3", tone === "search" && "text-amber-500")} />
                <span>{label}</span>
                <span className="tabular-nums">{sources.length}</span>
                <span className="text-muted-foreground/50 normal-case tracking-normal">· {hint}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {shown.map((s, i) => {
                    const inner = (
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[11px] gap-1 font-normal cursor-default",
                                tone === "search"
                                    ? "border-amber-300/50 text-amber-700/90 dark:text-amber-300/90"
                                    : "border-border text-muted-foreground",
                                s.href && "cursor-pointer hover:bg-muted",
                            )}
                            title={`${s.title} · ${s.type}`}
                        >
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate max-w-[120px]">{s.title}</span>
                        </Badge>
                    );
                    return s.href ? (
                        <Link key={i} href={s.href}>
                            {inner}
                        </Link>
                    ) : (
                        <span key={i}>{inner}</span>
                    );
                })}
                {rest > 0 && (
                    <button
                        onClick={() => setExpanded(true)}
                        className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 self-center"
                    >
                        +{rest} เพิ่มเติม
                    </button>
                )}
            </div>
        </div>
    );
}

function EmptyHint() {
    return (
        <div className="flex flex-col items-center text-center py-10 px-4 text-muted-foreground">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
                <Sparkles className="w-6 h-6 text-[var(--forge-gold,#e0a13c)]" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">ถามบรรณารักษ์ได้เลย</p>
            <p className="text-xs leading-relaxed max-w-[240px]">
                เช่น &quot;อารินมีความสัมพันธ์กับใครบ้าง&quot; หรือ
                &quot;เหตุการณ์ที่ถ้ำมืดเกิดอะไรขึ้น&quot;
            </p>
        </div>
    );
}
