"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight, PenTool, RotateCw, SpellCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SpellStatusBadge } from "@/components/project/spell-status-badge";
import { useChoiceDialog } from "@/components/project/choice-dialog";
import { triggerSpellCheck } from "@/lib/spell-trigger";

// รายการคิวแก้ไข — แบ่งกลุ่มตามสถานะ แบ่งหน้าในแต่ละกลุ่ม เลือกหลายตอนแล้วสั่งตรวจคำผิดเฉพาะที่เลือกได้
// ข้อมูลมาจาก server (page.tsx) ทั้งหมด — state ในนี้มีแค่ กลุ่มที่พับ / หน้าปัจจุบัน / ตอนที่เลือก (หายเมื่อออกจากหน้า)

export interface QueueRow {
    id: string;
    title: string;
    status: string;          // proofreading | user_verify | needs_rewrite
    chapterTitle: string | null;
    chapterOrder: number;    // ลำดับบท (ไม่มีบท = ท้ายสุด)
    noteOrder: number;       // ลำดับตอนในบท
    updatedAt: string | null;
    wordCount: number;
    plotHoleCount: number;
    unresolved: number;      // จุดตรวจคำผิดที่ยังไม่แก้
    total: number;           // ผลตรวจคำผิดทั้งหมด (>0 = เคยตรวจแล้ว)
}

const GROUPS: { status: string; label: string; hint: string }[] = [
    { status: "proofreading", label: "กำลังตรวจคำผิด", hint: "ตั้งสถานะรอพิสูจน์อักษรแล้ว ระบบกำลังตรวจหรือรอคิว" },
    { status: "user_verify", label: "ตรวจเสร็จ รอดูผล", hint: "ตรวจคำผิดเสร็จแล้ว เข้าไปดูและแก้ตามรายการ" },
    { status: "needs_rewrite", label: "รอ Rewrite", hint: "ตอนที่ตั้งไว้ว่าต้องเขียนใหม่ (ตรวจคำผิดให้ด้วยตอนตั้งสถานะ)" },
];
const PAGE_SIZE = 10;

const fmtDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yy · HH:mm", { locale: th }) : "—");

