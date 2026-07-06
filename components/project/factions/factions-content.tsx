"use client";

import { useState, useMemo } from "react";
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
import { Plus, Shield, X, Trash2, Users, Crown, Link2, LayoutGrid, ListTree, ChevronRight } from "lucide-react";
import {
    createFaction, updateFaction, deleteFaction,
    createFactionRelationship, deleteFactionRelationship,
} from "@/server/factions";

// ── vocab (Thai labels) — สีดึงจาก steel/forge + semantic เดิมของแอป (ไม่มี hex ดิบ) ──
const STATUS_META: Record<string, { label: string; dot: string }> = {
    active: { label: "ยังปฏิบัติการ", dot: "bg-emerald-500" },
    allied_gov: { label: "ร่วมกับรัฐ", dot: "bg-[var(--forge-amber)]" },
    defected: { label: "ย้ายฝั่ง", dot: "bg-red-500" },
    neutral: { label: "ไม่สังกัดฝ่าย", dot: "bg-steel-400" },
    disbanded: { label: "สาบสูญ/ยุบ", dot: "bg-steel-600" },
};
const STATUS_ORDER = ["active", "allied_gov", "defected", "neutral", "disbanded"];

const ALIGNMENT_META: Record<string, { label: string; cls: string }> = {
    good: { label: "ฝ่ายดี", cls: "text-emerald-500 border-emerald-500/40" },
    neutral: { label: "เป็นกลาง", cls: "text-steel-400 border-steel-400/40" },
    gray: { label: "สีเทา", cls: "text-[var(--forge-amber)] border-[var(--forge-amber)]/40" },
    evil: { label: "ฝ่ายร้าย", cls: "text-red-500 border-red-500/40" },
};

const REL_TYPES: Record<string, string> = {
    ally: "พันธมิตร", enemy: "ศัตรู", rival: "คู่แข่ง",
    subsidiary: "ขึ้นตรงต่อ", splinter: "แตกออกมาจาก", neutral: "เป็นกลาง",
};

type Faction = any;
type FactionRel = any;
type Character = { id: string; name: string; image?: string | null };

interface Props {
    novelId: string;
    initialFactions: Faction[];
    initialRelationships: FactionRel[];
    characters: Character[];
}

const EMPTY_FORM = {
    name: "", type: "", description: "", color: "#c2703d",
    status: "active", alignment: "", goal: "", element: "",
    leaderId: "", parentFactionId: "",
};

