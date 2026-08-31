"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Lightbulb, X, Link as LinkIcon, StickyNote, Minimize2, ExternalLink, Check, MoreVertical, Quote } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useCallback, useState } from "react";
import { SceneElementDetails } from "@/db/schema";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { IdeaFilmCard } from "./idea-frame-dialog";

// สีโน้ต — ผู้ใช้เลือกสีเองจากพาเลตเดียวกับป้ายจัดกลุ่มการ์ด แทนชนิดตายตัว (tension/dialogue/question เดิม)
// noteKind เก็บค่า hex สีตรงๆ, null = ทั่วไป (เหลืองเดิม)

// For items already on the canvas (moveable)
export function DraggableCanvasItem({
  item,
  tonePresets,
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
  onReorderNotes,
  novelId,
  onSetAncestor,
  ancestorConnections,
  onRemoveAncestor,
  sceneId,
  characters,
  novelDummyNames,
  factions,
  ideas,
  onAddChild,
  onUpdateChild,
  onPromoteDummy,
  onDetailSaved,
  onSetColor,
  onSetKeyMoment,
  onSetNarration,
  threadBeats,
  onOpenThreadBind,
  onMeasureRef,
  isConnectSource,
  isConnectTarget,
  dragDisabled,
}: {
  item: any;
  tonePresets?: { id: string; label: string; color: string }[];
  onRemove: () => void;
  onSetColor?: (color: string | null) => void;
  onSetKeyMoment?: (label: string | null) => void;
  onSetNarration?: (isNarration: boolean) => void;
  threadBeats?: Array<{ beatId: string; threadId: string; title: string; color: string | null; role: string }>;
  onOpenThreadBind?: () => void;
  onMeasureRef?: (id: string, el: HTMLDivElement | null) => void;
  onRemoveChild?: (id: string) => void;
  onLinkStart?: (id: string) => void;
  onLinkComplete?: (id: string) => void;
  isLinkingSource?: boolean;
  elementDetails?: Map<string, SceneElementDetails>;
  onEditChild?: (child: any) => void;
  ideaNotes?: SceneElementDetails[];
  onAddNote?: (item: any) => void;
  onQuickAddNote?: (item: any, text: string, existingNoteId?: string, noteKind?: string) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void | Promise<void>;
  onReorderNotes?: (orderedNoteIds: string[]) => void | Promise<void>;
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null; targetIdeaTitle?: string | null; targetIdeaContent?: string | null; targetIdeaCategory?: string | null; targetIdeaNotes?: string[] }>;
  onRemoveAncestor?: (connectionId: string) => void;
  sceneId?: string;
  characters?: any[];
  novelDummyNames?: string[];
  factions?: any[];
  ideas?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onUpdateChild?: (parentId: string, childId: string, patch: any) => void;
  onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
  isConnectSource?: boolean;
  isConnectTarget?: boolean;
  dragDisabled?: boolean; // mobile list view — no spatial drag/connect there
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { ...item, from: 'canvas' },
    disabled: !!isLinkingSource || !!dragDisabled
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
      {/* Connect handle — ลากออกไปปล่อยที่การ์ดอื่นเพื่อเชื่อม (ไม่มีบนมือถือ ไม่มี drag) */}
      {!dragDisabled && (
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
      )}

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
        onReorderNotes={onReorderNotes}
        novelId={novelId}
        onSetAncestor={onSetAncestor}
        ancestorConnections={ancestorConnections}
        onRemoveAncestor={onRemoveAncestor}
        sceneId={sceneId}
        characters={characters}
        novelDummyNames={novelDummyNames}
        factions={factions}
        ideas={ideas}
        onAddChild={onAddChild}
        onUpdateChild={onUpdateChild}
        onPromoteDummy={onPromoteDummy}
        onDetailSaved={onDetailSaved}
        onSetColor={onSetColor}
        tonePresets={tonePresets}
        onSetKeyMoment={onSetKeyMoment}
        onSetNarration={onSetNarration}
        threadBeats={threadBeats}
        onOpenThreadBind={onOpenThreadBind}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Sticky Note (The Visual)
// ----------------------------------------------------------------------
function StickyNoteItem({ item, onRemove, isDragging, isOverlay }: { item: any; onRemove?: () => void; isDragging?: boolean; isOverlay?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true)
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
          className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-sm text-purple-900 placeholder:text-purple-300 font-serif leading-relaxed p-0 selection:bg-purple-200"
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
  onReorderNotes,
  novelId,
  onSetAncestor,
  ancestorConnections,
  onRemoveAncestor,
  sceneId,
  characters,
  novelDummyNames,
  factions,
  ideas,
  onAddChild,
  onUpdateChild,
  onPromoteDummy,
  onDetailSaved,
  onSetColor,
  tonePresets = [],
  onSetKeyMoment,
  onSetNarration,
  threadBeats,
  onOpenThreadBind,
}: {
  item: any;
  tonePresets?: { id: string; label: string; color: string }[];
  onSetColor?: (color: string | null) => void;
  onSetKeyMoment?: (label: string | null) => void;
  onSetNarration?: (isNarration: boolean) => void;
  threadBeats?: Array<{ beatId: string; threadId: string; title: string; color: string | null; role: string }>;
  onOpenThreadBind?: () => void;
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
  onQuickAddNote?: (item: any, text: string, existingNoteId?: string, noteKind?: string) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void | Promise<void>;
  onReorderNotes?: (orderedNoteIds: string[]) => void | Promise<void>;
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null; targetIdeaTitle?: string | null; targetIdeaContent?: string | null; targetIdeaCategory?: string | null; targetIdeaNotes?: string[] }>;
  onRemoveAncestor?: (connectionId: string) => void;
  sceneId?: string;
  characters?: any[];
  novelDummyNames?: string[];
  factions?: any[];
  ideas?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onUpdateChild?: (parentId: string, childId: string, patch: any) => void;
  onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
}) {
  // If use Sticky Note
  if (item.type === 'sticky-note') {
    return <StickyNoteItem item={item} onRemove={onRemove} isDragging={isDragging} isOverlay={isOverlay} />;
  }

  // Idea container cards get their own "film frame" compact face + detail dialog
  if (item.type === 'idea') {
    return (
      <IdeaFilmCard
        item={item}
        onRemove={onRemove}
        onRemoveChild={onRemoveChild}
        isDragging={isDragging}
        isOverlay={isOverlay}
        isOver={isOver}
        isLinkingSource={isLinkingSource}
        onLinkStart={onLinkStart}
        elementDetails={elementDetails}
        onEditChild={onEditChild}
        ideaNotes={ideaNotes}
        onQuickAddNote={onQuickAddNote}
        onDeleteNote={onDeleteNote}
        onReorderNotes={onReorderNotes}
        novelId={novelId}
        onSetAncestor={onSetAncestor}
        ancestorConnections={ancestorConnections}
        onRemoveAncestor={onRemoveAncestor}
        sceneId={sceneId}
        characters={characters}
        novelDummyNames={novelDummyNames}
        factions={factions}
        ideas={ideas}
        onAddChild={onAddChild}
        onUpdateChild={onUpdateChild}
        onPromoteDummy={onPromoteDummy}
        onDetailSaved={onDetailSaved}
        onSetColor={onSetColor}
        tonePresets={tonePresets}
        onSetKeyMoment={onSetKeyMoment}
        onSetNarration={onSetNarration}
        threadBeats={threadBeats}
        onOpenThreadBind={onOpenThreadBind}
      />
    );
  }

  const isExpanded = true; // การ์ดขยายเต็มตลอด — ไม่มีปุ่มย่อ/ขยายแล้ว

  const Icon = () => {
    if (item.type === 'character') return <User className="w-4 h-4" />;
    if (item.type === 'location') return <MapPin className="w-4 h-4" />;
    return <Lightbulb className="w-4 h-4" />;
  }

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
    return null;
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
          ${item.isNarration ? 'border-dashed border-amber-500/30 opacity-75 hover:opacity-100' : 'border-border/70'}
          border shadow-sm hover:shadow-md transition-all duration-200
          ${isDragging && !isOverlay ? 'opacity-0' : ''}
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
                {item.isNarration && (
                  <span
                    title="คำบรรยาย (Narrator) — ไม่มีตัวละครร่วมฉาก"
                    className="inline-flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-500"
                  >
                    <Quote className="w-3 h-3" fill="currentColor" /> บรรยาย
                  </span>
                )}
              </div>

              {item.type === 'idea' && item.content && (
                <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap mt-1.5">
                  {typeof item.content === 'string' ? item.content : 'Rich text content...'}
                </p>
              )}

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

                  {/* Tone picker */}
                  {onSetColor && tonePresets.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Tone</p>
                        <div className="flex flex-col gap-0.5">
                          {tonePresets.map((t) => (
                            <button
                              key={t.id}
                              className={cn(
                                "flex items-center gap-2 px-1.5 py-1 rounded text-xs text-left transition-colors hover:bg-muted",
                                item.color === t.color && "bg-muted font-medium"
                              )}
                              onClick={(e) => { e.stopPropagation(); onSetColor(t.color); }}
                            >
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                              <span className="flex-1 truncate">{t.label}</span>
                              {item.color === t.color && <Check className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            </button>
                          ))}
                          {item.color && (
                            <button
                              className="flex items-center gap-2 px-1.5 py-1 rounded text-xs text-muted-foreground hover:bg-muted transition-colors"
                              onClick={(e) => { e.stopPropagation(); onSetColor(null); }}
                            >
                              <X className="h-2.5 w-2.5 shrink-0" />
                              ล้าง tone
                            </button>
                          )}
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
        </div>
      </Card>

    </div>
  );
}