export function RewriteQueue({ novelId, rows }: { novelId: string; rows: QueueRow[] }) {
    const [ask, choiceDialog] = useChoiceDialog();
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState<Record<string, number>>({});
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const groups = useMemo(() => GROUPS.map((g) => ({
        ...g,
        // ในกลุ่ม: จุดค้างเยอะก่อน แล้วตามลำดับการอ่าน (บท -> ตอน)
        rows: rows
            .filter((r) => r.status === g.status)
            .sort((a, b) => b.unresolved - a.unresolved || a.chapterOrder - b.chapterOrder || a.noteOrder - b.noteOrder),
    })).filter((g) => g.rows.length > 0), [rows]);

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const checkSelected = async () => {
        const picked = rows.filter((r) => selected.has(r.id));
        const done = picked.filter((r) => r.total > 0);
        let targets = picked;
        if (done.length > 0) {
            const fresh = picked.length - done.length;
            const choice = await ask({
                title: `ตรวจคำผิด ${picked.length} ตอนที่เลือก`,
                description: (
                    <>
                        <p>มี {done.length} ตอนที่ตรวจไว้แล้ว — ตรวจใหม่จะแทนที่ผลเดิมของตอนนั้น</p>
                        <p>ระบบตรวจทีละตอนเบื้องหลัง ปิดหน้านี้ได้</p>
                    </>
                ),
                choices: [
                    ...(fresh > 0 ? [{ value: "fresh", label: `เฉพาะที่ยังไม่ตรวจ (${fresh})`, primary: true }] : []),
                    { value: "all", label: `ตรวจใหม่ทั้งหมดที่เลือก (${picked.length})`, primary: fresh === 0 },
                ],
            });
            if (!choice) return;
            if (choice === "fresh") targets = picked.filter((r) => r.total === 0);
        }
        const res = await fetch(`/api/novel/${novelId}/spell-check-queue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteIds: targets.map((t) => t.id) }),
        }).catch(() => null);
        const data = res?.ok ? await res.json() : null;
        if (!data?.success) {
            toast.error("ส่งเข้าคิวตรวจไม่สำเร็จ");
            return;
        }
        toast.success(`ส่ง ${data.queued} ตอนเข้าคิวตรวจแล้ว${data.skipped ? ` (ข้าม ${data.skipped} ตอนที่ไม่มีเนื้อหา)` : ""}`);
        for (const t of targets) window.dispatchEvent(new CustomEvent("spell-job-started", { detail: t.id }));
        setSelected(new Set());
    };

    const recheck = async (r: QueueRow) => {
        if (await triggerSpellCheck(novelId, r.id, r.status)) toast.info(`ส่ง "${r.title}" เข้าคิวตรวจใหม่แล้ว`);
        else toast.error("เริ่มตรวจคำผิดไม่สำเร็จ");
    };

    return (
        <div className="space-y-3">
            {choiceDialog}

            {/* แถบเครื่องมือ: สรุปตามกลุ่ม + ตรวจที่เลือก */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                    {groups.map((g) => `${g.label} ${g.rows.length}`).join(" · ") || "ไม่มีตอนในคิว"}
                </span>
                {selected.size > 0 && (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(new Set())}>
                            ล้างที่เลือก
                        </Button>
                        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={checkSelected}>
                            <SpellCheck className="h-3.5 w-3.5" aria-hidden /> ตรวจที่เลือก ({selected.size})
                        </Button>
                    </div>
                )}
            </div>

            {groups.map((g) => {
                const pages = Math.ceil(g.rows.length / PAGE_SIZE);
                const p = Math.min(page[g.status] ?? 0, pages - 1);
                const shown = g.rows.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
                const isOpen = !collapsed[g.status];
                const selectable = g.rows.filter((r) => r.wordCount > 0);
                const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
                return (
                    <section key={g.status} className="chamfered border bg-card/50">
                        <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={(v) => setSelected((prev) => {
                                    const next = new Set(prev);
                                    for (const r of selectable) { if (v) next.add(r.id); else next.delete(r.id); }
                                    return next;
                                })}
                                aria-label={`เลือกทุกตอนในกลุ่ม${g.label}`}
                                disabled={selectable.length === 0}
                            />
                            <button
                                type="button"
                                className="flex flex-1 items-center gap-2 text-left"
                                onClick={() => setCollapsed((c) => ({ ...c, [g.status]: isOpen }))}
                                aria-expanded={isOpen}
                                title={g.hint}
                            >
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} aria-hidden />
                                <span className="text-sm font-semibold">{g.label}</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{g.rows.length}</Badge>
                            </button>
                        </header>

                        {isOpen && (
                            <>
                                <div className="divide-y divide-border/50">
                                    {shown.map((r) => {
                                        const empty = r.wordCount === 0;
                                        return (
                                            <div key={r.id} className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors", empty && "opacity-60")}>
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <Checkbox
                                                        className="mt-1"
                                                        checked={selected.has(r.id)}
                                                        onCheckedChange={() => toggle(r.id)}
                                                        disabled={empty}
                                                        aria-label={`เลือก ${r.title}`}
                                                    />
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-semibold text-foreground text-sm sm:text-base truncate">{r.title}</span>
                                                            {r.chapterTitle && <Badge variant="secondary" className="text-xs">{r.chapterTitle}</Badge>}
                                                            {empty
                                                                ? <Badge variant="outline" className="text-[11px]">ว่าง</Badge>
                                                                : <SpellStatusBadge novelId={novelId} noteId={r.id} status={r.status} unresolvedCount={r.unresolved} checked={r.total > 0} />}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                            <span>แก้ไขล่าสุด {fmtDate(r.updatedAt)}</span>
                                                            <span aria-hidden>·</span>
                                                            <span>{r.wordCount.toLocaleString()} คำ</span>
                                                            {r.plotHoleCount > 0 && (
                                                                <>
                                                                    <span aria-hidden>·</span>
                                                                    <span className="text-amber-500 font-medium">พบ {r.plotHoleCount} plot holes</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5">
                                                    {!empty && r.total > 0 && (
                                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => recheck(r)} title="ตรวจคำผิดตอนนี้ใหม่ (แทนที่ผลเดิม)">
                                                            <RotateCw className="h-3.5 w-3.5" aria-hidden /> ตรวจใหม่
                                                        </Button>
                                                    )}
                                                    <Link
                                                        href={`/dashboard/project/${novelId}/note/${r.id}/rewrite`}
                                                        className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                                    >
                                                        <PenTool className="h-3.5 w-3.5 mr-1.5 text-amber-500" aria-hidden />
                                                        {r.status === "needs_rewrite" ? "ตรวจแก้ (Rewrite)" : "ดูผลตรวจ"}
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {pages > 1 && (
                                    <nav className="flex items-center justify-end gap-1 px-4 py-2 border-t border-border/50 text-xs text-muted-foreground" aria-label={`หน้าของกลุ่ม${g.label}`}>
                                        <span className="mr-2">
                                            {p * PAGE_SIZE + 1}–{Math.min((p + 1) * PAGE_SIZE, g.rows.length)} จาก {g.rows.length}
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={p === 0}
                                            onClick={() => setPage((s) => ({ ...s, [g.status]: p - 1 }))} aria-label="หน้าก่อน">
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="tabular-nums">{p + 1}/{pages}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={p >= pages - 1}
                                            onClick={() => setPage((s) => ({ ...s, [g.status]: p + 1 }))} aria-label="หน้าถัดไป">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </nav>
                                )}
                            </>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
