"use client";

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    DndContext, DragOverlay, PointerSensor, KeyboardSensor,
    useSensor, useSensors, useDraggable, useDroppable, closestCenter,
    type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Shield, X, Trash2, Users, Crown, Link2, LayoutGrid, ListTree, ChevronRight, Settings2, Pencil, Lightbulb, Layers } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    createFaction, updateFaction, deleteFaction,
    createFactionRelationship, deleteFactionRelationship,
    createFactionStatusPreset, updateFactionStatusPreset, deleteFactionStatusPreset,
} from "@/server/factions";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import type { FactionStatusPreset } from "@/db/schema";

// ── fallback presets (ใช้เมื่อ user ยังไม่ได้ตั้งค่าเลย)
const DEFAULT_PRESETS: FactionStatusPreset[] = [
    { id: "_active",     key: "active",     label: "ยังปฏิบัติการ", color: "#10b981", novelId: null, userId: "", orderIndex: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: "_allied_gov", key: "allied_gov", label: "ร่วมกับรัฐ",    color: "#f59e0b", novelId: null, userId: "", orderIndex: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: "_defected",  key: "defected",  label: "ย้ายฝั่ง",      color: "#ef4444", novelId: null, userId: "", orderIndex: 2, createdAt: new Date(), updatedAt: new Date() },
    { id: "_neutral",   key: "neutral",   label: "ไม่สังกัดฝ่าย", color: "#94a3b8", novelId: null, userId: "", orderIndex: 3, createdAt: new Date(), updatedAt: new Date() },
    { id: "_disbanded", key: "disbanded", label: "สาบสูญ/ยุบ",    color: "#475569", novelId: null, userId: "", orderIndex: 4, createdAt: new Date(), updatedAt: new Date() },
];

const ALIGNMENT_META: Record<string, { label: string; cls: string }> = {
    good:    { label: "ฝ่ายดี",    cls: "text-emerald-500 border-emerald-500/40" },
    neutral: { label: "เป็นกลาง",  cls: "text-steel-400 border-steel-400/40" },
    gray:    { label: "สีเทา",     cls: "text-[var(--forge-amber)] border-[var(--forge-amber)]/40" },
    evil:    { label: "ฝ่ายร้าย",  cls: "text-red-500 border-red-500/40" },
};

