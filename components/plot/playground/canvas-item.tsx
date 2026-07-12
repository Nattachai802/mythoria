"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Lightbulb, X, Link as LinkIcon, Pencil, StickyNote, Minimize2, ExternalLink, Copy, GitBranchPlus, Shield, Plus, Palette, Check, MoreVertical, Loader2, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ป้ายสีจัดกลุ่มการ์ด (reuse palette เดียวกับ Story Arc)
const CARD_COLORS = ["#f59e0b", "#fb923c", "#f43f5e", "#a78bfa", "#6366f1", "#22d3ee", "#34d399", "#facc15", "#e879f9", "#94a3b8"];
import { useCallback, useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SceneElementDetails } from "@/db/schema";
import Link from "next/link";
import { toast } from "sonner";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SceneParticipantsPanel } from "./scene-participants-panel";

// For items already on the canvas (moveable)
export function DraggableCanvasItem({
  item,
  onRemove,
  onRemoveChild,
  onLinkStart,
  onLinkComplete,
  isLinkingSource,
  elementDetails,
  onEditChild,
  ideaNotes,
  onAddNote,
  onQuickAddNote,
  onDeleteNote,
  novelId,
  onSetAncestor,
  ancestorConnections,
  onRemoveAncestor,
  sceneId,
  characters,
  factions,
  onAddChild,
  onDetailSaved,
  onSetColor,
  onSetKeyMoment,
  onMeasureRef,
  isConnectSource,
  isConnectTarget,
}: {
  item: any;
  onRemove: () => void;
  onSetColor?: (color: string | null) => void;
  onSetKeyMoment?: (label: string | null) => void;
  onMeasureRef?: (id: string, el: HTMLDivElement | null) => void;
  onRemoveChild?: (id: string) => void;
  onLinkStart?: (id: string) => void;
  onLinkComplete?: (id: string) => void;
  isLinkingSource?: boolean;
  elementDetails?: Map<string, SceneElementDetails>;
  onEditChild?: (child: any) => void;
  ideaNotes?: SceneElementDetails[];
  onAddNote?: (item: any) => void;
  onQuickAddNote?: (item: any, text: string, existingNoteId?: string) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void | Promise<void>;
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null; targetIdeaTitle?: string | null; targetIdeaContent?: string | null; targetIdeaCategory?: string | null; targetIdeaNotes?: string[] }>;
  onRemoveAncestor?: (connectionId: string) => void;
  sceneId?: string;
  characters?: any[];
  factions?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
  isConnectSource?: boolean;
  isConnectTarget?: boolean;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { ...item, from: 'canvas' },
    disabled: !!isLinkingSource // Disable dragging if this is the source of a link
  });

  // Connect handle — ลากเพื่อเชื่อมการ์ด (แยกจาก drag ย้ายการ์ด)
  const { setNodeRef: setConnectRef, listeners: connectListeners, attributes: connectAttributes } = useDraggable({
    id: `connect:${item.id}`,
    data: { from: 'connect', sourceId: item.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: item.id,
    disabled: item.type !== 'idea', // Only ideas can be containers
    data: { ...item, acceptDrops: true }
  });

  // Combine refs (+ วัดตำแหน่งจริงสำหรับเส้น link/ancestor ในระบบ grid)
  const setNodeRef = useCallback((node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
    onMeasureRef?.(item.id, node);
  }, [setDragRef, setDropRef, onMeasureRef, item.id]);


  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-canvas-item="true"
      className="group/connect"
      style={{
        position: 'relative',
        zIndex: isDragging ? 999 : (isOver ? 10 : 2),
        cursor: isDragging ? 'grabbing' : 'grab',
        ...style,
      }}
      onClick={(e) => {
        // If we are in linking mode (someone else is source), clicking this item completes the link
        if (onLinkComplete) {
          onLinkComplete(item.id);
        }
      }}
    >
      {/* Connect handle — ลากออกไปปล่อยที่การ์ดอื่นเพื่อเชื่อม */}
      <button
        ref={setConnectRef}
        {...connectAttributes}
        {...connectListeners}
        onPointerDown={(e) => { e.stopPropagation(); (connectListeners as any)?.onPointerDown?.(e); }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
        title="ลากเพื่อเชื่อมการ์ด"
        aria-label="ลากเพื่อเชื่อมการ์ด"
        className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-40 h-6 w-6 rounded-full bg-[var(--forge-amber)] text-black shadow-md ring-2 ring-background flex items-center justify-center cursor-crosshair opacity-0 group-hover/connect:opacity-100 transition-opacity hover:scale-110"
      >
        <LinkIcon className="w-3 h-3" />
      </button>

      {/* Ring บอกสถานะเชื่อม */}
      {isConnectSource && (
        <div className="absolute inset-0 z-30 rounded-md ring-2 ring-[var(--forge-amber)] pointer-events-none" />
      )}
      {isConnectTarget && (
        <div className="absolute inset-0 z-30 rounded-md ring-2 ring-emerald-500 bg-emerald-500/5 pointer-events-none" />
      )}
      <CanvasItem
        item={item}
        onRemove={onRemove}
        onRemoveChild={onRemoveChild}
        isDragging={isDragging}
        isOver={isOver}
        isLinkingSource={isLinkingSource}
        onLinkStart={() => onLinkStart?.(item.id)}
        elementDetails={elementDetails}
        onEditChild={onEditChild}
        ideaNotes={ideaNotes}
        onAddNote={onAddNote}
        onQuickAddNote={onQuickAddNote}
        onDeleteNote={onDeleteNote}
        novelId={novelId}
        onSetAncestor={onSetAncestor}
        ancestorConnections={ancestorConnections}
        onRemoveAncestor={onRemoveAncestor}
        sceneId={sceneId}
        characters={characters}
        factions={factions}
        onAddChild={onAddChild}
        onDetailSaved={onDetailSaved}
        onSetColor={onSetColor}
        onSetKeyMoment={onSetKeyMoment}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Sticky Note (The Visual)
// ----------------------------------------------------------------------
function StickyNoteItem({ item, onRemove, isDragging, isOverlay }: { item: any; onRemove?: () => void; isDragging?: boolean; isOverlay?: boolean }) {
  console.log('[DEBUG] StickyNoteItem rendering:', item.id, item); // DEBUG
  const [isExpanded, setIsExpanded] = useState(true); // DEBUG: Start expanded
  const [content, setContent] = useState(item.content || "");

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setContent(newVal);
    item.content = newVal; // Direct mutation (parent save will persist)
  };

  // Hide original when dragging (but show overlay)
  const shouldHide = isDragging && !isOverlay;

  // Collapsed View (Bookmark-like)
  if (!isExpanded) {
    return (
      <div className={`group relative ${shouldHide ? 'opacity-0' : 'opacity-100'}`}>
        {/* The Bookmark Body */}
        <div
          onClick={toggleExpand}
          className="w-10 h-14 bg-purple-500 rounded-sm shadow-md hover:scale-110 transition-transform flex flex-col items-center justify-start pt-2 border-2 border-white cursor-pointer"
          style={{
            boxShadow: '2px 4px 6px rgba(0,0,0,0.2)'
          }}
        >
          <div className="w-2 h-2 rounded-full bg-purple-200 mb-1" />
          <StickyNote className="w-4 h-4 text-white" />
        </div>

        {/* Remove Button (Hover only) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-50 hover:bg-red-600"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Expanded View (Note)
  return (
    <Card
      className={`w-56 h-56 bg-purple-50 border-4 border-red-500 shadow-2xl flex flex-col relative animate-in zoom-in-90 duration-200 ${shouldHide ? 'opacity-0' : 'opacity-100'}`}
      style={{ boxShadow: '0 10px 25px -5px rgba(107, 33, 168, 0.2)', zIndex: 9999 }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center p-2 border-b border-purple-100 bg-purple-100/50 cursor-move"
        onClick={(e) => e.stopPropagation()} // Prevent expand toggle on header click
      >
        <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs pointer-events-none select-none">
          <StickyNote className="w-3 h-3" />
          <span>Note</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-purple-200 text-purple-600"
            onClick={toggleExpand}
            title="Collapse"
          >
            <Minimize2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-red-100 text-red-400 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            title="Remove Note"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3 cursor-default" onMouseDown={(e) => e.stopPropagation()}>
        <textarea
          className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-sm text-slate-700 placeholder:text-purple-300 font-serif leading-relaxed p-0 selection:bg-purple-200"
          placeholder="Type your note here..."
          value={content}
          onChange={handleContentChange}
          onKeyDown={(e) => e.stopPropagation()}
          autoFocus
        />
      </div>
    </Card>
  );
}

// The Visual Representation (used for both Canvas and DragOverlay)
export function CanvasItem({
  item,
  onRemove,
  onRemoveChild,
  isDragging,
  isOverlay,
  isOver,
  isLinkingSource,
  onLinkStart,
  elementDetails,
  onEditChild,
  ideaNotes,
  onAddNote,
  onQuickAddNote,
  onDeleteNote,
  novelId,
  onSetAncestor,
  ancestorConnections,
  onRemoveAncestor,
  sceneId,
  characters,
  factions,
  onAddChild,
  onDetailSaved,
  onSetColor,
  onSetKeyMoment,
}: {
  item: any;
  onSetColor?: (color: string | null) => void;
  onSetKeyMoment?: (label: string | null) => void;
  onRemove?: () => void;
  onRemoveChild?: (id: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  isOver?: boolean;
  isLinkingSource?: boolean;
  onLinkStart?: () => void;
  elementDetails?: Map<string, SceneElementDetails>;
  onEditChild?: (child: any) => void;
  ideaNotes?: SceneElementDetails[];
  onAddNote?: (item: any) => void;
  onQuickAddNote?: (item: any, text: string, existingNoteId?: string) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void | Promise<void>;
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null; targetIdeaTitle?: string | null; targetIdeaContent?: string | null; targetIdeaCategory?: string | null; targetIdeaNotes?: string[] }>;
  onRemoveAncestor?: (connectionId: string) => void;
  sceneId?: string;
  characters?: any[];
  factions?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
}) {
  // If use Sticky Note
  if (item.type === 'sticky-note') {
    console.log('[DEBUG] CanvasItem detected sticky-note:', item.id); // DEBUG
    return <StickyNoteItem item={item} onRemove={onRemove} isDragging={isDragging} isOverlay={isOverlay} />;
  }

  const isExpanded = true; // การ์ดขยายเต็มตลอด — ไม่มีปุ่มย่อ/ขยายแล้ว
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null); // null = สร้างใหม่, id = แก้ไขโน้ตเดิม
  const [deletingNote, setDeletingNote] = useState(false);
  // เหตุการณ์สำคัญ (mock) — เก็บ label อิสระใน canvas node ไปก่อน, ค่อยเลื่อนขึ้นตาราง ideas ทีหลัง
  const [editingKeyMoment, setEditingKeyMoment] = useState(false);
  const [keyMomentDraft, setKeyMomentDraft] = useState(item.keyMomentLabel || "");

  // @mention ในโน้ต — เฉพาะ character ที่เป็น children ของการ์ดนี้
  const quickNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const [qmOpen, setQmOpen] = useState(false);
  const [qmQuery, setQmQuery] = useState("");
  const [qmIndex, setQmIndex] = useState(0);
  const mentionChars: { id: string; name: string }[] = Array.from(
    new Map(
      (item.children || [])
        .filter((c: any) => c.type === 'character' || c.type === 'dummy_character')
        .map((c: any) => { const id = c.referenceId || c.id; return [id, { id, name: c.title }]; })
    ).values()
  ) as { id: string; name: string }[];
  const qmMatches = qmOpen
    ? mentionChars.filter(c => c.name.toLowerCase().includes(qmQuery.toLowerCase())).slice(0, 6)
    : [];
  const detectQm = (value: string, caret: number) => {
    const m = value.slice(0, caret).match(/@([^\s@]{0,30})$/);
    if (m && mentionChars.length > 0) { setQmQuery(m[1]); setQmOpen(true); setQmIndex(0); }
    else setQmOpen(false);
  };
  const insertQm = (name: string) => {
    const ta = quickNoteRef.current;
    const caret = ta?.selectionStart ?? quickNote.length;
    const before = quickNote.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `);
    const after = quickNote.slice(caret);
    setQuickNote(before + after);
    setQmOpen(false);
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(before.length, before.length); });
  };

  // แสดง @ชื่อ (ที่ตรงกับตัวละครในการ์ด) เป็น tag/ชิป ตอนดูโน้ต — เรียงชื่อยาวก่อนกันชื่อซ้อน
  const renderNoteMentions = (text: string): React.ReactNode => {
    const names = mentionChars.map(c => c.name).filter(Boolean);
    if (!names.length || !text) return text;
    const esc = names.slice().sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`@(${esc.join("|")})`, "g");
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(
        <span key={m.index} className="inline-flex items-center rounded bg-amber-500/20 px-1 font-medium text-amber-700 dark:text-amber-300">
          @{m[1]}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const submitQuickNote = async () => {
    const text = quickNote.trim();
    if (!text || !onQuickAddNote) return;
    setSavingQuickNote(true);
    await onQuickAddNote(item, text, editingNoteId ?? undefined);
    setSavingQuickNote(false);
    setQuickNote("");
    setQuickNoteOpen(false);
    setEditingNoteId(null);
  };

  const closeQuickNote = () => {
    setQuickNote("");
    setQuickNoteOpen(false);
    setEditingNoteId(null);
  };

  const deleteEditingNote = async () => {
    if (!editingNoteId || !onDeleteNote) return;
    setDeletingNote(true);
    await onDeleteNote(editingNoteId);
    setDeletingNote(false);
    closeQuickNote();
  };

  // ตัวแก้โน้ต — ใช้ซ้ำทั้งตอนสร้างใหม่ (ท้ายลิสต์) และตอนแก้ (แทนที่ preview ของโน้ตนั้น)
  const noteEditor = (
    <div className="space-y-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="relative">
        <Textarea
          autoFocus
          ref={quickNoteRef}
          value={quickNote}
          onChange={(e) => { setQuickNote(e.target.value); detectQm(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
          onKeyDown={(e) => {
            if (qmOpen && qmMatches.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setQmIndex(i => (i + 1) % qmMatches.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setQmIndex(i => (i - 1 + qmMatches.length) % qmMatches.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertQm(qmMatches[qmIndex].name); return; }
              if (e.key === "Escape") { e.preventDefault(); setQmOpen(false); return; }
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitQuickNote(); }
            else if (e.key === "Escape") { closeQuickNote(); }
          }}
          placeholder={mentionChars.length > 0
            ? "เขียนโน้ต… (@ เพื่อ mention ตัวละคร, ⌘/Ctrl+Enter บันทึก)"
            : "เขียนโน้ต… (⌘/Ctrl+Enter เพื่อบันทึก)"}
          className="min-h-[52px] resize-none text-xs bg-yellow-500/10 border-yellow-500/30 focus-visible:ring-yellow-500/40"
        />
        {qmOpen && qmMatches.length > 0 && (
          <div className="absolute left-1 right-1 bottom-1 z-50 rounded-md border border-yellow-400 bg-popover shadow-lg overflow-hidden">
            {qmMatches.map((c, i) => (
              <button
                type="button"
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); insertQm(c.name); }}
                className={`w-full flex items-center gap-2 px-2 py-1 text-left text-xs ${i === qmIndex ? "bg-yellow-500/20" : "hover:bg-yellow-500/10"}`}
              >
                <span className="text-yellow-600 font-semibold">@</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <div className="flex justify-end gap-1 ml-auto">
          <Button type="button" size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={closeQuickNote}>
            ยกเลิก
          </Button>
          <Button type="button" size="sm" className="h-6 text-xs px-2" disabled={!quickNote.trim() || savingQuickNote} onClick={submitQuickNote}>
            {savingQuickNote ? <Loader2 className="w-3 h-3 animate-spin" /> : (editingNoteId ? "อัปเดต" : "บันทึก")}
          </Button>
        </div>
      </div>
    </div>
  );

  const Icon = () => {
    if (item.type === 'character') return <User className="w-4 h-4" />;
    if (item.type === 'location') return <MapPin className="w-4 h-4" />;
    return <Lightbulb className="w-4 h-4" />;
  }

  // Helper to get character role-based colors
  // ต้องตรงกับ ROLES ใน scene-participants-panel — dark-friendly, มี label + chip + เส้นขอบ
  const ROLE_META: Record<string, { label: string; text: string; chip: string; dot: string }> = {
    protagonist: { label: 'ตัวหลัก', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25', dot: 'bg-amber-500' },
    antagonist: { label: 'ฝ่ายตรงข้าม', text: 'text-red-600 dark:text-red-400', chip: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25', dot: 'bg-red-500' },
    witness: { label: 'ผู้เห็นเหตุ', text: 'text-blue-600 dark:text-blue-400', chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25', dot: 'bg-blue-500' },
    victim: { label: 'เหยื่อ', text: 'text-purple-600 dark:text-purple-400', chip: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25', dot: 'bg-purple-500' },
  };
  const roleMeta = (role?: string) => ROLE_META[(role || 'protagonist').toLowerCase()] ?? ROLE_META.protagonist;

  // If idea, maybe make it wider/bigger to imply container
  const isContainer = item.type === 'idea';

  // ในระบบ grid การ์ดกว้างเต็มช่องเสมอ (expand = ขยายแนวตั้งด้วยเนื้อหา ไม่ใช่แนวนอน)
  // DragOverlay ไม่มีช่องรองรับ ให้ความกว้างคงที่
  const widthClass = isOverlay ? 'w-72' : 'w-full';

  // Get detail page URL for navigation
  const getDetailPageUrl = () => {
    if (!novelId) return null;
    if (item.type === 'character') {
      return `/dashboard/project/${novelId}/characters/${item.referenceId || item.id}`;
    }
    if (item.type === 'location') {
      return `/dashboard/project/${novelId}/locations`; // Locations don't have individual pages yet
    }
    if (item.type === 'idea') {
      return `/dashboard/project/${novelId}/idea`; // Ideas page
    }
    return null;
  };

  // Helper to get detail for a child
  const getChildDetail = (child: any) => {
    if (!elementDetails) return null;
    // Try to find by canvasItemId + elementId combination
    const key = `${item.id}-${child.type}-${child.referenceId || child.refId || child.id}`;
    return elementDetails.get(key);
  };

  // Helper to get notes for this idea
  const getIdeaNotes = () => {
    if (!ideaNotes || item.type !== 'idea') return [];
    return ideaNotes.filter(note =>
      note.canvasItemId === item.id &&
      note.elementType === 'idea_note'
    );
  };

  const thisIdeaNotes = getIdeaNotes();

  // Copy node data to clipboard in structured format
  const copyToClipboard = async () => {
    // Get characters from children
    const characters = item.children
      ?.filter((c: any) => c.type === 'character')
      .map((c: any) => c.title)
      .join(', ') || '';

    // Get locations and others from children
    const locations = item.children
      ?.filter((c: any) => c.type === 'location')
      .map((c: any) => c.title)
      .join(', ') || '';

    const others = item.children
      ?.filter((c: any) => c.type !== 'character' && c.type !== 'location' && c.type !== 'sticky-note')
      .map((c: any) => c.title)
      .join(', ') || '';

    // Get sticky notes from children (purple notes attached to idea)
    const stickyNotes = item.children
      ?.filter((c: any) => c.type === 'sticky-note')
      .map((c: any) => c.content)
      .filter(Boolean)
      .join('\n') || '';

    // Get notes (yellow idea notes)
    const notes = thisIdeaNotes
      .map((note: any) => note.notes)
      .join('\n') || '';

    // Get Ancestors
    const ancestors = ancestorConnections
      ?.map((conn) => {
        const title = conn.targetIdeaTitle || conn.targetIdeaId.slice(0, 8);
        return conn.label ? `[${conn.label}] ${title}` : title;
      })
      .join(', ') || '';

    // Build the structured text
    const content = typeof item.content === 'string' ? item.content : '';

    const clipboardText = `Title: ${item.title}
Desc: ${content}
Character: ${characters}
Other: ${locations}${others ? (locations ? ', ' : '') + others : ''}
Ancestors: ${ancestors}
Notes: ${notes}
Sticky Notes: ${stickyNotes}`;

    try {
      await navigator.clipboard.writeText(clipboardText);
      toast.success('คัดลอกข้อมูลแล้ว');
    } catch (err) {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };


  // สีแถบหัวการ์ด: ป้ายจัดกลุ่มที่ user ตั้ง > สีประจำชนิดการ์ด
  const stripColor = item.color
    || (item.type === 'character' ? '#3b82f6'
      : item.type === 'location' ? '#22c55e'
        : 'var(--forge-amber)');

  const isKeyMoment = item.type === 'idea' && !!item.keyMomentLabel;

  return (
    <div className="relative group">
      <Card className={`
          ${widthClass} bg-card rounded-md overflow-hidden
          ${isOverlay || isDragging ? 'cursor-grabbing' : ''}
          ${isOver ? 'ring-2 ring-[var(--forge-amber)] ring-offset-1' : ''}
          ${isLinkingSource ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
          ${isKeyMoment ? 'ring-1 ring-amber-400/60 shadow-[0_0_14px_-2px] shadow-amber-500/40' : ''}
          border border-border/70 shadow-sm hover:shadow-md transition-shadow duration-200
          ${isDragging && !isOverlay ? 'opacity-0' : 'opacity-100'}
      `}
      >
        {/* แถบสีหัวการ์ด — ป้ายจัดกลุ่ม/ชนิด (เหตุการณ์สำคัญ = แถบอำพันหนา) */}
        <div
          className={isKeyMoment ? 'h-1.5' : 'h-1'}
          style={isKeyMoment
            ? { background: 'linear-gradient(90deg, var(--forge-amber), #f59e0b)' }
            : { background: stripColor }}
        />
        <div className="p-2">
          <div className={`flex items-start gap-2 ${!isExpanded && item.type === 'idea' && item.content ? 'mb-2' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-2 ${!isExpanded && item.type === 'idea' && item.content ? 'mb-1' : ''}`}>
                <div className={`p-1 rounded-full ${isOverlay ? 'bg-background' : 'bg-muted'}`}>
                  <Icon />
                </div>
                <p className="font-semibold text-sm truncate">{item.title}</p>
              </div>

              {item.type === 'idea' && item.content && (
                <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap mt-1.5">
                  {typeof item.content === 'string' ? item.content : 'Rich text content...'}
                </p>
              )}

              {/* เหตุการณ์สำคัญ (mock) — banner เด่น + inline editor */}
              {isContainer && editingKeyMoment ? (
                <div
                  className="mt-2 flex items-center gap-1.5 chamfered-sm bg-amber-500/15 border border-amber-500/50 px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />
                  <input
                    autoFocus
                    value={keyMomentDraft}
                    onChange={(e) => setKeyMomentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { onSetKeyMoment?.(keyMomentDraft.trim() || null); setEditingKeyMoment(false); }
                      if (e.key === 'Escape') { setKeyMomentDraft(item.keyMomentLabel || ""); setEditingKeyMoment(false); }
                    }}
                    onBlur={() => { onSetKeyMoment?.(keyMomentDraft.trim() || null); setEditingKeyMoment(false); }}
                    placeholder="เช่น พระเอกชนะ, ตัวร้ายตาย…"
                    className="flex-1 min-w-0 h-6 bg-transparent text-xs font-semibold text-amber-900 dark:text-amber-100 placeholder:text-amber-500/60 placeholder:font-normal focus:outline-none"
                  />
                </div>
              ) : isContainer && item.keyMomentLabel ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setKeyMomentDraft(item.keyMomentLabel); setEditingKeyMoment(true); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="group/km mt-2 w-full flex items-center gap-1.5 chamfered-sm bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-300/60 pl-2 pr-2.5 py-1 text-left shadow-sm shadow-amber-500/30 hover:from-amber-300 hover:to-amber-400 transition-colors"
                  title="แก้ไขเหตุการณ์สำคัญ"
                >
                  <Star className="w-3.5 h-3.5 text-amber-950 shrink-0 motion-safe:animate-pulse" fill="currentColor" />
                  <span className="font-technical text-[8px] uppercase tracking-[0.14em] text-amber-900/70 shrink-0">จุดสำคัญ</span>
                  <span className="flex-1 min-w-0 truncate text-xs font-bold text-amber-950">{item.keyMomentLabel}</span>
                  <Pencil className="w-3 h-3 text-amber-900/50 shrink-0 opacity-0 group-hover/km:opacity-100 transition-opacity" />
                </button>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 -mr-1 -mt-1">
              {/* Three-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="เมนู"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Link */}
                  {onLinkStart && (
                    <DropdownMenuItem
                      className={isLinkingSource ? 'text-blue-500 font-medium' : ''}
                      onSelect={(e) => { onLinkStart(); }}
                    >
                      <LinkIcon className="w-3.5 h-3.5 mr-2" />
                      {isLinkingSource ? 'กำลังเชื่อม...' : 'เชื่อมการ์ด'}
                    </DropdownMenuItem>
                  )}

                  {/* Ancestor (idea only) */}
                  {isContainer && onSetAncestor && (
                    <DropdownMenuItem onSelect={() => onSetAncestor()}>
                      <GitBranchPlus className="w-3.5 h-3.5 mr-2" />
                      เชื่อมเหตุผล
                    </DropdownMenuItem>
                  )}

                  {/* เหตุการณ์สำคัญ (idea only) */}
                  {isContainer && onSetKeyMoment && (
                    <DropdownMenuItem onSelect={() => { setKeyMomentDraft(item.keyMomentLabel || ""); setEditingKeyMoment(true); }}>
                      <Star className="w-3.5 h-3.5 mr-2" />
                      {item.keyMomentLabel ? 'แก้ไขเหตุการณ์สำคัญ' : 'ทำเครื่องหมายเหตุการณ์สำคัญ'}
                    </DropdownMenuItem>
                  )}

                  {/* Copy (idea only) */}
                  {isContainer && (
                    <DropdownMenuItem onSelect={() => copyToClipboard()}>
                      <Copy className="w-3.5 h-3.5 mr-2" />
                      คัดลอกข้อมูล
                    </DropdownMenuItem>
                  )}

                  {/* Color picker */}
                  {onSetColor && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">สีการ์ด</p>
                        <div className="flex flex-wrap gap-1">
                          {CARD_COLORS.map((c) => (
                            <button
                              key={c}
                              className="h-4 w-4 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                              style={{ background: c, outline: item.color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                              onClick={(e) => { e.stopPropagation(); onSetColor(c); }}
                            >
                              {item.color === c && <Check className="h-2.5 w-2.5 text-white" />}
                            </button>
                          ))}
                          <button
                            className="h-4 w-4 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); onSetColor(null); }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Remove */}
                  {onRemove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onRemove()}
                      >
                        <X className="w-3.5 h-3.5 mr-2" />
                        นำออกจาก canvas
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className={`space-y-1 ${item.type === 'idea' ? '' : 'border-t pt-2 mt-2'}`}>
              {/* Full content for character */}
              {item.type === 'character' && (
                <div className="space-y-2 text-xs">
                  {item.role && (
                    <div>
                      <span className="font-semibold text-muted-foreground">บทบาท: </span>
                      <span>{item.role}</span>
                    </div>
                  )}
                  {item.personality && (
                    <div>
                      <span className="font-semibold text-muted-foreground">บุคลิก: </span>
                      <span className="whitespace-pre-wrap">{item.personality}</span>
                    </div>
                  )}
                  {item.abilities && (
                    <div>
                      <span className="font-semibold text-muted-foreground">ความสามารถ: </span>
                      <span className="whitespace-pre-wrap">{item.abilities}</span>
                    </div>
                  )}
                  {item.backstory && (
                    <div>
                      <span className="font-semibold text-muted-foreground">ที่มา: </span>
                      <span className="whitespace-pre-wrap line-clamp-4">{item.backstory}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Full content for location */}
              {item.type === 'location' && (
                <div className="space-y-2 text-xs">
                  {item.locationType && (
                    <div>
                      <span className="font-semibold text-muted-foreground">ประเภท: </span>
                      <span>{item.locationType}</span>
                    </div>
                  )}
                  {item.description && (
                    <div>
                      <span className="font-semibold text-muted-foreground">รายละเอียด: </span>
                      <span className="whitespace-pre-wrap">{item.description}</span>
                    </div>
                  )}
                  {item.atmosphere && (
                    <div>
                      <span className="font-semibold text-muted-foreground">บรรยากาศ: </span>
                      <span className="whitespace-pre-wrap">{item.atmosphere}</span>
                    </div>
                  )}
                </div>
              )}



              {/* Link to detail page */}
              {getDetailPageUrl() && (
                <Link
                  href={getDetailPageUrl()!}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  ดูรายละเอียดเต็ม
                </Link>
              )}
            </div>
          )}


          {/* Ancestor Connections Badge */}
          {isContainer && ancestorConnections && ancestorConnections.length > 0 && (
            <div className="space-y-1 mb-2 border-t pt-2 mt-2">
              <p className="text-[10px] uppercase font-bold text-blue-500/80 tracking-wider mb-1 flex items-center gap-1">
                <GitBranchPlus className="w-3 h-3" /> เหตุผล / ที่มา
              </p>
              {ancestorConnections.map((conn) => {
                // Find the ancestor idea title from items or ideas
                const ancestorTitle = conn.label || conn.targetIdeaTitle || conn.targetIdeaId.slice(0, 8) + '...';
                const categoryLabels: Record<string, string> = {
                  plot: '📖 พล็อต',
                  character: '👤 ตัวละคร',
                  worldbuilding: '🌍 สร้างโลก',
                  subplot: '📝 เนื้อรอง',
                  general: '💡 ทั่วไป',
                };
                return (
                  <Popover key={conn.id}>
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs group/ancestor">
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:text-blue-900 transition-colors cursor-pointer"
                        >
                          <span className="text-blue-600 shrink-0">🧬</span>
                          <span className="truncate flex-1 text-blue-700">{ancestorTitle}</span>
                        </button>
                      </PopoverTrigger>
                      {onRemoveAncestor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveAncestor(conn.id);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover/ancestor:opacity-100 hover:text-red-500 transition-opacity text-blue-400 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <PopoverContent
                      side="top"
                      align="start"
                      className="w-72 p-0 shadow-xl border-blue-200"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 rounded-t-md">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-white shrink-0" />
                          <p className="text-sm font-semibold text-white truncate">
                            {conn.targetIdeaTitle || 'Idea'}
                          </p>
                        </div>
                        {conn.targetIdeaCategory && (
                          <span className="text-[10px] text-blue-100 mt-0.5 block">
                            {categoryLabels[conn.targetIdeaCategory] || conn.targetIdeaCategory}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        {conn.label && (
                          <div className="flex items-start gap-1.5">
                            <span className="text-blue-500 text-xs shrink-0 mt-0.5">💬</span>
                            <p className="text-xs text-blue-700 italic">{conn.label}</p>
                          </div>
                        )}
                        {conn.targetIdeaContent ? (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                            {conn.targetIdeaContent}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic">ไม่มีเนื้อหาเพิ่มเติม</p>
                        )}
                        {conn.targetIdeaNotes && conn.targetIdeaNotes.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
                            <p className="text-[10px] font-semibold text-blue-500 uppercase">📝 Notes</p>
                            {conn.targetIdeaNotes.map((note, idx) => (
                              <p key={idx} className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 whitespace-pre-wrap">
                                {note}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          )}

          {/* Children Area for Ideas */}
          {isContainer && (
            <div className="space-y-3 pt-2 border-t mt-2">

              {/* Characters Section (Real & Dummy) */}
              {item.children && item.children.some((c: any) => c.type === 'character' || c.type === 'dummy_character') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Characters
                  </p>
                  <div className="divide-y divide-border/40">
                    {item.children
                      .filter((c: any) => c.type === 'character' || c.type === 'dummy_character')
                      .map((child: any) => {
                        const detail = getChildDetail(child);
                        const hasDetail = detail && (detail.action || detail.how || detail.goal);
                        const isDummy = child.type === 'dummy_character';
                        const rm = roleMeta(detail?.role || child.role);
                        return (
                          <div key={child.id} className="py-1 text-xs group/item">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", rm.dot)} />
                              <span className={cn("truncate font-medium text-foreground", isDummy && "italic text-muted-foreground")}>
                                {child.title}{isDummy && <span className="text-[10px] text-muted-foreground font-normal ml-1">(Dummy)</span>}
                              </span>
                              <span className={cn("text-[10px] shrink-0", rm.text)}>{rm.label}</span>
                              <span className="flex-1" />
                              {onEditChild && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onEditChild({ ...child, canvasItemId: item.id }); }}
                                  className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                                  title="แก้ไขรายละเอียด"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {onRemoveChild && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRemoveChild(child.id); }}
                                  className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {detail?.action && (
                              <p className="mt-0.5 ml-3 text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap">
                                {detail.action}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Factions Section (Real & Dummy) */}
              {item.children && item.children.some((c: any) => c.type === 'faction' || c.type === 'dummy_faction') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-emerald-500/80 tracking-wider mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Factions
                  </p>
                  <div className="divide-y divide-border/40">
                    {item.children
                      .filter((c: any) => c.type === 'faction' || c.type === 'dummy_faction')
                      .map((child: any) => {
                        const detail = getChildDetail(child);
                        const hasDetail = detail && (detail.action || detail.how || detail.goal);
                        const isDummy = child.type === 'dummy_faction';
                        return (
                          <div key={child.id} className="py-1 text-xs group/item">
                            <div className="flex items-center gap-1.5">
                              <Shield className={cn("w-3 h-3 shrink-0", isDummy ? "text-muted-foreground" : "text-emerald-500")} />
                              <span className={cn("truncate font-medium text-foreground", isDummy && "italic text-muted-foreground")}>
                                {child.title}{isDummy && <span className="text-[10px] text-muted-foreground font-normal ml-1">(Dummy)</span>}
                              </span>
                              <span className="flex-1" />
                              {onEditChild && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditChild({ ...child, canvasItemId: item.id });
                                  }}
                                  className="opacity-0 group-hover/item:opacity-100 hover:text-emerald-500 transition-opacity shrink-0"
                                  title="แก้ไขรายละเอียด"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {onRemoveChild && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveChild(child.id);
                                  }}
                                  className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {detail?.action && (
                              <p className="mt-0.5 ml-[18px] text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap">
                                {detail.action}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Locations Section */}
              {item.children && item.children.some((c: any) => c.type === 'location') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-green-500/80 tracking-wider mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Locations
                  </p>
                  <div className="divide-y divide-border/40">
                    {item.children
                      .filter((c: any) => c.type === 'location')
                      .map((child: any) => {
                        const detail = getChildDetail(child);
                        const hasDetail = detail && (detail.action || detail.how || detail.goal);
                        return (
                          <div key={child.id} className="flex items-center gap-1.5 py-1 text-xs group/item">
                            <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                            <span className="truncate font-medium">{child.title}</span>
                            {hasDetail && (
                              <span className="truncate text-[10px] text-muted-foreground/80 min-w-0">
                                {detail.action && `· ${detail.action}`}
                              </span>
                            )}
                            <span className="flex-1" />
                            {onEditChild && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditChild({ ...child, canvasItemId: item.id });
                                }}
                                className="opacity-0 group-hover/item:opacity-100 hover:text-green-500 transition-opacity shrink-0"
                                title="แก้ไขรายละเอียด"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {onRemoveChild && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveChild(child.id);
                                }}
                                className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Others Section */}
              {item.children && item.children.some((c: any) => c.type !== 'character' && c.type !== 'dummy_character' && c.type !== 'faction' && c.type !== 'dummy_faction' && c.type !== 'location' && c.type !== 'sticky-note') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Others</p>
                  <div className="divide-y divide-border/40">
                    {item.children
                      .filter((c: any) => c.type !== 'character' && c.type !== 'dummy_character' && c.type !== 'faction' && c.type !== 'dummy_faction' && c.type !== 'location' && c.type !== 'sticky-note')
                      .map((child: any) => (
                        <div key={child.id} className="flex items-center gap-1.5 py-1 text-xs group/item">
                          <Lightbulb className="w-3 h-3 text-yellow-500 shrink-0" />
                          <span className="truncate flex-1">{child.title}</span>
                          {onRemoveChild && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveChild(child.id);
                              }}
                              className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Scene Participants Panel (ผู้เข้าร่วมระดับไอเดีย) */}
              {onAddChild && sceneId && novelId && onDetailSaved && (
                <div className="pt-1.5 border-t border-dashed flex justify-end">
                  <SceneParticipantsPanel
                    ideaItem={item}
                    sceneId={sceneId}
                    novelId={novelId}
                    characters={characters || []}
                    factions={factions || []}
                    elementDetails={elementDetails}
                    onAddChild={onAddChild}
                    onRemoveChild={(childId) => onRemoveChild?.(childId)}
                    onDetailSaved={onDetailSaved}
                  />
                </div>
              )}

              {/* Notes footer (idea only) — annotation รอง อยู่ท้ายการ์ด */}
              {isContainer && onQuickAddNote && (
                <div className="space-y-1.5">
                  {thisIdeaNotes.map((note) => (
                    editingNoteId === note.id ? (
                      <div key={note.id}>{noteEditor}</div>
                    ) : (
                      <div
                        key={note.id}
                        className="group/note relative rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2 py-1.5 text-xs cursor-pointer hover:bg-yellow-500/15 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // แก้ไข inline ตรงที่โน้ตนั้นเลย (ตัวแก้แทนที่ preview)
                          setEditingNoteId(note.id);
                          setQuickNote(note.notes || "");
                          setQuickNoteOpen(true);
                        }}
                      >
                        <p className="text-foreground/90 whitespace-pre-wrap line-clamp-3 pr-4">{renderNoteMentions(note.notes || "")}</p>
                        <Pencil className="w-3 h-3 absolute top-1.5 right-1.5 text-muted-foreground opacity-0 group-hover/note:opacity-100 transition-opacity" />
                      </div>
                    )
                  ))}

                  {/* สร้างใหม่: ตัวแก้ท้ายลิสต์ (เฉพาะตอนไม่ได้แก้โน้ตเดิม) */}
                  {editingNoteId === null && quickNoteOpen ? (
                    noteEditor
                  ) : !quickNoteOpen ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingNoteId(null); setQuickNote(""); setQuickNoteOpen(true); }}
                      className="flex items-center justify-center gap-1 w-full text-xs text-yellow-700/70 dark:text-yellow-500/70 hover:text-yellow-800 dark:hover:text-yellow-400 border border-dashed border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-500/5 rounded-md px-2 py-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      เพิ่มโน้ต
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
          {isContainer && isOver && (!item.children || item.children.length === 0) && (
            <div className="pt-2 border-t mt-2">
              <div className="h-8 border-2 border-dashed border-primary/30 rounded bg-primary/5 flex items-center justify-center text-[10px] text-primary">
                Drop items here
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Sticky Note Cards - วางใต้การ์ด (ใน flow เพื่อไม่ทับคอลัมน์ข้างๆ) */}
      {isContainer && item.children?.filter((c: any) => c.type === 'sticky-note').length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {item.children
            .filter((c: any) => c.type === 'sticky-note')
            .map((note: any) => (
              <div
                key={note.id}
                className="group relative"
              >
                {/* Note Card */}
                <div
                  className="w-full bg-purple-100 rounded border-2 border-purple-200 p-2.5"
                  style={{ minHeight: '48px' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-purple-200">
                    <div className="flex items-center gap-1 text-purple-600">
                      <StickyNote className="w-3 h-3" />
                      <span className="text-[10px] font-semibold uppercase">Note</span>
                    </div>
                    {/* Remove Button */}
                    {onRemoveChild && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveChild(note.id);
                        }}
                        className="text-purple-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Content - Full Text */}
                  <p className="text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">
                    {note.content || <span className="text-purple-400 italic">Empty note...</span>}
                  </p>
                </div>

                {/* Decorative Pin */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-sm" />
              </div>
            ))}
        </div>
      )}
    </div>
  );
}