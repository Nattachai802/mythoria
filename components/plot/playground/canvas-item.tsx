"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Lightbulb, X, Link as LinkIcon, Pencil, CheckCircle2, XCircle, Clock, StickyNote, Maximize2, Minimize2, ExternalLink, Copy, GitBranchPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { SceneElementDetails } from "@/db/schema";
import Link from "next/link";
import { toast } from "sonner";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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
  novelId,
  onSetAncestor,
  ancestorConnections,
  onRemoveAncestor,
}: {
  item: any;
  onRemove: () => void;
  onRemoveChild?: (id: string) => void;
  onLinkStart?: (id: string) => void;
  onLinkComplete?: (id: string) => void;
  isLinkingSource?: boolean;
  elementDetails?: Map<string, SceneElementDetails>;
  onEditChild?: (child: any) => void;
  ideaNotes?: SceneElementDetails[];
  onAddNote?: (item: any) => void;
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null; targetIdeaTitle?: string | null; targetIdeaContent?: string | null; targetIdeaCategory?: string | null; targetIdeaNotes?: string[] }>;
  onRemoveAncestor?: (connectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { ...item, from: 'canvas' },
    disabled: !!isLinkingSource // Disable dragging if this is the source of a link
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: item.id,
    disabled: item.type !== 'idea', // Only ideas can be containers
    data: { ...item, acceptDrops: true }
  });

  // Combine refs
  const setNodeRef = useCallback((node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);


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
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y,
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
        novelId={novelId}
        onSetAncestor={onSetAncestor}
        ancestorConnections={ancestorConnections}
        onRemoveAncestor={onRemoveAncestor}
      />
    </div>
  );
}

