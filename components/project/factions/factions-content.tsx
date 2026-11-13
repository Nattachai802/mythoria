"use client";

import Link from "next/link";

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
import { Plus, Shield, X, Trash2, Users, Crown, Link2, LayoutGrid, ListTree, ChevronRight, Settings2, Pencil, Lightbulb, Layers, Share2 } from "lucide-react";
import { activeIn, relActiveIn, statusAt, findDefections, findFactionIssues, type MembershipLike, type StatusPoint } from "@/lib/faction-checks";
import { FactionMap } from "./faction-map";
import { FactionChecksPanel } from "./faction-checks-panel";
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
    splitFactionRelationship, updateFactionRelationshipRange, updateFactionStatusTimeline,
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
    chapters?: { id: string; title: string; orderIndex: number }[];
}

const EMPTY_FORM = {
    name: "", type: "", description: "", color: "#c2703d",
    status: "active", alignment: "", goal: "", element: "",
    leaderId: "", parentFactionId: "", linkedIdeaIds: [] as string[], linkedSystemIds: [] as string[],
};

export function FactionsContent({ novelId, initialFactions, initialRelationships, characters, initialStatusPresets, ideas, systems, chapters = [] }: Props) {
    const [factions, setFactions] = useState<Faction[]>(initialFactions);
    const [rels, setRels] = useState<FactionRel[]>(initialRelationships);
    const [view, setView] = useState<"status" | "map">("status");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mapSel, setMapSel] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [dragId, setDragId] = useState<string | null>(null);

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

    // ฝ่าย ณ บท: แสดงเฉพาะสมาชิกที่ยังอยู่ในบทที่เลือก — state factions เดิมไม่ถูกแตะ (แก้/ลากทำบน factions)
    const [chapterId, setChapterId] = useState("all");
    const chapterOrder = useMemo(() => new Map(chapters.map((c) => [c.id, c.orderIndex])), [chapters]);
    const selOrder = chapterId === "all" ? null : chapterOrder.get(chapterId) ?? null;
    const visible = useMemo<Faction[]>(
        () => selOrder === null ? factions
            : factions.map((f) => ({ ...f, members: (f.members ?? []).filter((m: MembershipLike) => activeIn(m, chapterOrder, selOrder)) })),
        [factions, chapterOrder, selOrder],
    );
    const visibleRels = useMemo(() => rels.filter((r) => relActiveIn(r, chapterOrder, selOrder)), [rels, chapterOrder, selOrder]);
    const allMemberships = useMemo<MembershipLike[]>(
        () => factions.flatMap((f) => (f.members ?? []).map((m: MembershipLike) => ({ ...m, factionId: f.id }))),
        [factions],
    );
    // คนย้ายฝ่าย: ทุกบท = ทั้งหมด · เลือกบท = ที่เกิดภายใน ±2 บท
    const defections = useMemo(
        () => findDefections(allMemberships, chapterOrder).filter((d) => selOrder === null || Math.abs(d.atOrder - selOrder) <= 2),
        [allMemberships, chapterOrder, selOrder],
    );
    const sortedChapters = useMemo(() => [...chapters].sort((a, b) => a.orderIndex - b.orderIndex), [chapters]);

    const issues = useMemo(() => findFactionIssues({
        factions,
        memberships: allMemberships,
        rels,
        chapterOrder,
    }), [factions, allMemberships, rels, chapterOrder]);

    const selected = useMemo(
        () => visible.find((f) => f.id === selectedId) ?? null,
        [visible, selectedId],
    );

    const byStatus = useMemo(() => {
        const m: Record<string, Faction[]> = {};
        for (const s of statusPresets) m[s.key] = [];
        const other: Faction[] = [];
        for (const f of visible) {
            const st = statusAt(f, chapterOrder, selOrder);
            const preset = statusPresets.find(p => p.key === st);
            (preset ? m[preset.key] : other).push(f);
        }
        return { m, other };
    }, [visible, statusPresets, chapterOrder, selOrder]);

    const childrenOf = (pid: string | null) =>
        visible.filter((f) => (f.parentFactionId ?? null) === pid);

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
    const openById = (id: string) => { const f = factions.find((x) => x.id === id); if (f) openInspector(f); };
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
            startChapterId: chapterId === "all" ? null : chapterId, // เลือกบทอยู่ = เริ่มมีผลตั้งแต่บทนั้น
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

    const handleRelRange = async (relId: string, data: { startChapterId?: string | null; endChapterId?: string | null }) => {
        setRels((p) => p.map((r) => (r.id === relId ? { ...r, ...data } : r)));
        const res = await updateFactionRelationshipRange(relId, novelId, data);
        if (!res.success) toast.error(res.error || "แก้ช่วงบทไม่สำเร็จ");
    };
    const handleSplitRel = async (relId: string, fromChapterId: string, newType: string) => {
        const i = sortedChapters.findIndex((c) => c.id === fromChapterId);
        const prev = i > 0 ? sortedChapters[i - 1].id : null;
        const res = await splitFactionRelationship(relId, novelId, fromChapterId, prev, newType);
        if (!res.success || !res.data) { toast.error(res.error || "เปลี่ยนไม่สำเร็จ"); return; }
        const { created, updated, removedId } = res.data;
        setRels((p) => [...p.filter((r) => r.id !== removedId).map((r) => (updated && r.id === updated.id ? { ...r, ...updated } : r)), created]);
        toast.success(`เปลี่ยนเป็น ${REL_TYPES[newType] ?? newType} ตั้งแต่บทนี้แล้ว`);
    };
    const handleStatusTimeline = async (factionId: string, timeline: StatusPoint[]) => {
        setFactions((p) => p.map((f) => (f.id === factionId ? { ...f, statusTimeline: timeline } : f)));
        const res = await updateFactionStatusTimeline(factionId, timeline);
        if (!res.success) toast.error(res.error || "บันทึกไทม์ไลน์ไม่สำเร็จ");
    };

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
                            <span className="text-sm text-muted-foreground tabular-nums">
                                <span className="text-base font-bold text-[var(--forge-amber)] mr-1 align-middle">{String(factions.length).padStart(2, "0")}</span>ฝ่าย
                            </span>
                            {/* View toggle */}
                            <div className="inline-flex rounded-md border border-border p-0.5">
                                <ViewBtn active={view === "status"} onClick={() => setView("status")} icon={<LayoutGrid className="h-3 w-3" />} label="สถานะ" />
                                <ViewBtn active={view === "map"} onClick={() => setView("map")} icon={<Share2 className="h-3 w-3" />} label="แผนที่" />
                            </div>
                            {/* Preset manager toggle */}
                            {view === "status" && (
                                <button
                                    onClick={() => setShowPresetManager(v => !v)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors cursor-pointer",
                                        showPresetManager ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
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

                    {sortedChapters.length > 0 && (
                        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-steel-800/60">
                            <span className="text-sm text-muted-foreground shrink-0">ดู ณ บท</span>
                            <input type="range" min={0} max={sortedChapters.length} step={1} aria-label="ดูฝ่าย ณ บท"
                                value={chapterId === "all" ? 0 : sortedChapters.findIndex((c) => c.id === chapterId) + 1}
                                onChange={(e) => { const i = Number(e.target.value); setChapterId(i === 0 ? "all" : sortedChapters[i - 1].id); }}
                                className="flex-1 h-1 accent-[var(--forge-amber)] cursor-pointer" />
                            <span className={cn("text-sm tabular-nums shrink-0 min-w-[9rem] text-right truncate", chapterId === "all" ? "text-muted-foreground" : "text-foreground font-medium")}>
                                {chapterId === "all" ? "ทุกบท" : (() => { const c = sortedChapters.find((x) => x.id === chapterId); return c ? `บท ${c.orderIndex} · ${c.title}` : "—"; })()}
                            </span>
                            {chapterId !== "all" && (
                                <button type="button" onClick={() => setChapterId("all")} aria-label="ดูทุกบท" className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                            )}
                        </div>
                    )}
                    <FactionChecksPanel issues={issues} novelId={novelId} onSelect={openById}
                        factionName={(id) => nameById(id) ?? "—"} characterName={(id) => charName(id) ?? "—"} />

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
                        <div className="flex-1 overflow-y-auto px-6 py-2">
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
                        <div className="flex-1 overflow-y-auto">
                            <FactionMap factions={visible} rels={visibleRels} defections={defections} charName={(id: string) => charName(id) ?? "—"}
                                statusOf={(f) => { const k = statusAt(f, chapterOrder, selOrder); const p = statusPresets.find((x) => x.key === k); return p ? { key: p.key, label: p.label, color: p.color } : null; }}
                                selectedId={mapSel} onSelect={setMapSel} onOpen={openById} />
                        </div>
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
                                    {sortedChapters.length > 0 && (
                                        <StatusTimelineEditor
                                            base={selected.status} timeline={Array.isArray(selected.statusTimeline) ? selected.statusTimeline : []}
                                            chapters={sortedChapters} presets={statusPresets}
                                            onChange={(t) => handleStatusTimeline(selected.id, t)} />
                                    )}
                                    <div>
                                        <div className="flex items-center gap-1.5 font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
                                            <Users className="h-3 w-3" /> สมาชิก ({selected.members?.length ?? 0})
                                        </div>
                                        {selected.members?.length ? (
                                            <div className="space-y-1">
                                                {selected.members.map((m: any) => (
                                                    <Link key={m.id} href={`/dashboard/project/${novelId}/characters/${m.characterId}`}
                                                        className={cn("flex items-center justify-between text-xs px-2.5 py-1.5 chamfered-sm bg-steel-800/40 hover:bg-steel-800/70 transition-colors duration-200",
                                                            selected.leaderId === m.characterId && "ring-1 ring-[var(--forge-gold)]")}>
                                                        <span>{m.character?.name ?? "—"}{selected.leaderId === m.characterId && <span className="ml-1.5 text-[var(--forge-gold)]">ผู้นำ</span>}</span>
                                                        {m.role && <span className="text-muted-foreground">{m.role}</span>}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-muted-foreground">เพิ่มสมาชิกได้ที่หน้าตัวละคร ส่วน “สังกัด” ในแท็บความสัมพันธ์</p>
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
                                                    <RelRow key={r.id} rel={r} outgoing={outgoing} otherName={otherName ?? "—"} chapters={sortedChapters}
                                                        dim={!relActiveIn(r, chapterOrder, selOrder)}
                                                        onDelete={() => handleDeleteRel(r.id)}
                                                        onRange={(d) => handleRelRange(r.id, d)}
                                                        onSplit={(from, t) => handleSplitRel(r.id, from, t)} />
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
                        <FactionCard f={dragFaction} active compact onClick={() => {}} parentName={null} leaderName={charName(dragFaction.leaderId)} />
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
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors duration-150 cursor-pointer",
                "active:scale-95 motion-reduce:transform-none",
                active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
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
/** แถวสถานะ: ป้ายซ้าย + ชิปฝ่ายไหลขวา · ลากชิปข้ามแถว = เปลี่ยนสถานะ */
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
    const { setNodeRef, isOver } = useDroppable({ id: statusKey ? `status:${statusKey}` : "status:none", disabled: !statusKey });
    return (
        <section ref={setNodeRef}
            className={cn("grid grid-cols-[9rem_minmax(0,1fr)] gap-4 py-4 border-b border-border/60 last:border-b-0 transition-colors", isOver && "bg-[var(--forge-amber)]/10")}>
            <div className="flex items-center gap-2 text-sm pt-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                <span className="truncate font-medium">{meta.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{factions.length}</span>
            </div>
            <div className="flex flex-wrap items-start gap-2 min-h-9">
                {factions.length ? (() => {
                    // กลุ่มย่อยที่อยู่แถวเดียวกับแม่ = ซ้อนอยู่ในการ์ดแม่ · แม่อยู่แถวอื่น = การ์ดเดี่ยวพร้อม ↳ ชื่อแม่
                    const here = new Set(factions.map((f) => f.id));
                    const kidsOf = (id: string) => factions.filter((x) => x.parentFactionId === id);
                    return factions.filter((f) => !f.parentFactionId || !here.has(f.parentFactionId)).map((f) => (
                        <div key={f.id} className={cn("rounded-md border bg-card transition-colors", f.id === selectedId ? "border-[var(--forge-amber)]" : "border-border hover:border-foreground/30")}>
                            <StatusChip f={f} onClick={() => onSelect(f)} leaderName={charName(f.leaderId)}
                                parentName={f.parentFactionId ? nameById(f.parentFactionId) : null} />
                            {kidsOf(f.id).length > 0 && (
                                <div className="flex flex-wrap gap-1 px-2 pb-2 -mt-0.5">
                                    {kidsOf(f.id).map((k) => <StatusChip key={k.id} f={k} sub active={k.id === selectedId} onClick={() => onSelect(k)} />)}
                                </div>
                            )}
                        </div>
                    ));
                })() : <span className="text-xs text-muted-foreground/60 self-center">{statusKey ? "ลากฝ่ายมาวางที่นี่" : "ว่าง"}</span>}
            </div>
        </section>
    );
}

function StatusChip({ f, onClick, parentName, leaderName, sub, active }: {
    f: Faction; onClick: () => void; parentName?: string | null; leaderName?: string | null; sub?: boolean; active?: boolean;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: f.id });
    const n = f.members?.length ?? 0;
    const meta = [parentName && `ใต้ ${parentName}`, n > 0 && `${n} คน`, leaderName].filter(Boolean).join(" · ");
    return (
        <button ref={setNodeRef} {...listeners} {...attributes} type="button" onClick={onClick}
            className={cn("inline-flex items-center gap-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-amber)]/50 rounded",
                sub ? cn("px-2 py-0.5 text-xs bg-muted/60 hover:bg-muted", active && "ring-1 ring-[var(--forge-amber)]") : "px-3 py-2 text-sm",
                isDragging && "opacity-40")}>
            {f.color && <span className={cn("rounded-full shrink-0", sub ? "h-1.5 w-1.5" : "h-2.5 w-2.5")} style={{ background: f.color }} />}
            <span className={sub ? "" : "font-medium"}>{f.name}</span>
            {!sub && meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        </button>
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

const ChapterPick = ({ value, chapters, empty, label, onChange }: {
    value: string | null | undefined; chapters: { id: string; title: string; orderIndex: number }[]; empty: string; label: string; onChange: (v: string | null) => void;
}) => (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        className={cn("bg-transparent border-b border-transparent hover:border-steel-700 focus:border-[var(--forge-amber)] outline-none max-w-[6.5rem] cursor-pointer", !value && "text-muted-foreground")}>
        <option value="">{empty}</option>
        {chapters.map((c) => <option key={c.id} value={c.id}>{c.orderIndex}. {c.title}</option>)}
    </select>
);

/** แถวความสัมพันธ์ฝ่าย: ช่วงบท + "เปลี่ยนตั้งแต่บท…" (ปิดแถวเดิม สร้างแถวใหม่) */
function RelRow({ rel, outgoing, otherName, chapters, dim, onDelete, onRange, onSplit }: {
    rel: FactionRel; outgoing: boolean; otherName: string; chapters: { id: string; title: string; orderIndex: number }[]; dim: boolean;
    onDelete: () => void; onRange: (d: { startChapterId?: string | null; endChapterId?: string | null }) => void; onSplit: (fromChapterId: string, type: string) => void;
}) {
    const [splitting, setSplitting] = useState(false);
    const [from, setFrom] = useState("");
    const [type, setType] = useState(rel.type === "enemy" ? "ally" : "enemy");
    const label = REL_TYPES[rel.type] ?? rel.type;
    return (
        <div className={cn("text-xs px-2.5 py-1.5 chamfered-sm bg-steel-800/40 transition-opacity", dim && "opacity-45")}>
            <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                    <span className="text-[var(--forge-amber)]">{outgoing ? "" : "← "}{label}{outgoing ? " →" : ""}</span>{" "}{otherName}
                    {dim && <span className="ml-1.5 text-muted-foreground">(ไม่มีผลในบทนี้)</span>}
                </span>
                <span className="flex items-center shrink-0">
                    {chapters.length > 0 && (
                        <button type="button" onClick={() => setSplitting((v) => !v)} className="px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">เปลี่ยนตั้งแต่บท…</button>
                    )}
                    <button onClick={onDelete} aria-label={`ลบความสัมพันธ์ ${label} กับ ${otherName}`}
                        className="h-6 w-6 -mr-1 inline-flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </span>
            </div>
            {chapters.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                    บท
                    <ChapterPick label="บทเริ่ม" value={rel.startChapterId} chapters={chapters} empty="แรก" onChange={(v) => onRange({ startChapterId: v })} />
                    –
                    <ChapterPick label="บทจบ" value={rel.endChapterId} chapters={chapters} empty="ปัจจุบัน" onChange={(v) => onRange({ endChapterId: v })} />
                </div>
            )}
            {splitting && (
                <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-steel-800/60 text-[11px] animate-in fade-in duration-150 motion-reduce:animate-none">
                    ตั้งแต่บท
                    <ChapterPick label="เปลี่ยนตั้งแต่บท" value={from} chapters={chapters} empty="เลือก" onChange={(v) => setFrom(v ?? "")} />
                    เป็น
                    <select aria-label="ชนิดใหม่" value={type} onChange={(e) => setType(e.target.value)} className="bg-transparent border-b border-steel-700 outline-none cursor-pointer">
                        {Object.entries(REL_TYPES).filter(([k]) => k !== rel.type).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button type="button" disabled={!from} onClick={() => { onSplit(from, type); setSplitting(false); }}
                        className="ml-auto chamfered-sm bg-[var(--forge-amber)] text-black px-2 py-0.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">ตกลง</button>
                </div>
            )}
        </div>
    );
}

/** ไทม์ไลน์สถานะ: สถานะตั้งต้น + จุดเปลี่ยนตามบท */
function StatusTimelineEditor({ base, timeline, chapters, presets, onChange }: {
    base: string | null; timeline: StatusPoint[]; chapters: { id: string; title: string; orderIndex: number }[];
    presets: FactionStatusPreset[]; onChange: (t: StatusPoint[]) => void;
}) {
    const order = new Map(chapters.map((c) => [c.id, c.orderIndex]));
    const sorted = [...timeline].sort((a, b) => (order.get(a.chapterId) ?? 0) - (order.get(b.chapterId) ?? 0));
    const labelOf = (k: string | null) => presets.find((p) => p.key === k)?.label ?? k ?? "—";
    const colorOf = (k: string | null) => presets.find((p) => p.key === k)?.color ?? "#475569";
    const used = new Set(timeline.map((t) => t.chapterId));
    const nextFree = chapters.find((c) => !used.has(c.id));
    return (
        <div>
            <div className="flex items-center justify-between font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
                <span>ไทม์ไลน์สถานะ</span>
                {nextFree && (
                    <button type="button" onClick={() => onChange([...timeline, { chapterId: nextFree.id, status: presets[0]?.key ?? "active" }])}
                        className="normal-case tracking-normal text-[11px] hover:text-foreground cursor-pointer">+ เปลี่ยนสถานะที่บท…</button>
                )}
            </div>
            <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 px-2.5 py-1 chamfered-sm bg-steel-800/40">
                    <span className="w-2 h-2" style={{ background: colorOf(base) }} aria-hidden />
                    <span className="text-muted-foreground w-20">ตั้งต้น</span>{labelOf(base)}
                </div>
                {sorted.map((t) => (
                    <div key={t.chapterId} className="flex items-center gap-2 px-2.5 py-1 chamfered-sm bg-steel-800/40">
                        <span className="w-2 h-2" style={{ background: colorOf(t.status) }} aria-hidden />
                        <span className="w-20">
                            <ChapterPick label="บทที่เปลี่ยน" value={t.chapterId} chapters={chapters.filter((c) => c.id === t.chapterId || !used.has(c.id))} empty="—"
                                onChange={(v) => v && onChange(timeline.map((x) => (x.chapterId === t.chapterId ? { ...x, chapterId: v } : x)))} />
                        </span>
                        <select aria-label="สถานะ" value={t.status} onChange={(e) => onChange(timeline.map((x) => (x.chapterId === t.chapterId ? { ...x, status: e.target.value } : x)))}
                            className="flex-1 bg-transparent outline-none cursor-pointer">
                            {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </select>
                        <button type="button" aria-label="ลบจุดนี้" onClick={() => onChange(timeline.filter((x) => x.chapterId !== t.chapterId))}
                            className="text-muted-foreground hover:text-red-500 cursor-pointer"><X className="h-3 w-3" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}
