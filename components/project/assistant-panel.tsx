"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wand2, Send, Loader2, Trash2, Check, X, ArrowRight, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    runAssistant,
    applyProposal,
    type ChatTurn,
    type AssistantResult,
} from "@/server/assistant";

type ProposalItem = Extract<AssistantResult, { kind: "proposal" }> & {
    role: "proposal";
    status: "pending" | "applied" | "cancelled";
    resultHref?: string | null;
    resultMessage?: string;
};

type ChatItem =
    | { role: "user"; content: string }
    | { role: "assistant"; content: string }
    | ProposalItem;

const QUICK_PROMPTS = [
    "สร้างตัวละครชื่อ อาเรน เป็นตัวเอก",
    "เพิ่มสถานที่ชื่อ ป่าหมอก บรรยากาศหม่นมัว",
    "สร้างไอเดียหัวข้อ จุดพลิกผันองก์ 2",
];

interface AssistantPanelProps {
    novelId: string;
    className?: string;
}

export function AssistantPanel({ novelId, className }: AssistantPanelProps) {
    // ponytail: ephemeral thread (client state). เพิ่มตาราง DB เมื่อต้องการ history ข้าม session
    const [items, setItems] = useState<ChatItem[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [items, busy]);

    const send = useCallback(
        async (text: string) => {
            const msg = text.trim();
            if (!msg || busy) return;

            // history = เฉพาะ turn ที่เป็นข้อความ (ข้าม proposal card)
            const history: ChatTurn[] = items
                .filter((it): it is { role: "user" | "assistant"; content: string } =>
                    it.role === "user" || it.role === "assistant",
                )
                .map((it) => ({ role: it.role, content: it.content }));

            setItems((prev) => [...prev, { role: "user", content: msg }]);
            setInput("");
            setBusy(true);

            const res = await runAssistant(novelId, msg, history);

            if (res.kind === "proposal") {
                setItems((prev) => [...prev, { ...res, role: "proposal", status: "pending" }]);
            } else if (res.kind === "message") {
                setItems((prev) => [...prev, { role: "assistant", content: res.text }]);
            } else {
                toast.error(res.error);
                setItems((prev) => prev.slice(0, -1)); // คืน input ให้ retry
                setInput(msg);
            }
            setBusy(false);
        },
        [busy, novelId, items],
    );

    const handleConfirm = useCallback(
        async (idx: number) => {
            const item = items[idx];
            if (item.role !== "proposal" || item.status !== "pending") return;
            setBusy(true);
            const res = await applyProposal(novelId, {
                tool: item.tool,
                entityType: item.entityType,
                id: item.id,
                fields: item.fields,
                noun: item.noun,
                title: item.title,
                details: item.details,
                summary: item.summary,
            });
            setItems((prev) =>
                prev.map((it, i) =>
                    i === idx && it.role === "proposal"
                        ? res.success
                            ? { ...it, status: "applied", resultHref: res.href, resultMessage: res.message }
                            : it
                        : it,
                ),
            );
            if (!res.success) toast.error(res.error);
            else toast.success(res.message);
            setBusy(false);
        },
        [items, novelId],
    );

    const handleCancel = useCallback((idx: number) => {
        setItems((prev) =>
            prev.map((it, i) =>
                i === idx && it.role === "proposal" ? { ...it, status: "cancelled" } : it,
            ),
        );
    }, []);

    return (
        <div className={cn("flex flex-col h-full bg-card", className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2">
                    <span className="grid place-items-center w-6 h-6 rounded-md bg-[var(--forge-gold,#e0a13c)]/15">
                        <Wand2 className="w-3.5 h-3.5 text-[var(--forge-gold,#e0a13c)]" />
                    </span>
                    <div className="leading-tight">
                        <div className="font-semibold text-sm">ผู้ช่วยจัดการข้อมูล</div>
                        <div className="text-[10px] text-muted-foreground">ทำตามคำสั่ง · ยืนยันก่อนบันทึกเสมอ</div>
                    </div>
                </div>
                {items.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setItems([])}
                        title="ล้างการสนทนา"
                        aria-label="ล้างการสนทนา"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                )}
            </div>

            {/* Chat log */}
            <ScrollArea className="flex-1 px-4">
                <div className="py-4 space-y-3">
                    {items.length === 0 ? (
                        <EmptyHint onPick={send} disabled={busy} />
                    ) : (
                        items.map((it, i) => {
                            if (it.role === "user") {
                                return (
                                    <div key={i} className="flex justify-end">
                                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3 py-2 text-sm">
                                            {it.content}
                                        </div>
                                    </div>
                                );
                            }
                            if (it.role === "assistant") {
                                return (
                                    <div
                                        key={i}
                                        className="max-w-[90%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed"
                                    >
                                        {it.content}
                                    </div>
                                );
                            }
                            return (
                                <ProposalCard
                                    key={i}
                                    item={it}
                                    busy={busy}
                                    onConfirm={() => handleConfirm(i)}
                                    onCancel={() => handleCancel(i)}
                                />
                            );
                        })
                    )}
                    {busy && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            กำลังประมวลผล...
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
                                send(input);
                            }
                        }}
                        placeholder='สั่งได้เลย เช่น "สร้างตัวละครชื่อ อาเรน เป็นตัวเอก"'
                        className="min-h-[44px] max-h-[120px] resize-none pr-11 text-sm"
                        rows={1}
                        aria-label="คำสั่งถึงผู้ช่วย"
                    />
                    <Button
                        size="icon"
                        className="absolute right-1.5 bottom-1.5 h-8 w-8"
                        disabled={!input.trim() || busy}
                        onClick={() => send(input)}
                        aria-label="ส่งคำสั่ง"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                    สร้าง / แก้ไข / ลบ ข้อมูลในนิยาย · กด Enter เพื่อส่ง
                </p>
            </div>
        </div>
    );
}

