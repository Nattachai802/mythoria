"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Palette, Check, GripHorizontal } from "lucide-react";

export const GROUP_COLORS = [
    { name: "Blue", value: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "#3B82F6" },
    { name: "Green", value: "#22C55E", bg: "rgba(34,197,94,0.10)", border: "#22C55E" },
    { name: "Red", value: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "#EF4444" },
    { name: "Purple", value: "#A855F7", bg: "rgba(168,85,247,0.10)", border: "#A855F7" },
    { name: "Orange", value: "#F97316", bg: "rgba(249,115,22,0.10)", border: "#F97316" },
    { name: "Cyan", value: "#06B6D4", bg: "rgba(6,182,212,0.10)", border: "#06B6D4" },
    { name: "Pink", value: "#EC4899", bg: "rgba(236,72,153,0.10)", border: "#EC4899" },
    { name: "Amber", value: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "#F59E0B" },
];

export interface CanvasGroup {
    id: string;
    type: "group";
    label: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface GroupFrameProps {
    group: CanvasGroup;
    onUpdate: (id: string, updates: Partial<CanvasGroup>) => void;
    onRemove: (id: string) => void;
}

// Get zoom from canvas DOM transform
function getCanvasZoom(): number {
    const el = document.querySelector<HTMLElement>("#canvas-area > div");
    if (!el) return 1;
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return matrix.a || 1;
}

// ─── Resize Handle ───────────────────────────────────────────────────────────
interface ResizeHandleProps {
    direction: string;
    onMouseDown: (e: React.MouseEvent, dir: string) => void;
    color: string;
}

function ResizeHandle({ direction, onMouseDown, color }: ResizeHandleProps) {
    const isCorner = direction.includes("-");
    const isHorizontal = direction === "left" || direction === "right";
    const isVertical = direction === "top" || direction === "bottom";

    const cursorMap: Record<string, string> = {
        "top-left": "nwse-resize",
        "top-right": "nesw-resize",
        "bottom-left": "nesw-resize",
        "bottom-right": "nwse-resize",
        top: "ns-resize",
        bottom: "ns-resize",
        left: "ew-resize",
        right: "ew-resize",
    };

    const posStyle: React.CSSProperties = { position: "absolute", zIndex: 20 };
    const CORNER = 14; // px size of corner handles
    const EDGE = 8;    // px thickness of edge handles
    const EDGE_INSET = 20; // leave room near corners

    if (direction === "top-left") { posStyle.top = -CORNER / 2; posStyle.left = -CORNER / 2; posStyle.width = CORNER; posStyle.height = CORNER; }
    if (direction === "top-right") { posStyle.top = -CORNER / 2; posStyle.right = -CORNER / 2; posStyle.width = CORNER; posStyle.height = CORNER; }
    if (direction === "bottom-left") { posStyle.bottom = -CORNER / 2; posStyle.left = -CORNER / 2; posStyle.width = CORNER; posStyle.height = CORNER; }
    if (direction === "bottom-right") { posStyle.bottom = -CORNER / 2; posStyle.right = -CORNER / 2; posStyle.width = CORNER; posStyle.height = CORNER; }
    if (direction === "top") { posStyle.top = -EDGE / 2; posStyle.left = EDGE_INSET; posStyle.right = EDGE_INSET; posStyle.height = EDGE; }
    if (direction === "bottom") { posStyle.bottom = -EDGE / 2; posStyle.left = EDGE_INSET; posStyle.right = EDGE_INSET; posStyle.height = EDGE; }
    if (direction === "left") { posStyle.left = -EDGE / 2; posStyle.top = EDGE_INSET; posStyle.bottom = EDGE_INSET; posStyle.width = EDGE; }
    if (direction === "right") { posStyle.right = -EDGE / 2; posStyle.top = EDGE_INSET; posStyle.bottom = EDGE_INSET; posStyle.width = EDGE; }

    return (
        <div
            style={{ ...posStyle, cursor: cursorMap[direction] }}
            className="opacity-0 group-hover/frame:opacity-100 transition-opacity"
            onMouseDown={(e) => onMouseDown(e, direction)}
        >
            {isCorner ? (
                <div
                    className="w-full h-full rounded-sm border-2 bg-white shadow-md"
                    style={{ borderColor: color }}
                />
            ) : (
                <div
                    className="w-full h-full rounded-full flex items-center justify-center"
                    style={{ backgroundColor: color, opacity: 0.7 }}
                >
                    {(isHorizontal) && <div className="w-0.5 h-3 bg-white/80 rounded-full" />}
                    {(isVertical) && <div className="h-0.5 w-3 bg-white/80 rounded-full" />}
                </div>
            )}
        </div>
    );
}

// ─── GroupFrame ───────────────────────────────────────────────────────────────
export function GroupFrame({ group, onUpdate, onRemove }: GroupFrameProps) {
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [labelText, setLabelText] = useState(group.label);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, groupX: 0, groupY: 0, groupW: 0, groupH: 0 });

    const colorConfig = GROUP_COLORS.find((c) => c.value === group.color) ?? GROUP_COLORS[0];

    // Sync label when group.label changes from outside
    useEffect(() => { setLabelText(group.label); }, [group.label]);

    // Focus input
    useEffect(() => {
        if (isEditingLabel) inputRef.current?.focus();
    }, [isEditingLabel]);

    // ── Label ──
    const submitLabel = () => {
        onUpdate(group.id, { label: labelText.trim() || "Group" });
        setIsEditingLabel(false);
    };
    const handleLabelKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === "Enter") submitLabel();
        if (e.key === "Escape") { setLabelText(group.label); setIsEditingLabel(false); }
    };

    // ── Drag (move) ──
    const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input")) return;
        e.stopPropagation();
        e.preventDefault();

        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, groupX: group.x, groupY: group.y, groupW: group.width, groupH: group.height };

        const onMove = (ev: MouseEvent) => {
            const zoom = getCanvasZoom();
            onUpdate(group.id, {
                x: Math.round(dragStartRef.current.groupX + (ev.clientX - dragStartRef.current.mouseX) / zoom),
                y: Math.round(dragStartRef.current.groupY + (ev.clientY - dragStartRef.current.mouseY) / zoom),
            });
        };
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [group.x, group.y, group.id, onUpdate]);

    // ── Resize ──
    const handleResizeMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        e.preventDefault();
        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, groupX: group.x, groupY: group.y, groupW: group.width, groupH: group.height };

        const MIN = 200;
        const onMove = (ev: MouseEvent) => {
            const zoom = getCanvasZoom();
            const dx = (ev.clientX - dragStartRef.current.mouseX) / zoom;
            const dy = (ev.clientY - dragStartRef.current.mouseY) / zoom;
            const upd: Partial<CanvasGroup> = {};

            if (direction.includes("right")) upd.width = Math.max(MIN, Math.round(dragStartRef.current.groupW + dx));
            if (direction.includes("bottom")) upd.height = Math.max(MIN, Math.round(dragStartRef.current.groupH + dy));
            if (direction.includes("left")) {
                const w = Math.max(MIN, Math.round(dragStartRef.current.groupW - dx));
                upd.width = w;
                upd.x = Math.round(dragStartRef.current.groupX + (dragStartRef.current.groupW - w));
            }
            if (direction.includes("top")) {
                const h = Math.max(MIN, Math.round(dragStartRef.current.groupH - dy));
                upd.height = h;
                upd.y = Math.round(dragStartRef.current.groupY + (dragStartRef.current.groupH - h));
            }
            onUpdate(group.id, upd);
        };
        const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }, [group.id, group.x, group.y, group.width, group.height, onUpdate]);

    return (
        <div
            data-canvas-item
            style={{
                position: "absolute",
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
                zIndex: 1,
            }}
            className="group/frame"
        >
            {/* ── Main Frame ── */}
            <div
                className="absolute inset-0 rounded-2xl"
                style={{
                    backgroundColor: colorConfig.bg,
                    border: `3px solid ${colorConfig.border}`,
                    boxShadow: `0 0 0 1px ${colorConfig.border}22, 0 4px 24px 0 ${colorConfig.border}22`,
                    borderRadius: "16px",
                }}
            />

            {/* ── Header ── */}
            <div
                className="absolute left-0 right-0 top-0 flex items-center gap-2 px-4 select-none cursor-move rounded-t-2xl"
                style={{
                    height: 52,
                    background: colorConfig.border,
                    borderRadius: "14px 14px 0 0",
                }}
                onMouseDown={handleHeaderMouseDown}
            >
                <GripHorizontal className="w-4 h-4 text-white/60 shrink-0" />

                {isEditingLabel ? (
                    <input
                        ref={inputRef}
                        value={labelText}
                        onChange={(e) => setLabelText(e.target.value)}
                        onBlur={submitLabel}
                        onKeyDown={handleLabelKeyDown}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex-1 text-2xl font-black bg-white/90 text-slate-800 rounded px-2 py-0.5 outline-none border-none min-w-0"
                    />
                ) : (
                    <span
                        className="flex-1 text-2xl font-black text-white truncate cursor-text tracking-wide"
                        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.30)' }}
                        onDoubleClick={(e) => { e.stopPropagation(); setIsEditingLabel(true); }}
                        title="Double-click to rename"
                    >
                        {group.label}
                    </span>
                )}

                {/* Color Picker */}
                <div className="relative">
                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); }}
                        className="w-5 h-5 rounded-full border-2 border-white/60 hover:border-white transition-colors shadow-sm"
                        style={{ backgroundColor: group.color }}
                        title="Change color"
                    />
                    {showColorPicker && (
                        <div
                            className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border p-2 z-[9999] animate-in fade-in zoom-in-95 duration-150"
                            style={{ width: 120 }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Color</p>
                            <div className="grid grid-cols-4 gap-1">
                                {GROUP_COLORS.map((c) => (
                                    <button
                                        key={c.value}
                                        onClick={(e) => { e.stopPropagation(); onUpdate(group.id, { color: c.value }); setShowColorPicker(false); }}
                                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center shadow-sm"
                                        style={{
                                            backgroundColor: c.value,
                                            borderColor: group.color === c.value ? "white" : "transparent",
                                            boxShadow: group.color === c.value ? `0 0 0 2px ${c.value}` : undefined,
                                        }}
                                        title={c.name}
                                    >
                                        {group.color === c.value && <Check className="w-3 h-3 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Delete */}
                <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemove(group.id); }}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors opacity-0 group-hover/frame:opacity-100"
                    title="Remove Group"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            {/* ── Watermark Label (always visible, large) ── */}
            <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
                style={{ top: 52, borderRadius: '0 0 16px 16px' }}
            >
                <span
                    className="font-black uppercase tracking-widest text-center leading-none"
                    style={{
                        color: colorConfig.border,
                        opacity: 0.18,
                        fontSize: `clamp(24px, ${Math.floor(group.width / 6)}px, 80px)`,
                        wordBreak: 'break-word',
                        maxWidth: '90%',
                        lineHeight: 1.1,
                    }}
                >
                    {group.label}
                </span>
            </div>

            {/* ── Size indicator (hover) ── */}
            <div
                className="absolute bottom-2 right-3 text-[10px] font-mono opacity-0 group-hover/frame:opacity-60 transition-opacity pointer-events-none select-none"
                style={{ color: colorConfig.border }}
            >
                {group.width}×{group.height}
            </div>

            {/* ── Resize Handles ── */}
            {(["top-left", "top-right", "bottom-left", "bottom-right", "top", "bottom", "left", "right"] as const).map((dir) => (
                <ResizeHandle key={dir} direction={dir} onMouseDown={handleResizeMouseDown} color={colorConfig.border} />
            ))}
        </div>
    );
}