// เลือกสีตัวอักษรดำ/ขาวตาม luminance ของสีพื้น (plate หัวคอลัมน์)
const inkFor = (color: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return "#fafaf9";
    const n = parseInt(color.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0c0a09" : "#fafaf9";
};

const PAGE_SIZE = 4;

function Pager({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
    return (
        <div className="flex items-center justify-between pt-0.5">
            <button type="button" onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0}
                className="h-6 w-6 grid place-items-center chamfered-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors">
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </button>
            <span className="font-technical text-[10px] text-muted-foreground tabular-nums">{page + 1} / {pageCount}</span>
            <button type="button" onClick={() => onChange(Math.min(pageCount - 1, page + 1))} disabled={page === pageCount - 1}
                className="h-6 w-6 grid place-items-center chamfered-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors">
                <ChevronRight className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

const REL_TYPES: Record<string, string> = {
    ally: "พันธมิตร", enemy: "ศัตรู", rival: "คู่แข่ง",
    subsidiary: "ขึ้นตรงต่อ", splinter: "แตกออกมาจาก", neutral: "เป็นกลาง",
};

type Faction = any;
type FactionRel = any;
type Character = { id: string; name: string; image?: string | null };
type Idea = { id: string; title: string; summary?: string | null; content?: string | null; color?: string | null; category?: string | null };
type WorldSystem = { id: string; name: string; category?: string | null; description?: string | null; color?: string | null };

interface Props {
    novelId: string;
    initialFactions: Faction[];
    initialRelationships: FactionRel[];
    characters: Character[];
    initialStatusPresets: FactionStatusPreset[];
    ideas: Idea[];
    systems: WorldSystem[];
}

const EMPTY_FORM = {
    name: "", type: "", description: "", color: "#c2703d",
    status: "active", alignment: "", goal: "", element: "",
    leaderId: "", parentFactionId: "", linkedIdeaIds: [] as string[], linkedSystemIds: [] as string[],
};

export function FactionsContent({ novelId, initialFactions, initialRelationships, characters, initialStatusPresets, ideas, systems }: Props) {
    const [factions, setFactions] = useState<Faction[]>(initialFactions);
    const [rels, setRels] = useState<FactionRel[]>(initialRelationships);
    const [view, setView] = useState<"status" | "tree">("status");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [dragId, setDragId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    // Status presets
    const [statusPresets, setStatusPresets] = useState<FactionStatusPreset[]>(
        initialStatusPresets.length > 0 ? initialStatusPresets : DEFAULT_PRESETS
    );
    const [showPresetManager, setShowPresetManager] = useState(false);
    const [presetForm, setPresetForm] = useState({ label: "", color: "#64748b", scope: "novel" as "global" | "novel" });
    const [savingPreset, setSavingPreset] = useState(false);
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

    // faction-relationship add form
    const [relTarget, setRelTarget] = useState("");
    const [relType, setRelType] = useState("ally");

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor),
    );

    const selected = useMemo(
        () => factions.find((f) => f.id === selectedId) ?? null,
        [factions, selectedId],
    );

    const byStatus = useMemo(() => {
        const m: Record<string, Faction[]> = {};
        for (const s of statusPresets) m[s.key] = [];
        const other: Faction[] = [];
        for (const f of factions) {
            const preset = statusPresets.find(p => p.key === f.status);
            (preset ? m[preset.key] : other).push(f);
        }
        return { m, other };
    }, [factions, statusPresets]);

    const childrenOf = (pid: string | null) =>
        factions.filter((f) => (f.parentFactionId ?? null) === pid);
    const roots = useMemo(
        () => factions.filter((f) => !f.parentFactionId || !factions.some((x) => x.id === f.parentFactionId)),
        [factions],
    );

    const nameById = (id: string | null) =>
        id ? (factions.find((f) => f.id === id)?.name ?? "—") : null;
    const charName = (id: string | null) =>
        id ? (characters.find((c) => c.id === id)?.name ?? "—") : null;

    const buildPayload = (fm: typeof form) => ({
        name: fm.name.trim(), type: fm.type || undefined, description: fm.description || undefined,
        color: fm.color, status: fm.status || undefined, alignment: fm.alignment || undefined,
        goal: fm.goal || undefined, element: fm.element || undefined,
        leaderId: fm.leaderId || null, parentFactionId: fm.parentFactionId || null,
        linkedIdeaIds: fm.linkedIdeaIds, linkedSystemIds: fm.linkedSystemIds,
    });

    // snapshot ของฟอร์มตอนเปิด → ใช้เช็คว่ามีการแก้จริงไหมก่อน auto-save
    const pristine = useRef("");

    // ── open forms (flush edit ที่ค้างก่อนสลับ) ──
    const openCreate = () => { flushEdit(); setForm({ ...EMPTY_FORM }); pristine.current = ""; setIsCreating(true); setSelectedId(null); };
    const openInspector = (f: Faction) => {
        if (f.id !== selectedId) flushEdit();
        setIsCreating(false);
        setSelectedId(f.id);
        const next = {
            name: f.name ?? "", type: f.type ?? "", description: f.description ?? "",
            color: f.color ?? "#c2703d", status: f.status ?? "active",
            alignment: f.alignment ?? "", goal: f.goal ?? "", element: f.element ?? "",
            leaderId: f.leaderId ?? "", parentFactionId: f.parentFactionId ?? "",
            linkedIdeaIds: (f.linkedIdeaIds ?? []) as string[],
            linkedSystemIds: (f.linkedSystemIds ?? []) as string[],
        };
        setForm(next);
        pristine.current = JSON.stringify(next);
    };
    const closePanel = () => { flushEdit(); setSelectedId(null); setIsCreating(false); };

    const patchLocal = (id: string, patch: Record<string, unknown>) =>
        setFactions((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));

    // auto-save เฉพาะแก้ฝ่ายเดิม + มีการเปลี่ยนจริง + ชื่อไม่ว่าง (fire-and-forget)
    const flushEdit = () => {
        if (isCreating || !selectedId) return;
        if (JSON.stringify(form) === pristine.current) return;
        if (!form.name.trim()) return;
        const id = selectedId;
        const payload = buildPayload(form);
        patchLocal(id, payload);
        pristine.current = JSON.stringify(form);
        updateFaction(id, payload).then((res) => {
            if (res.success && res.data) patchLocal(id, res.data);
            else toast.error("บันทึกอัตโนมัติไม่สำเร็จ");
        });
        toast.success("บันทึกแล้ว");
    };

    // ── linked ideas (แปะการ์ดไอเดียกับฝ่าย) ──
    const [ideaList, setIdeaList] = useState<Idea[]>(ideas);
    const ideaById = useMemo(() => new Map(ideaList.map((i) => [i.id, i])), [ideaList]);
    const [ideaPickerOpen, setIdeaPickerOpen] = useState(false);
    const [createIdeaOpen, setCreateIdeaOpen] = useState(false);
    const [ideaPage, setIdeaPage] = useState(0);
    const pinIdea = (id: string) =>
        setForm((f) => (f.linkedIdeaIds.includes(id) ? f : { ...f, linkedIdeaIds: [...f.linkedIdeaIds, id] }));
    const unpinIdea = (id: string) =>
        setForm((f) => ({ ...f, linkedIdeaIds: f.linkedIdeaIds.filter((x) => x !== id) }));

    // สร้างไอเดียจากฟอร์มเต็ม (CreateIdeaDialog) → เก็บเข้า list + แปะกับฝ่ายนี้เลย
    const handleIdeaCreated = (created: Idea) => {
        if (!created?.id) return;
        setIdeaList((p) => (p.some((i) => i.id === created.id) ? p : [...p, created]));
        pinIdea(created.id);
    };

    // ── linked world systems (ผูกระบบโลกกับฝ่าย) ──
    const systemById = useMemo(() => new Map(systems.map((s) => [s.id, s])), [systems]);
    const [systemPickerOpen, setSystemPickerOpen] = useState(false);
    const [systemPage, setSystemPage] = useState(0);
    const pinSystem = (id: string) =>
        setForm((f) => (f.linkedSystemIds.includes(id) ? f : { ...f, linkedSystemIds: [...f.linkedSystemIds, id] }));
    const unpinSystem = (id: string) =>
        setForm((f) => ({ ...f, linkedSystemIds: f.linkedSystemIds.filter((x) => x !== id) }));

    // ── save (create or update) ──
    const handleSave = async () => {
        if (!form.name.trim()) { toast.error("ใส่ชื่อฝ่ายก่อนนะครับ"); return; }
        setSaving(true);
        const payload = buildPayload(form);
        try {
            if (isCreating) {
                const res = await createFaction({ ...payload, novelId });
                if (res.success && res.data) {
                    setFactions((p) => [...p, { ...res.data, members: [] }]);
                    setSelectedId(res.data.id); setIsCreating(false);
                    pristine.current = JSON.stringify(form);
                    toast.success("สร้างฝ่ายแล้ว");
                } else toast.error(res.error || "สร้างไม่สำเร็จ");
            } else if (selectedId) {
                const res = await updateFaction(selectedId, payload);
                if (res.success && res.data) { patchLocal(selectedId, res.data); pristine.current = JSON.stringify(form); toast.success("บันทึกแล้ว"); }
                else toast.error(res.error || "บันทึกไม่สำเร็จ");
            }
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!selectedId) return;
        const res = await deleteFaction(selectedId);
        if (res.success) {
            // ฝ่ายลูกที่ชี้มาที่ตัวนี้ → เลื่อนขึ้น root (parent = null) ให้ตรงกับ DB (onDelete set null)
            setFactions((p) => p
                .filter((f) => f.id !== selectedId)
                .map((f) => (f.parentFactionId === selectedId ? { ...f, parentFactionId: null } : f)));
            setRels((p) => p.filter((r) => r.sourceFactionId !== selectedId && r.targetFactionId !== selectedId));
            setDeleteDialogOpen(false); closePanel(); toast.success("ลบแล้ว");
        } else toast.error("ลบไม่สำเร็จ");
    };

    // ── drag: status board (move column) + tree (re-parent) ──
    const isDescendant = (candidate: string, ofNode: string): boolean => {
        const stack = [...childrenOf(ofNode)];
        while (stack.length) {
            const n = stack.pop()!;
            if (n.id === candidate) return true;
            stack.push(...childrenOf(n.id));
        }
        return false;
    };

    const setStatus = async (id: string, status: string) => {
        const prev = factions.find((f) => f.id === id);
        if (!prev || prev.status === status) return;
        patchLocal(id, { status });
        const res = await updateFaction(id, { status });
        const preset = statusPresets.find(p => p.key === status);
        if (res.success) toast.success(`ย้ายไป "${preset?.label ?? status}"`);
        else { patchLocal(id, { status: prev.status }); toast.error("ย้ายไม่สำเร็จ"); }
    };

    const reparent = async (id: string, parentId: string | null) => {
        const prev = factions.find((f) => f.id === id);
        if (!prev || (prev.parentFactionId ?? null) === parentId) return;
        if (parentId && (parentId === id || isDescendant(parentId, id))) {
            toast.error("ย้ายเข้าใต้ฝ่ายลูกของตัวเองไม่ได้"); return;
        }
        patchLocal(id, { parentFactionId: parentId });
        const res = await updateFaction(id, { parentFactionId: parentId });
        if (res.success) toast.success(parentId ? `ย้ายไปใต้ "${nameById(parentId)}"` : "ย้ายขึ้นบนสุด");
        else { patchLocal(id, { parentFactionId: prev.parentFactionId }); toast.error("ย้ายไม่สำเร็จ"); }
    };

    const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
    const onDragEnd = (e: DragEndEvent) => {
        setDragId(null);
        const { active, over } = e;
        if (!over) return;
        const id = String(active.id);
        const overId = String(over.id);
        if (overId.startsWith("status:")) setStatus(id, overId.slice(7));
        else if (overId.startsWith("parent:")) {
            const t = overId.slice(7);
            reparent(id, t === "root" ? null : t);
        }
    };

    // ── faction relationships ──
    const selectedRels = useMemo(
        () => rels.filter((r) => r.sourceFactionId === selectedId || r.targetFactionId === selectedId),
        [rels, selectedId],
    );

    const handleAddRel = async () => {
        if (!selectedId || !relTarget) { toast.error("เลือกฝ่ายปลายทางก่อน"); return; }
        if (relTarget === selectedId) { toast.error("เลือกฝ่ายอื่นที่ไม่ใช่ตัวเอง"); return; }
        const res = await createFactionRelationship({
            novelId, sourceFactionId: selectedId, targetFactionId: relTarget, type: relType,
        });
        if (res.success && res.data) {
            const src = factions.find((f) => f.id === selectedId);
            const tgt = factions.find((f) => f.id === relTarget);
            setRels((p) => [...p, { ...res.data, sourceFaction: src, targetFaction: tgt }]);
            setRelTarget(""); toast.success("เพิ่มความสัมพันธ์แล้ว");
        } else toast.error(res.error || "เพิ่มไม่สำเร็จ");
    };

    const handleDeleteRel = async (relId: string) => {
        const res = await deleteFactionRelationship(relId, novelId);
        if (res.success) { setRels((p) => p.filter((r) => r.id !== relId)); toast.success("ลบความสัมพันธ์แล้ว"); }
        else toast.error("ลบไม่สำเร็จ");
    };

    const toggleCollapse = (id: string) =>
        setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const panelOpen = isCreating || !!selected;
    const dragFaction = dragId ? factions.find((f) => f.id === dragId) : null;

    // ── Preset Manager handlers ──
    const handleCreatePreset = async () => {
        if (!presetForm.label.trim()) { toast.error("ใส่ชื่อสถานะก่อน"); return; }
        setSavingPreset(true);
        const key = presetForm.label.trim().toLowerCase().replace(/[^a-z0-9ก-๙]/g, "_");
        const res = await createFactionStatusPreset({
            key,
            label: presetForm.label.trim(),
            color: presetForm.color,
            novelId: presetForm.scope === "novel" ? novelId : null,
            orderIndex: statusPresets.length,
        });
        setSavingPreset(false);
        if (res.success && res.data) {
            setStatusPresets(p => [...p, res.data!]);
            setPresetForm({ label: "", color: "#64748b", scope: "novel" });
            toast.success(`เพิ่มสถานะ "${res.data.label}" แล้ว`);
        } else toast.error(res.error || "เพิ่มไม่สำเร็จ");
    };

    const handleDeletePreset = async (presetId: string) => {
        // fallback preset (id ขึ้นต้นด้วย _) ยังไม่มีแถวใน DB → สร้างของที่เหลือเข้า DB ก่อน แล้วค่อยตัดตัวนี้ออก
        if (presetId.startsWith("_")) {
            const keep = statusPresets.filter(x => x.id !== presetId);
            const created = await Promise.all(keep.map((p, i) =>
                createFactionStatusPreset({ key: p.key, label: p.label, color: p.color, novelId, orderIndex: i })
            ));
            const failed = created.find(r => !r.success);
            if (failed) { toast.error(failed.error || "ลบไม่สำเร็จ"); return; }
            setStatusPresets(created.map(r => r.data!));
            toast.success("ลบสถานะแล้ว");
            return;
        }
        const res = await deleteFactionStatusPreset(presetId, novelId);
        if (res.success) {
            setStatusPresets(p => p.filter(x => x.id !== presetId));
            toast.success("ลบสถานะแล้ว");
        } else toast.error("ลบไม่สำเร็จ");
    };

    const handleUpdatePresetLabel = async (presetId: string, label: string) => {
        if (presetId.startsWith("_")) return; // fallback ไม่แก้ใน DB
        const res = await updateFactionStatusPreset(presetId, { label }, novelId);
        if (res.success && res.data) {
            setStatusPresets(p => p.map(x => x.id === presetId ? res.data! : x));
        }
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="h-full flex relative">
                {/* Board */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">
                    <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-steel-800/60">
                        <div className="flex items-center gap-3">
                            <span className="font-technical text-[10px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                                <span className="text-base font-bold text-[var(--forge-amber)] mr-1 align-middle">{String(factions.length).padStart(2, "0")}</span>ฝ่าย
                            </span>
                            {/* View toggle */}
                            <div className="inline-flex chamfered-sm border border-steel-800 p-0.5">
                                <ViewBtn active={view === "status"} onClick={() => setView("status")} icon={<LayoutGrid className="h-3 w-3" />} label="สถานะ" />
                                <ViewBtn active={view === "tree"} onClick={() => setView("tree")} icon={<ListTree className="h-3 w-3" />} label="ลำดับชั้น" />
                            </div>
                            {/* Preset manager toggle */}
                            {view === "status" && (
                                <button
                                    onClick={() => setShowPresetManager(v => !v)}
                                    className={cn(
                                        "inline-flex items-center gap-1 px-2 py-1 chamfered-sm font-technical text-[10px] uppercase tracking-wide transition-colors border border-steel-800",
                                        showPresetManager ? "bg-[var(--forge-amber)] text-black border-[var(--forge-amber)]" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    <Settings2 className="h-3 w-3" /> จัดการสถานะ
                                </button>
                            )}
                        </div>
                        <Button size="sm" className="h-8 gap-1.5 text-xs chamfered-sm" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5" /> เพิ่มฝ่าย
                        </Button>
                    </div>

                    {/* Preset Manager Panel */}
                    {showPresetManager && (
                        <div className="border-b border-steel-800/60 bg-muted/20 px-6 py-4 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200 motion-reduce:animate-none">
                            <div className="flex items-center gap-2">
                                <Settings2 className="h-3 w-3 text-[var(--forge-amber)]" />
                                <p className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                    สถานะที่มีอยู่ <span className="text-muted-foreground/50">· {statusPresets.length}</span>
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {statusPresets.map(p => (
                                    <div key={p.id}
                                        className="group flex items-center gap-2 pl-2 pr-1 py-1 chamfered-sm border border-steel-800 bg-card/60 hover:border-steel-700 transition-colors">
                                        <span className="h-2.5 w-2.5 chamfered-sm shrink-0 ring-1 ring-black/20" style={{ background: p.color }} />
                                        {editingPresetId === p.id ? (
                                            <input
                                                autoFocus
                                                defaultValue={p.label}
                                                className="text-xs bg-transparent border-b border-[var(--forge-amber)] outline-none w-20"
                                                onBlur={e => { handleUpdatePresetLabel(p.id, e.target.value); setEditingPresetId(null); }}
                                                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                            />
                                        ) : (
                                            <span className="text-xs">{p.label}</span>
                                        )}
                                        <span className="font-technical text-[9px] uppercase tracking-wide text-muted-foreground/50 shrink-0">
                                            {p.novelId ? "นิยายนี้" : "global"}
                                        </span>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingPresetId(p.id)} aria-label="แก้ไขชื่อสถานะ"
                                                className="p-1 text-muted-foreground hover:text-[var(--forge-amber)]">
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                            <button onClick={() => handleDeletePreset(p.id)} aria-label="ลบสถานะนี้"
                                                className="p-1 text-muted-foreground hover:text-red-500">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Add new preset form */}
                            <div className="pt-3 border-t border-steel-800/60 flex items-center gap-2">
                                <label className="relative h-7 w-7 shrink-0 chamfered-sm border border-steel-800 cursor-pointer overflow-hidden"
                                    style={{ background: presetForm.color }} title="เลือกสี">
                                    <input
                                        type="color" value={presetForm.color}
                                        onChange={e => setPresetForm(f => ({ ...f, color: e.target.value }))}
                                        className="absolute -inset-2 cursor-pointer opacity-0"
                                    />
                                </label>
                                <Input
                                    value={presetForm.label}
                                    onChange={e => setPresetForm(f => ({ ...f, label: e.target.value }))}
                                    placeholder="ชื่อสถานะใหม่…"
                                    className="h-7 text-xs border-steel-800 w-40"
                                    onKeyDown={e => e.key === "Enter" && handleCreatePreset()}
                                />
                                <Select value={presetForm.scope} onValueChange={(v) => setPresetForm(f => ({ ...f, scope: v as "global" | "novel" }))}>
                                    <SelectTrigger className="h-7 text-xs border-steel-800 w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="novel">เฉพาะนิยายนี้</SelectItem>
                                        <SelectItem value="global">ทุกนิยาย (global)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="forge" className="h-7 text-xs chamfered-sm" onClick={handleCreatePreset} disabled={savingPreset}>
                                    <Plus className="h-3 w-3 mr-1" /> เพิ่ม
                                </Button>
                            </div>
                        </div>
                    )}

                    {factions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                            <Shield className="w-10 h-10 text-steel-600" strokeWidth={1.5} />
                            <p className="text-sm">ยังไม่มีฝ่าย — กด <span className="text-[var(--forge-amber)] font-medium">เพิ่มฝ่าย</span> เพื่อเริ่มวางองค์กรในโลกของคุณ</p>
                        </div>
                    ) : view === "status" ? (
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 grid-pattern-subtle">
                            {statusPresets.map((preset) => (
                                <StatusColumn
                                    key={preset.key}
                                    statusKey={preset.key}
                                    meta={{ label: preset.label, color: preset.color }}
                                    factions={byStatus.m[preset.key] ?? []}
                                    selectedId={selectedId} onSelect={openInspector}
                                    nameById={nameById} charName={charName}
                                />
                            ))}
                            {byStatus.other.length > 0 && (
                                <StatusColumn statusKey={null} meta={{ label: "ไม่ระบุสถานะ", color: "#475569" }} factions={byStatus.other}
                                    selectedId={selectedId} onSelect={openInspector} nameById={nameById} charName={charName} />
                            )}
                        </div>
                    ) : (
                        <TreeView roots={roots} childrenOf={childrenOf} collapsed={collapsed} onToggle={toggleCollapse}
                            selectedId={selectedId} onSelect={openInspector} nameById={nameById} charName={charName} />
                    )}
                </div>

                {/* Inspector / editor modal */}
                <Dialog open={panelOpen} onOpenChange={(o) => { if (!o) closePanel(); }}>
                    <DialogContent className="sm:max-w-3xl max-h-[86vh] p-0 gap-0 overflow-hidden flex flex-col noise-texture-strong border-steel-800">
                        <DialogHeader className="px-5 py-3.5 border-b border-steel-800 shrink-0 text-left">
                            <DialogTitle className="flex items-center gap-2.5 text-sm">
                                {isCreating ? (
                                    <span className="font-technical text-[11px] uppercase tracking-[0.14em] text-[var(--forge-amber)]">สร้างฝ่ายใหม่</span>
                                ) : (
                                    <>
                                        <span className="h-7 w-7 chamfered-sm grid place-items-center font-display font-bold text-xs shrink-0"
                                            style={{ background: form.color, color: inkFor(form.color) }}>
                                            {(form.name || "?").trim().charAt(0) || "?"}
                                        </span>
                                        <span className="font-display font-bold truncate">{form.name || "ฝ่ายไม่มีชื่อ"}</span>
                                    </>
                                )}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-5 grid md:grid-cols-2 gap-x-6 gap-y-4 content-start">
                            <div className="space-y-3">
                            <Field label="ชื่อ *">
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="ชื่อฝ่าย เช่น กองทัพ, ตระกูล, สมาคมลับ" className="h-8 text-sm border-steel-800" />
                            </Field>
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="ประเภท">
                                    <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        placeholder="ตระกูล/องค์กร" className="h-8 text-sm border-steel-800" />
                                </Field>
                                <Field label="สีประจำฝ่าย">
                                    <input type="color" value={form.color} aria-label="สีประจำฝ่าย"
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        className="h-8 w-full chamfered-sm border border-steel-800 bg-transparent cursor-pointer" />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="สถานะ">
                                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                        <SelectTrigger className="h-8 text-xs border-steel-800"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {statusPresets.map((p) => (
                                                <SelectItem key={p.key} value={p.key}>
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                                                        {p.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field label="จุดยืนศีลธรรม">
                                    <Select value={form.alignment || "none"}
                                        onValueChange={(v) => setForm({ ...form, alignment: v === "none" ? "" : v })}>
                                        <SelectTrigger className="h-8 text-xs border-steel-800"><SelectValue placeholder="—" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">—</SelectItem>
                                            {Object.entries(ALIGNMENT_META).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="แท็ก/ลักษณะเฉพาะ">
                                    <Input value={form.element} onChange={(e) => setForm({ ...form, element: e.target.value })}
                                        placeholder="เช่น การเมือง, ศาสนา, การค้า" className="h-8 text-sm border-steel-800" />
                                </Field>
                                <Field label="หัวหน้า">
                                    <Select value={form.leaderId || "none"}
                                        onValueChange={(v) => setForm({ ...form, leaderId: v === "none" ? "" : v })}>
                                        <SelectTrigger className="h-8 text-xs border-steel-800"><SelectValue placeholder="—" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">—</SelectItem>
                                            {characters.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <Field label="สังกัดใต้ฝ่าย (ลำดับชั้น)">
                                <Select value={form.parentFactionId || "none"}
                                    onValueChange={(v) => setForm({ ...form, parentFactionId: v === "none" ? "" : v })}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800"><SelectValue placeholder="— ฝ่ายบนสุด" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— ฝ่ายบนสุด</SelectItem>
                                        {factions.filter((f) => f.id !== selectedId && !(selectedId && isDescendant(f.id, selectedId))).map((f) => (
                                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="เป้าหมาย/จุดยืน">
                                <Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
                                    placeholder="เป้าหมายของฝ่ายนี้..." className="text-sm min-h-[52px] border-steel-800" />
                            </Field>
                            <Field label="คำอธิบาย">
                                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="รายละเอียด..." className="text-sm min-h-[70px] border-steel-800" />
                            </Field>
                            </div>{/* end left column */}

                            <div className="space-y-4">
                            <div className="block space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">ไอเดียที่แปะไว้</span>
                                    <div className="flex items-center gap-2.5">
                                        <button type="button" onClick={() => setCreateIdeaOpen(true)}
                                            className="inline-flex items-center gap-1 text-[11px] text-[var(--forge-amber)] hover:underline">
                                            <Plus className="h-3 w-3" /> สร้างไอเดีย
                                        </button>
                                        <button type="button" onClick={() => setIdeaPickerOpen((o) => !o)}
                                            className="inline-flex items-center gap-1 text-[11px] text-[var(--forge-amber)] hover:underline">
                                            <Lightbulb className="h-3 w-3" /> แปะไอเดีย
                                        </button>
                                    </div>
                                </div>

                                {ideaPickerOpen && (() => {
                                    const avail = ideaList.filter((i) => !form.linkedIdeaIds.includes(i.id));
                                    return (
                                        <div className="chamfered-sm border border-steel-800 bg-card max-h-36 overflow-y-auto divide-y divide-steel-800/50 animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none">
                                            {avail.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground/60 p-2">ไม่มีไอเดียให้แปะเพิ่ม — กด &ldquo;สร้างไอเดีย&rdquo; เพื่อสร้างใหม่</p>
                                            ) : avail.map((i) => (
                                                <button type="button" key={i.id} onClick={() => pinIdea(i.id)}
                                                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-accent transition-colors">
                                                    <span className="h-2.5 w-2.5 chamfered-sm shrink-0" style={{ background: i.color ?? "#3b82f6" }} />
                                                    <span className="text-xs truncate">{i.title}</span>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {form.linkedIdeaIds.length > 0 ? (() => {
                                    const pageCount = Math.ceil(form.linkedIdeaIds.length / PAGE_SIZE);
                                    const page = Math.min(ideaPage, pageCount - 1);
                                    const pageIds = form.linkedIdeaIds.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
                                    return (
                                        <div className="space-y-1.5">
                                            {pageIds.map((id) => {
                                                const idea = ideaById.get(id);
                                                if (!idea) return null;
                                                return (
                                                    <div key={id} className="group flex items-start gap-2 p-2 chamfered-sm border border-steel-800 bg-card/60">
                                                        <span className="h-3.5 w-3.5 chamfered-sm shrink-0 mt-0.5 ring-1 ring-black/15" style={{ background: idea.color ?? "#3b82f6" }} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{idea.title}</p>
                                                            {(idea.summary || idea.content) && (
                                                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{idea.summary || idea.content}</p>
                                                            )}
                                                        </div>
                                                        <button type="button" onClick={() => unpinIdea(id)} aria-label="เอาไอเดียออก"
                                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity shrink-0">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {pageCount > 1 && <Pager page={page} pageCount={pageCount} onChange={setIdeaPage} />}
                                        </div>
                                    );
                                })() : (
                                    <p className="text-[11px] text-muted-foreground/50">ยังไม่มีไอเดียแปะไว้ — กด &ldquo;แปะไอเดีย&rdquo; เพื่อดึงการ์ดมาผูก</p>
                                )}
                            </div>

                            <div className="block space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">ระบบโลกที่ผูก</span>
                                    <button type="button" onClick={() => setSystemPickerOpen((o) => !o)}
                                        className="inline-flex items-center gap-1 text-[11px] text-[var(--forge-amber)] hover:underline">
                                        <Layers className="h-3 w-3" /> ผูกระบบ
                                    </button>
                                </div>

                                {systemPickerOpen && (() => {
                                    const avail = systems.filter((s) => !form.linkedSystemIds.includes(s.id));
                                    return (
                                        <div className="chamfered-sm border border-steel-800 bg-card max-h-40 overflow-y-auto divide-y divide-steel-800/50 animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none">
                                            {avail.length === 0 ? (
                                                <p className="text-[11px] text-muted-foreground/60 p-2">ไม่มีระบบให้ผูกเพิ่ม — สร้างได้ที่หน้า Worldbuilding</p>
                                            ) : avail.map((s) => (
                                                <button type="button" key={s.id} onClick={() => pinSystem(s.id)}
                                                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-accent transition-colors">
                                                    <span className="h-2.5 w-2.5 chamfered-sm shrink-0" style={{ background: s.color ?? "#6366f1" }} />
                                                    <span className="text-xs truncate flex-1">{s.name}</span>
                                                    {s.category && <span className="font-technical text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">{s.category}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {form.linkedSystemIds.length > 0 ? (() => {
                                    const pageCount = Math.ceil(form.linkedSystemIds.length / PAGE_SIZE);
                                    const page = Math.min(systemPage, pageCount - 1);
                                    const pageIds = form.linkedSystemIds.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
                                    return (
                                        <div className="space-y-1.5">
                                            {pageIds.map((id) => {
                                                const sys = systemById.get(id);
                                                if (!sys) return null;
                                                return (
                                                    <div key={id} className="group flex items-start gap-2 p-2 chamfered-sm border border-steel-800 bg-card/60">
                                                        <span className="h-3.5 w-3.5 chamfered-sm shrink-0 mt-0.5 ring-1 ring-black/15" style={{ background: sys.color ?? "#6366f1" }} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{sys.name}
                                                                {sys.category && <span className="ml-1.5 font-technical text-[9px] uppercase tracking-wide text-muted-foreground">{sys.category}</span>}
                                                            </p>
                                                            {sys.description && (
                                                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{sys.description}</p>
                                                            )}
                                                        </div>
                                                        <button type="button" onClick={() => unpinSystem(id)} aria-label="เอาระบบออก"
                                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity shrink-0">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {pageCount > 1 && <Pager page={page} pageCount={pageCount} onChange={setSystemPage} />}
                                        </div>
                                    );
                                })() : (
                                    <p className="text-[11px] text-muted-foreground/50">ยังไม่ได้ผูกระบบโลก — เช่น ระบบยศ, ลำดับชั้น, กฎขององค์กร</p>
                                )}
                            </div>

                            {!isCreating && selected && (
                                <div className="pt-3 mt-2 border-t border-steel-800/60 space-y-4">
                                    <div>
                                        <div className="flex items-center gap-1.5 font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
                                            <Users className="h-3 w-3" /> สมาชิก ({selected.members?.length ?? 0})
                                        </div>
                                        {selected.members?.length ? (
                                            <div className="space-y-1">
                                                {selected.members.map((m: any) => (
                                                    <div key={m.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 chamfered-sm bg-steel-800/40">
                                                        <span>{m.character?.name ?? "—"}</span>
                                                        {m.role && <span className="text-muted-foreground">{m.role}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-muted-foreground">เพิ่มสมาชิกได้ที่หน้า Characters / Relationships</p>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-1.5 font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
                                            <Link2 className="h-3 w-3" /> ความสัมพันธ์กับฝ่ายอื่น
                                        </div>
                                        <div className="space-y-1 mb-2">
                                            {selectedRels.map((r) => {
                                                const outgoing = r.sourceFactionId === selectedId;
                                                const otherName = outgoing ? nameById(r.targetFactionId) : nameById(r.sourceFactionId);
                                                return (
                                                    <div key={r.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 chamfered-sm bg-steel-800/40">
                                                        <span>
                                                            <span className="text-[var(--forge-amber)]">{outgoing ? "" : "← "}{REL_TYPES[r.type] ?? r.type}{outgoing ? " →" : ""}</span>{" "}
                                                            {otherName}
                                                        </span>
                                                        <button onClick={() => handleDeleteRel(r.id)}
                                                            aria-label={`ลบความสัมพันธ์ ${REL_TYPES[r.type] ?? r.type} กับ ${otherName}`}
                                                            className="h-6 w-6 -mr-1 inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-red-500 transition-colors">
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <Select value={relType} onValueChange={setRelType}>
                                                <SelectTrigger className="h-8 w-28 text-xs border-steel-800"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(REL_TYPES).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={relTarget} onValueChange={setRelTarget}>
                                                <SelectTrigger className="h-8 flex-1 text-xs border-steel-800"><SelectValue placeholder="ฝ่าย..." /></SelectTrigger>
                                                <SelectContent>
                                                    {factions.filter((f) => f.id !== selectedId).map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={handleAddRel} size="icon" variant="outline" aria-label="เพิ่มความสัมพันธ์" className="h-8 w-8 shrink-0 border-steel-800 chamfered-sm">
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>{/* end right column */}
                        </div>{/* end grid body */}

                        <DialogFooter className="px-5 py-3 border-t border-steel-800 shrink-0 sm:justify-between gap-2">
                            {!isCreating ? (
                                <Button onClick={() => setDeleteDialogOpen(true)} variant="outline" size="sm"
                                    className="h-8 text-xs text-red-500 hover:text-red-400 border-red-500/30 hover:bg-red-500/10 chamfered-sm">
                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบฝ่าย
                                </Button>
                            ) : <span />}
                            <div className="flex gap-2">
                                <Button onClick={closePanel} variant="ghost" size="sm" className="h-8 text-xs">ปิด</Button>
                                <Button onClick={handleSave} disabled={saving} size="sm" variant="forge" className="h-8 text-xs chamfered-sm min-w-24">
                                    {isCreating ? "สร้างฝ่าย" : "บันทึก"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <DragOverlay>
                {dragFaction ? (
                    <div className="opacity-90 rotate-1">
                        <FactionCard f={dragFaction} active onClick={() => {}} parentName={null} leaderName={charName(dragFaction.leaderId)} />
                    </div>
                ) : null}
            </DragOverlay>

            <CreateIdeaDialog
                novelId={novelId}
                open={createIdeaOpen}
                onOpenChange={setCreateIdeaOpen}
                defaultCategory="worldbuilding"
                onIdeaCreated={handleIdeaCreated}
                trigger={<span className="hidden" aria-hidden="true" />}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบฝ่ายนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            สมาชิก/ความสัมพันธ์ที่ผูกไว้จะถูกลบด้วย (ฝ่ายย่อยจะเลื่อนขึ้นบนสุด) การกระทำนี้ย้อนกลับไม่ได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white">
                            ลบ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DndContext>
    );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-1 chamfered-sm font-technical text-[10px] uppercase tracking-wide transition-all duration-150",
                "active:scale-95 motion-reduce:transform-none",
                active ? "bg-[var(--forge-amber)] text-black" : "text-muted-foreground hover:text-foreground",
            )}>
            {icon}{label}
        </button>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1">
            <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
            {children}
        </label>
    );
}

// ── Status board column (droppable) ──
function StatusColumn({
    statusKey, meta, factions, selectedId, onSelect, nameById, charName,
}: {
    statusKey: string | null;
    meta: { label: string; color: string };
    factions: Faction[];
    selectedId: string | null;
    onSelect: (f: Faction) => void;
    nameById: (id: string | null) => string | null;
    charName: (id: string | null) => string | null;
}) {
    // เฉพาะคอลัมน์ที่มี status จริงเท่านั้นที่รับ drop (คอลัมน์ "ไม่ระบุ" ไม่รับ)
    const { setNodeRef, isOver } = useDroppable({ id: statusKey ? `status:${statusKey}` : "status:none", disabled: !statusKey });
    return (
        <section ref={setNodeRef}
            className={cn("chamfered-sm transition-colors -m-2 p-2", isOver && "bg-[var(--forge-amber)]/10 ring-1 ring-[var(--forge-amber)]/40")}
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="inline-flex items-center gap-2.5 px-3 py-1.5 chamfered-sm shrink-0"
                    style={{ background: meta.color, color: inkFor(meta.color) }}>
                    <span className="font-technical text-[10px] font-semibold uppercase tracking-[0.16em]">{meta.label}</span>
                    <span className="font-technical text-[11px] font-bold tabular-nums opacity-80">{String(factions.length).padStart(2, "0")}</span>
                </div>
                <div className="h-px flex-1" style={{ background: `color-mix(in oklab, ${meta.color} 35%, transparent)` }} />
            </div>
            {factions.length > 0 ? (() => {
                // จัด cluster: ลูกที่อยู่สถานะเดียวกันซ้อนใต้แม่ พร้อมเส้นเชื่อม (แม่อยู่สถานะอื่น → โชว์เป็น badge เหมือนเดิม)
                const inSection = new Set(factions.map((f) => f.id));
                const kidsOf = (pid: string) => factions.filter((f) => f.parentFactionId === pid);
                const rootsHere = factions.filter((f) => !f.parentFactionId || !inSection.has(f.parentFactionId));
                const renderNode = (f: Faction): React.ReactNode => (
                    <div key={f.id} className="space-y-1.5">
                        <div className="relative">
                            <span className="absolute -left-3 top-0 h-1/2 w-3 border-l border-b border-steel-600/60" aria-hidden="true" />
                            <DraggableCard f={f} compact active={f.id === selectedId} onClick={() => onSelect(f)}
                                parentName={null} leaderName={charName(f.leaderId)} statusColor={meta.color} />
                        </div>
                        {kidsOf(f.id).length > 0 && <div className="ml-5 space-y-1.5">{kidsOf(f.id).map(renderNode)}</div>}
                    </div>
                );
                return (
                    <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                        {rootsHere.map((root) => (
                            <div key={root.id} className="space-y-1.5">
                                <DraggableCard f={root} active={root.id === selectedId} onClick={() => onSelect(root)}
                                    parentName={root.parentFactionId && !inSection.has(root.parentFactionId) ? nameById(root.parentFactionId) : null}
                                    leaderName={charName(root.leaderId)} statusColor={meta.color} />
                                {kidsOf(root.id).length > 0 && <div className="ml-5 space-y-1.5">{kidsOf(root.id).map(renderNode)}</div>}
                            </div>
                        ))}
                    </div>
                );
            })() : (
                <div className="h-16 grid place-items-center chamfered-sm border border-dashed border-steel-800/60">
                    <span className="text-[11px] text-muted-foreground/60">{statusKey ? "ลากฝ่ายมาวางที่นี่" : "ว่าง"}</span>
                </div>
            )}
        </section>
    );
}

// ── Tree view (each node is a re-parent drop target) ──
function TreeView({
    roots, childrenOf, collapsed, onToggle, selectedId, onSelect, nameById, charName,
}: {
    roots: Faction[];
    childrenOf: (pid: string | null) => Faction[];
    collapsed: Set<string>;
    onToggle: (id: string) => void;
    selectedId: string | null;
    onSelect: (f: Faction) => void;
    nameById: (id: string | null) => string | null;
    charName: (id: string | null) => string | null;
}) {
    const rootDrop = useDroppable({ id: "parent:root" });
    const renderLi = (f: Faction): React.ReactNode => {
        const kids = childrenOf(f.id);
        const isCollapsed = collapsed.has(f.id);
        return (
            <li key={f.id}>
                <TreeNode f={f} hasKids={kids.length > 0} isCollapsed={isCollapsed}
                    onToggle={() => onToggle(f.id)} active={f.id === selectedId} onSelect={() => onSelect(f)}
                    leaderName={charName(f.leaderId)} />
                {!isCollapsed && kids.length > 0 && <ul>{kids.map(renderLi)}</ul>}
            </li>
        );
    };
    return (
        <div className="flex-1 overflow-auto p-6 grid-pattern-subtle">
            <p className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-4">
                ลากการ์ดวางบนอีกฝ่ายเพื่อจัดลำดับชั้น · วางบนพื้นที่ว่างเพื่อย้ายขึ้นบนสุด
            </p>
            <div ref={rootDrop.setNodeRef}
                className={cn("genealogy w-max min-w-full transition-colors", rootDrop.isOver && "bg-[var(--forge-amber)]/5")}>
                <ul>{roots.map(renderLi)}</ul>
            </div>
        </div>
    );
}

function TreeNode({
    f, hasKids, isCollapsed, onToggle, active, onSelect, leaderName,
}: {
    f: Faction; hasKids: boolean; isCollapsed: boolean; onToggle: () => void;
    active: boolean; onSelect: () => void; leaderName: string | null;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `parent:${f.id}` });
    return (
        <div ref={setNodeRef}
            className={cn("relative w-56 chamfered-sm transition-colors", isOver && "ring-1 ring-[var(--forge-amber)] bg-[var(--forge-amber)]/10")}>
            <DraggableCard f={f} active={active} onClick={onSelect} parentName={null} leaderName={leaderName} compact />
            {hasKids && (
                <button onClick={onToggle} aria-label={isCollapsed ? "ขยาย" : "ยุบ"}
                    className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 h-5 w-5 grid place-items-center chamfered-sm border border-steel-700 bg-card text-muted-foreground hover:text-[var(--forge-amber)] hover:border-[var(--forge-amber)]/50 transition-colors">
                    <ChevronRight className={cn("h-3 w-3 transition-transform", !isCollapsed && "rotate-90")} />
                </button>
            )}
        </div>
    );
}

// ── Draggable wrapper around a card ──
function DraggableCard(props: { f: Faction; active: boolean; onClick: () => void; parentName: string | null; leaderName: string | null; compact?: boolean; statusColor?: string }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.f.id });
    return (
        <div ref={setNodeRef} {...listeners} {...attributes}
            className={cn("h-full animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none", isDragging && "opacity-40")}>
            <FactionCard {...props} />
        </div>
    );
}

function FactionCard({
    f, active, onClick, parentName, leaderName, compact, statusColor,
}: {
    f: Faction; active: boolean; onClick: () => void;
    parentName: string | null; leaderName: string | null; compact?: boolean; statusColor?: string;
}) {
    const align = f.alignment ? ALIGNMENT_META[f.alignment] : null;
    const color = f.color ?? statusColor ?? "#c2703d";
    return (
        <button onClick={onClick}
            className={cn(
                "w-full h-full text-left chamfered-sm border bg-card transition-all duration-200 group",
                compact ? "p-2" : "p-3",
                "hover:bg-accent hover:shadow-md hover:shadow-black/10 hover:-translate-y-0.5",
                "active:scale-[0.98] active:translate-y-0",
                "motion-reduce:transform-none motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-amber)]/50",
                active ? "border-[var(--forge-amber)] bg-accent" : "border-steel-800 hover:border-steel-700",
            )}
        >
            <div className="flex items-start gap-2.5">
                <span aria-hidden="true"
                    className={cn("chamfered-sm shrink-0 grid place-items-center font-display font-bold transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none", compact ? "h-7 w-7 text-xs" : "h-10 w-10 text-base")}
                    style={{ background: color, color: inkFor(color) }}>
                    {(f.name ?? "").trim().charAt(0) || "?"}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm truncate flex-1">{f.name}</span>
                        {f.type && <span className="font-technical text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">{f.type}</span>}
                    </div>
                    {compact ? (
                        (align || parentName) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {align && (<span className={cn("font-technical text-[9px] uppercase tracking-wide px-1.5 py-0.5 chamfered-sm border", align.cls)}>{align.label}</span>)}
                                {parentName && (<span className="text-[10px] text-muted-foreground truncate">↳ ใต้ {parentName}</span>)}
                            </div>
                        )
                    ) : (
                        <>
                            {(align || parentName || f.element) && (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {align && (<span className={cn("font-technical text-[9px] uppercase tracking-wide px-1.5 py-0.5 chamfered-sm border", align.cls)}>{align.label}</span>)}
                                    {parentName && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 chamfered-sm border border-[var(--forge-amber)]/30 bg-[var(--forge-amber)]/10 text-[10px] text-[var(--forge-amber)]">
                                            <ListTree className="h-2.5 w-2.5" /> {parentName}
                                        </span>
                                    )}
                                    {f.element && (<span className="text-[10px] text-muted-foreground">{f.element}</span>)}
                                </div>
                            )}
                            {(leaderName || (f.members?.length ?? 0) > 0) && (
                                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                    {leaderName && (<span className="inline-flex items-center gap-1"><Crown className="h-2.5 w-2.5 text-[var(--forge-amber)]" /> {leaderName}</span>)}
                                    {(f.members?.length ?? 0) > 0 && (<span className="inline-flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {f.members.length}</span>)}
                                    {(f.linkedIdeaIds?.length ?? 0) > 0 && (<span className="inline-flex items-center gap-1"><Lightbulb className="h-2.5 w-2.5 text-[var(--forge-amber)]" /> {f.linkedIdeaIds.length}</span>)}
                                    {(f.linkedSystemIds?.length ?? 0) > 0 && (<span className="inline-flex items-center gap-1"><Layers className="h-2.5 w-2.5 text-indigo-400" /> {f.linkedSystemIds.length}</span>)}
                                </div>
                            )}
                            {f.goal && (<p className="text-[11px] text-muted-foreground/90 mt-1.5 line-clamp-2 leading-relaxed">{f.goal}</p>)}
                        </>
                    )}
                </div>
            </div>
        </button>
    );
}