// Helper to get outcome icon
function OutcomeIcon({ outcome }: { outcome?: string | null }) {
  if (!outcome || outcome === "unknown") return null;
  if (outcome === "success") return <CheckCircle2 className="w-3 h-3 text-green-500" />;
  if (outcome === "failure") return <XCircle className="w-3 h-3 text-red-500" />;
  if (outcome === "ongoing") return <Clock className="w-3 h-3 text-yellow-500" />;
  return null;
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
  novelId,
  onSetAncestor,
  ancestorConnections,
  onRemoveAncestor,
}: {
  item: any;
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
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null; targetIdeaTitle?: string | null; targetIdeaContent?: string | null; targetIdeaCategory?: string | null; targetIdeaNotes?: string[] }>;
  onRemoveAncestor?: (connectionId: string) => void;
}) {
  // If use Sticky Note
  if (item.type === 'sticky-note') {
    console.log('[DEBUG] CanvasItem detected sticky-note:', item.id); // DEBUG
    return <StickyNoteItem item={item} onRemove={onRemove} isDragging={isDragging} isOverlay={isOverlay} />;
  }

  const [isExpanded, setIsExpanded] = useState(false);

  const Icon = () => {
    if (item.type === 'character') return <User className="w-4 h-4" />;
    if (item.type === 'location') return <MapPin className="w-4 h-4" />;
    return <Lightbulb className="w-4 h-4" />;
  }

  // Helper to get character role-based colors
  const getCharacterRoleColors = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'protagonist':
        return { icon: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' };
      case 'antagonist':
        return { icon: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
      case 'supporting':
        return { icon: 'text-green-400', bg: 'bg-green-50', border: 'border-green-200' };
      case 'minor':
      default:
        return { icon: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' };
    }
  };

  const colorClass =
    item.type === 'character' ? 'border-l-4 border-l-blue-500' :
      item.type === 'location' ? 'border-l-4 border-l-green-500' :
        'border-l-4 border-l-yellow-500';

  // If idea, maybe make it wider/bigger to imply container
  const isContainer = item.type === 'idea';

  // Width class based on card type and expanded state
  const getWidthClass = () => {
    if (isExpanded) return 'w-[450px]';
    if (isContainer) return 'w-80';
    return 'w-64';
  };
  const widthClass = getWidthClass();

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


  // Random slight rotation for pinned look
  const rotation = item.id ? (parseInt(item.id.slice(-2), 16) % 7) - 3 : 0;

  return (
    <div
      className="relative"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Tape effect on top */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-gradient-to-b from-amber-100/80 to-amber-200/60 rounded-sm shadow-sm z-10"
        style={{
          transform: `rotate(${-rotation + (rotation > 0 ? 2 : -2)}deg)`,
          backdropFilter: 'blur(1px)'
        }}
      />

      {/* Polaroid Card */}
      <Card className={`
          ${widthClass} bg-white shadow-xl ${colorClass} 
          ${isOverlay || isDragging ? 'cursor-grabbing scale-105' : ''} 
          ${isOver ? 'ring-2 ring-red-500 ring-offset-2' : ''} 
          ${isLinkingSource ? 'ring-2 ring-red-600 ring-offset-2' : ''}
          transition-all
          ${isDragging && !isOverlay ? 'opacity-0' : 'opacity-100'}
          border-4 border-white
      `}
        style={{
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2), 0 10px 15px -3px rgba(0,0,0,0.15), 0 2px 4px -1px rgba(0,0,0,0.1)'
        }}
      >
        <div className="p-3">
          <div className={`flex items-start gap-2 ${!isExpanded && item.type === 'idea' && item.content ? 'mb-2' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className={`flex items-center gap-2 ${!isExpanded && item.type === 'idea' && item.content ? 'mb-1' : ''}`}>
                <div className={`p-1 rounded-full ${isOverlay ? 'bg-background' : 'bg-muted'}`}>
                  <Icon />
                </div>
                <p className="font-semibold text-sm truncate">{item.title}</p>
              </div>

              {item.type === 'idea' && item.content && (
                <div className={`text-xs text-muted-foreground bg-muted/30 p-2 rounded ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
                  {typeof item.content === 'string' ? item.content : 'Rich text content...'}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 -mr-1 -mt-1">
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemove();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
              {onLinkStart && (
                <Button
                  variant={isLinkingSource ? "default" : "ghost"}
                  size="icon"
                  className={`h-6 w-6 shrink-0 ${isLinkingSource ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-muted-foreground hover:text-blue-500'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onLinkStart();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="Connect to..."
                >
                  <LinkIcon className="w-3 h-3" />
                </Button>
              )}
              {/* Add Note button for Ideas */}
              {isContainer && onAddNote && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-yellow-500 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onAddNote(item);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="เพิ่ม Note"
                >
                  <StickyNote className="w-3 h-3" />
                </Button>
              )}
              {/* Copy button for Ideas */}
              {isContainer && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-green-500 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    copyToClipboard();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="คัดลอกข้อมูล"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              )}
              {/* Set Ancestor button for Ideas */}
              {isContainer && onSetAncestor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-blue-500 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSetAncestor();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="เชื่อมเหตุผล (Ancestor Idea)"
                >
                  <GitBranchPlus className="w-3 h-3" />
                </Button>
              )}
              {/* Expand/Collapse button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                title={isExpanded ? "ย่อ" : "ขยาย"}
              >
                {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </Button>
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

          {/* Sticky Notes for Ideas */}
          {isContainer && thisIdeaNotes.length > 0 && (
            <div className="space-y-1 mb-2">
              {thisIdeaNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs cursor-pointer hover:bg-yellow-100 transition-colors group/note"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Click to edit existing note
                    if (onAddNote) {
                      onAddNote({ ...item, existingNoteId: note.id });
                    }
                  }}
                >
                  <div className="flex items-start gap-1">
                    <StickyNote className="w-3 h-3 text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-yellow-800 whitespace-pre-wrap line-clamp-3">{note.notes}</p>
                  </div>
                </div>
              ))}
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
          {isContainer && item.children && item.children.length > 0 && (
            <div className="space-y-3 pt-2 border-t mt-2 bg-muted/20 rounded p-2">

              {/* Characters Section */}
              {item.children.some((c: any) => c.type === 'character') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> Characters
                  </p>
                  {item.children
                    .filter((c: any) => c.type === 'character')
                    .map((child: any) => {
                      const detail = getChildDetail(child);
                      const hasDetail = detail && (detail.action || detail.how || detail.goal);
                      const roleColors = getCharacterRoleColors(child.role);
                      return (
                        <div key={child.id} className={`p-1.5 rounded border shadow-sm text-xs group/item ${roleColors.bg} ${roleColors.border}`}>
                          <div className="flex items-center gap-2">
                            <User className={`w-3 h-3 shrink-0 ${roleColors.icon}`} />
                            <span className="truncate flex-1 font-medium">{child.title}</span>
                            <OutcomeIcon outcome={detail?.outcome} />
                            {onEditChild && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditChild({ ...child, canvasItemId: item.id });
                                }}
                                className={`opacity-0 group-hover/item:opacity-100 hover:${roleColors.icon} transition-opacity`}
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
                                className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {hasDetail && (
                            <div className="mt-1 pl-5 text-[10px] text-muted-foreground space-y-0.5">
                              {detail.action && (
                                <p className="truncate">📌 {detail.action}{detail.how ? ` • ${detail.how}` : ''}</p>
                              )}
                              {detail.goal && (
                                <p className="truncate text-muted-foreground/70">🎯 {detail.goal}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Locations Section */}
              {item.children.some((c: any) => c.type === 'location') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-green-500/80 tracking-wider mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Locations
                  </p>
                  {item.children
                    .filter((c: any) => c.type === 'location')
                    .map((child: any) => {
                      const detail = getChildDetail(child);
                      const hasDetail = detail && (detail.action || detail.how || detail.goal);
                      return (
                        <div key={child.id} className="bg-background p-1.5 rounded border shadow-sm text-xs group/item">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                            <span className="truncate flex-1 font-medium">{child.title}</span>
                            <OutcomeIcon outcome={detail?.outcome} />
                            {onEditChild && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditChild({ ...child, canvasItemId: item.id });
                                }}
                                className="opacity-0 group-hover/item:opacity-100 hover:text-green-500 transition-opacity"
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
                                className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {hasDetail && (
                            <div className="mt-1 pl-5 text-[10px] text-muted-foreground space-y-0.5">
                              {detail.action && (
                                <p className="truncate">📌 {detail.action}{detail.how ? ` • ${detail.how}` : ''}</p>
                              )}
                              {detail.goal && (
                                <p className="truncate text-muted-foreground/70">🎯 {detail.goal}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Others Section (if any non-char/non-loc/non-sticky items get dropped) */}
              {item.children.some((c: any) => c.type !== 'character' && c.type !== 'location' && c.type !== 'sticky-note') && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Others</p>
                  {item.children
                    .filter((c: any) => c.type !== 'character' && c.type !== 'location' && c.type !== 'sticky-note')
                    .map((child: any) => (
                      <div key={child.id} className="flex items-center gap-2 bg-background p-1.5 rounded border shadow-sm text-xs group/item">
                        <Lightbulb className="w-3 h-3 text-yellow-500" />
                        <span className="truncate flex-1">{child.title}</span>
                        {onRemoveChild && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveChild(child.id);
                            }}
                            className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
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

      {/* Sticky Note Cards - แสดงข้างๆ card */}
      {isContainer && item.children?.filter((c: any) => c.type === 'sticky-note').length > 0 && (
        <div className="absolute -right-4 top-0 translate-x-full flex flex-col gap-3 pl-4 z-30">
          {item.children
            .filter((c: any) => c.type === 'sticky-note')
            .map((note: any, index: number) => (
              <div
                key={note.id}
                className="group relative"
                style={{
                  transform: `rotate(${(index % 3) * 2 - 2}deg)`
                }}
              >
                {/* Note Card */}
                <div
                  className="w-44 bg-purple-100 rounded shadow-lg border-2 border-purple-200 p-3"
                  style={{
                    boxShadow: '3px 4px 8px rgba(0,0,0,0.15)',
                    minHeight: '60px'
                  }}
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