export function FactionsContent({ novelId, initialFactions, initialRelationships, characters }: Props) {
    const [factions, setFactions] = useState<Faction[]>(initialFactions);
    const [rels, setRels] = useState<FactionRel[]>(initialRelationships);
    const [view, setView] = useState<"status" | "tree">("status");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [dragId, setDragId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
        for (const s of STATUS_ORDER) m[s] = [];
        const other: Faction[] = [];
        for (const f of factions) {
            const key = f.status && m[f.status] ? f.status : null;
            (key ? m[key] : other).push(f);
        }
        return { m, other };
    }, [factions]);

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

    // ── open forms ──
    const openCreate = () => { setForm({ ...EMPTY_FORM }); setIsCreating(true); setSelectedId(null); };
    const openInspector = (f: Faction) => {
        setIsCreating(false);
        setSelectedId(f.id);
        setForm({
            name: f.name ?? "", type: f.type ?? "", description: f.description ?? "",
            color: f.color ?? "#c2703d", status: f.status ?? "active",
            alignment: f.alignment ?? "", goal: f.goal ?? "", element: f.element ?? "",
            leaderId: f.leaderId ?? "", parentFactionId: f.parentFactionId ?? "",
        });
    };
    const closePanel = () => { setSelectedId(null); setIsCreating(false); };

    const patchLocal = (id: string, patch: Record<string, unknown>) =>
        setFactions((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));

    // ── save (create or update) ──
    const handleSave = async () => {
        if (!form.name.trim()) { toast.error("ใส่ชื่อฝ่ายก่อนนะครับ"); return; }
        setSaving(true);
        const payload = {
            name: form.name.trim(), type: form.type || undefined, description: form.description || undefined,
            color: form.color, status: form.status || undefined, alignment: form.alignment || undefined,
            goal: form.goal || undefined, element: form.element || undefined,
            leaderId: form.leaderId || null, parentFactionId: form.parentFactionId || null,
        };
        try {
            if (isCreating) {
                const res = await createFaction({ ...payload, novelId });
                if (res.success && res.data) {
                    setFactions((p) => [...p, { ...res.data, members: [] }]);
                    setSelectedId(res.data.id); setIsCreating(false);
                    toast.success("สร้างฝ่ายแล้ว");
                } else toast.error(res.error || "สร้างไม่สำเร็จ");
            } else if (selectedId) {
                const res = await updateFaction(selectedId, payload);
                if (res.success && res.data) { patchLocal(selectedId, res.data); toast.success("บันทึกแล้ว"); }
                else toast.error(res.error || "บันทึกไม่สำเร็จ");
            }
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!selectedId) return;
        if (!confirm("ลบฝ่ายนี้? สมาชิก/ความสัมพันธ์ที่ผูกไว้จะถูกลบด้วย (ฝ่ายย่อยจะเลื่อนขึ้นบนสุด)")) return;
        const res = await deleteFaction(selectedId);
        if (res.success) {
            // ฝ่ายลูกที่ชี้มาที่ตัวนี้ → เลื่อนขึ้น root (parent = null) ให้ตรงกับ DB (onDelete set null)
            setFactions((p) => p
                .filter((f) => f.id !== selectedId)
                .map((f) => (f.parentFactionId === selectedId ? { ...f, parentFactionId: null } : f)));
            setRels((p) => p.filter((r) => r.sourceFactionId !== selectedId && r.targetFactionId !== selectedId));
            closePanel(); toast.success("ลบแล้ว");
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
        if (res.success) toast.success(`ย้ายไป "${STATUS_META[status]?.label ?? status}"`);
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

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="h-full flex relative">
                {/* Board */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">
                    <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-steel-800/60">
                        <div className="flex items-center gap-3">
                            <span className="font-technical text-[10px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
                                {factions.length} ฝ่าย
                            </span>
                            {/* View toggle */}
                            <div className="inline-flex chamfered-sm border border-steel-800 p-0.5">
                                <ViewBtn active={view === "status"} onClick={() => setView("status")} icon={<LayoutGrid className="h-3 w-3" />} label="สถานะ" />
                                <ViewBtn active={view === "tree"} onClick={() => setView("tree")} icon={<ListTree className="h-3 w-3" />} label="ลำดับชั้น" />
                            </div>
                        </div>
                        <Button size="sm" className="h-8 gap-1.5 text-xs chamfered-sm" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5" /> เพิ่มฝ่าย
                        </Button>
                    </div>

                    {factions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                            <Shield className="w-10 h-10 text-steel-600" strokeWidth={1.5} />
                            <p className="text-sm">ยังไม่มีฝ่าย — กด <span className="text-[var(--forge-amber)] font-medium">เพิ่มฝ่าย</span> เพื่อเริ่มวางองค์กรในโลกของคุณ</p>
                        </div>
                    ) : view === "status" ? (
                        <div className="flex-1 flex gap-5 p-6 min-w-max overflow-y-hidden">
                            {STATUS_ORDER.map((s) => (
                                <StatusColumn key={s} statusKey={s} meta={STATUS_META[s]} factions={byStatus.m[s]}
                                    selectedId={selectedId} onSelect={openInspector} nameById={nameById} charName={charName} />
                            ))}
                            {byStatus.other.length > 0 && (
                                <StatusColumn statusKey={null} meta={{ label: "ไม่ระบุสถานะ", dot: "bg-steel-600" }} factions={byStatus.other}
                                    selectedId={selectedId} onSelect={openInspector} nameById={nameById} charName={charName} />
                            )}
                        </div>
                    ) : (
                        <TreeView roots={roots} childrenOf={childrenOf} collapsed={collapsed} onToggle={toggleCollapse}
                            selectedId={selectedId} onSelect={openInspector} nameById={nameById} charName={charName} />
                    )}
                </div>

                {/* Backdrop (mobile only) */}
                {panelOpen && (
                    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-30 md:hidden" onClick={closePanel} aria-hidden="true" />
                )}

                {/* Inspector / editor panel */}
                {panelOpen && (
                    <div className={cn(
                        "flex flex-col h-full noise-texture-strong border-l border-steel-800 bg-card",
                        "fixed inset-y-0 right-0 z-40 w-full max-w-[380px] shadow-2xl shadow-black/40",
                        "md:static md:z-auto md:w-[360px] md:shadow-none md:bg-card/40 md:max-w-none shrink-0",
                    )}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-steel-800 shrink-0">
                            <span className="font-technical text-[10px] uppercase tracking-[0.14em] text-[var(--forge-amber)]">
                                {isCreating ? "สร้างฝ่ายใหม่" : "แก้ไขฝ่าย"}
                            </span>
                            <button onClick={closePanel} aria-label="ปิดแผงแก้ไข"
                                className="h-7 w-7 inline-flex items-center justify-center chamfered-sm text-muted-foreground hover:text-foreground hover:bg-steel-800 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <Field label="ชื่อ *">
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="เช่น กปธ. / ตระกูลอัคนีศวร" className="h-8 text-sm border-steel-800" />
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
                                            {STATUS_ORDER.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span className={cn("h-2 w-2 rounded-full", STATUS_META[s].dot)} />
                                                        {STATUS_META[s].label}
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
                                <Field label="ธาตุ/มิติ">
                                    <Input value={form.element} onChange={(e) => setForm({ ...form, element: e.target.value })}
                                        placeholder="ไฟ-ทำลาย" className="h-8 text-sm border-steel-800" />
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

                            <div className="flex gap-2 pt-1">
                                <Button onClick={handleSave} disabled={saving} size="sm" variant="forge" className="flex-1 h-8 text-xs chamfered-sm">
                                    {isCreating ? "สร้าง" : "บันทึก"}
                                </Button>
                                {!isCreating && (
                                    <Button onClick={handleDelete} variant="outline" size="sm" aria-label="ลบฝ่ายนี้"
                                        className="h-8 text-xs text-red-500 hover:text-red-400 border-red-500/30 hover:bg-red-500/10 chamfered-sm">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
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
                        </div>
                    </div>
                )}
            </div>

            <DragOverlay>
                {dragFaction ? (
                    <div className="opacity-90 rotate-1">
                        <FactionCard f={dragFaction} active onClick={() => {}} parentName={null} leaderName={charName(dragFaction.leaderId)} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1 px-2 py-1 chamfered-sm font-technical text-[10px] uppercase tracking-wide transition-colors",
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
    meta: { label: string; dot: string };
    factions: Faction[];
    selectedId: string | null;
    onSelect: (f: Faction) => void;
    nameById: (id: string | null) => string | null;
    charName: (id: string | null) => string | null;
}) {
    // เฉพาะคอลัมน์ที่มี status จริงเท่านั้นที่รับ drop (คอลัมน์ "ไม่ระบุ" ไม่รับ)
    const { setNodeRef, isOver } = useDroppable({ id: statusKey ? `status:${statusKey}` : "status:none", disabled: !statusKey });
    return (
        <div ref={setNodeRef} className={cn("w-64 shrink-0 flex flex-col h-full chamfered-sm transition-colors", isOver && "bg-[var(--forge-amber)]/5 ring-1 ring-[var(--forge-amber)]/40")}>
            <div className="flex items-center gap-2 mb-3 px-1 pt-1">
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                <span className="font-technical text-[10px] uppercase tracking-[0.14em] text-foreground">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">{factions.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2.5 px-1 pb-1">
                {factions.map((f) => (
                    <DraggableCard key={f.id} f={f} active={f.id === selectedId} onClick={() => onSelect(f)}
                        parentName={nameById(f.parentFactionId)} leaderName={charName(f.leaderId)} />
                ))}
                {factions.length === 0 && (
                    <div className="h-16 grid place-items-center chamfered-sm border border-dashed border-steel-800/60">
                        <span className="text-[11px] text-muted-foreground/50">{statusKey ? "ลากฝ่ายมาวางที่นี่" : "ว่าง"}</span>
                    </div>
                )}
            </div>
        </div>
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
    const render = (f: Faction, depth: number): React.ReactNode => {
        const kids = childrenOf(f.id);
        const isCollapsed = collapsed.has(f.id);
        return (
            <div key={f.id}>
                <TreeNode f={f} depth={depth} hasKids={kids.length > 0} isCollapsed={isCollapsed}
                    onToggle={() => onToggle(f.id)} active={f.id === selectedId} onSelect={() => onSelect(f)}
                    parentName={nameById(f.parentFactionId)} leaderName={charName(f.leaderId)} />
                {!isCollapsed && kids.map((k) => render(k, depth + 1))}
            </div>
        );
    };
    return (
        <div ref={rootDrop.setNodeRef}
            className={cn("flex-1 overflow-y-auto p-6 space-y-1.5 max-w-3xl w-full transition-colors", rootDrop.isOver && "bg-[var(--forge-amber)]/5")}>
            <p className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-3">
                ลากการ์ดวางบนอีกฝ่ายเพื่อจัดลำดับชั้น · วางบนพื้นที่ว่างเพื่อย้ายขึ้นบนสุด
            </p>
            {roots.map((f) => render(f, 0))}
        </div>
    );
}

function TreeNode({
    f, depth, hasKids, isCollapsed, onToggle, active, onSelect, parentName, leaderName,
}: {
    f: Faction; depth: number; hasKids: boolean; isCollapsed: boolean; onToggle: () => void;
    active: boolean; onSelect: () => void; parentName: string | null; leaderName: string | null;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `parent:${f.id}` });
    return (
        <div ref={setNodeRef} style={{ marginLeft: depth * 22 }}
            className={cn("chamfered-sm transition-colors", isOver && "ring-1 ring-[var(--forge-amber)] bg-[var(--forge-amber)]/10")}>
            <div className="flex items-center gap-1">
                {hasKids ? (
                    <button onClick={onToggle} aria-label={isCollapsed ? "ขยาย" : "ยุบ"}
                        className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !isCollapsed && "rotate-90")} />
                    </button>
                ) : <span className="w-6 shrink-0" />}
                <div className="flex-1 min-w-0">
                    <DraggableCard f={f} active={active} onClick={onSelect} parentName={depth === 0 ? parentName : null} leaderName={leaderName} compact />
                </div>
            </div>
        </div>
    );
}

// ── Draggable wrapper around a card ──
function DraggableCard(props: { f: Faction; active: boolean; onClick: () => void; parentName: string | null; leaderName: string | null; compact?: boolean }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.f.id });
    return (
        <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-40")}>
            <FactionCard {...props} />
        </div>
    );
}

function FactionCard({
    f, active, onClick, parentName, leaderName, compact,
}: {
    f: Faction; active: boolean; onClick: () => void;
    parentName: string | null; leaderName: string | null; compact?: boolean;
}) {
    const align = f.alignment ? ALIGNMENT_META[f.alignment] : null;
    return (
        <button onClick={onClick}
            className={cn(
                "w-full text-left chamfered-sm border bg-card/50 transition-all duration-200 group",
                compact ? "p-2.5" : "p-3",
                "hover:bg-accent hover:shadow-md hover:shadow-black/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-amber)]/50",
                active ? "border-[var(--forge-amber)] bg-accent" : "border-steel-800",
            )}
        >
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 chamfered-sm shrink-0" style={{ background: f.color ?? "#c2703d" }} aria-hidden="true" />
                <span className="font-display font-semibold text-sm truncate flex-1">{f.name}</span>
                {f.type && <span className="font-technical text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">{f.type}</span>}
            </div>
            {parentName && (<div className="text-[10px] text-muted-foreground mt-1 pl-[18px]">↳ ใต้ {parentName}</div>)}
            {!compact && (
                <>
                    <div className="flex items-center gap-2 mt-2 flex-wrap pl-[18px]">
                        {align && (<span className={cn("font-technical text-[9px] uppercase tracking-wide px-1.5 py-0.5 chamfered-sm border", align.cls)}>{align.label}</span>)}
                        {f.element && (<span className="text-[10px] text-muted-foreground">{f.element}</span>)}
                        {leaderName && (<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Crown className="h-2.5 w-2.5 text-[var(--forge-amber)]" /> {leaderName}</span>)}
                        {(f.members?.length ?? 0) > 0 && (<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Users className="h-2.5 w-2.5" /> {f.members.length}</span>)}
                    </div>
                    {f.goal && (<p className="text-[11px] text-muted-foreground/90 mt-2 line-clamp-2 pl-[18px] leading-relaxed">{f.goal}</p>)}
                </>
            )}
            {compact && align && (
                <span className="inline-flex mt-1 ml-[18px] items-center">
                    <span className={cn("font-technical text-[9px] uppercase tracking-wide px-1.5 py-0.5 chamfered-sm border", align.cls)}>{align.label}</span>
                </span>
            )}
        </button>
    );
}