/* การ์ดยืนยัน — สีและไอคอนสื่อ verb, ลบใช้สีอันตราย, โชว์ฟิลด์ที่จะเขียนจริงให้ตรวจก่อนกด */
const VERB_META = {
    create_entity: { text: "สร้าง", Icon: Plus, tone: "text-emerald-600 dark:text-emerald-400", ring: "border-emerald-500/30" },
    update_entity: { text: "แก้ไข", Icon: Pencil, tone: "text-blue-600 dark:text-blue-400", ring: "border-blue-500/30" },
    delete_entity: { text: "ลบ", Icon: Trash2, tone: "text-destructive", ring: "border-destructive/40" },
} as const;

function ProposalCard({
    item,
    busy,
    onConfirm,
    onCancel,
}: {
    item: ProposalItem;
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const meta = VERB_META[item.tool];
    const isDelete = item.tool === "delete_entity";

    return (
        <div
            className={cn(
                "max-w-[92%] rounded-xl border bg-card shadow-sm overflow-hidden",
                "animate-in fade-in slide-in-from-bottom-1 duration-200",
                item.status === "pending" ? meta.ring : "border-border",
                item.status === "cancelled" && "opacity-60",
            )}
        >
            {/* header */}
            <div className="flex items-center gap-2 px-3 pt-2.5">
                <meta.Icon className={cn("w-4 h-4 shrink-0", meta.tone)} />
                <span className={cn("text-xs font-semibold", meta.tone)}>{meta.text}</span>
                <Badge variant="secondary" className="text-[10px] font-normal h-5 px-1.5">
                    {item.noun}
                </Badge>
            </div>

            {/* title + details */}
            <div className="px-3 pb-2.5 pt-1.5 space-y-1.5">
                <div className="text-sm font-medium break-words">{item.title}</div>
                {item.details.length > 0 && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {item.details.map((d, i) => (
                            <div key={i} className="contents">
                                <dt className="text-muted-foreground">{d.label}</dt>
                                <dd className="break-words">{d.value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
                {isDelete && item.status === "pending" && (
                    <p className="text-[11px] text-destructive">ลบแล้วย้อนกลับไม่ได้</p>
                )}
            </div>

            {/* actions / result */}
            {item.status === "pending" && (
                <div className="flex gap-2 px-3 pb-3 pt-0.5">
                    <Button
                        size="sm"
                        variant={isDelete ? "destructive" : "default"}
                        className="h-7 gap-1 text-xs"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        <Check className="w-3.5 h-3.5" /> ยืนยัน
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs text-muted-foreground"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        <X className="w-3.5 h-3.5" /> ยกเลิก
                    </Button>
                </div>
            )}
            {item.status === "applied" && (
                <div className="flex items-center gap-1.5 px-3 pb-3 text-xs text-emerald-600 dark:text-emerald-400 border-t border-emerald-500/15 pt-2 mt-0.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.resultMessage}</span>
                    {item.resultHref && (
                        <Link
                            href={item.resultHref}
                            className="ml-auto inline-flex items-center gap-0.5 underline hover:no-underline shrink-0"
                        >
                            เปิด <ArrowRight className="w-3 h-3" />
                        </Link>
                    )}
                </div>
            )}
            {item.status === "cancelled" && (
                <p className="px-3 pb-3 text-xs text-muted-foreground">ยกเลิกแล้ว</p>
            )}
        </div>
    );
}

function EmptyHint({ onPick, disabled }: { onPick: (t: string) => void; disabled: boolean }) {
    return (
        <div className="flex flex-col items-center text-center py-8 px-2 text-muted-foreground">
            <div className="p-3 rounded-full bg-[var(--forge-gold,#e0a13c)]/10 mb-3">
                <Wand2 className="w-6 h-6 text-[var(--forge-gold,#e0a13c)]" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">สั่งงานผู้ช่วยได้เลย</p>
            <p className="text-xs leading-relaxed max-w-[260px] mb-4">
                บอกสิ่งที่อยากทำ ผู้ช่วยจะร่างให้ดูก่อน แล้วค่อยกดยืนยัน
            </p>
            <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">ลองพิมพ์</span>
                {QUICK_PROMPTS.map((q) => (
                    <button
                        key={q}
                        disabled={disabled}
                        onClick={() => onPick(q)}
                        className="text-left text-xs rounded-lg border bg-muted/30 px-3 py-2 hover:bg-muted hover:border-[var(--forge-gold,#e0a13c)]/40 transition-colors disabled:opacity-50"
                    >
                        {q}
                    </button>
                ))}
            </div>
        </div>
    );
}
