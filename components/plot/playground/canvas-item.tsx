"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Lightbulb, X, Link as LinkIcon, Pencil, CheckCircle2, XCircle, Clock, StickyNote, Maximize2, Minimize2, ExternalLink, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { SceneElementDetails } from "@/db/schema";
import Link from "next/link";
import { toast } from "sonner";

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
}) {
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
      ?.filter((c: any) => c.type !== 'character' && c.type !== 'location')
      .map((c: any) => c.title)
      .join(', ') || '';

    // Get notes
    const notes = thisIdeaNotes
      .map((note: any) => note.notes)
      .join('\n') || '';

    // Build the structured text
    const content = typeof item.content === 'string' ? item.content : '';

    const clipboardText = `Title: ${item.title}
Desc: ${content}
Character: ${characters}
Other: ${locations}${others ? (locations ? ', ' : '') + others : ''}
Notes: ${notes}`;

    try {
      await navigator.clipboard.writeText(clipboardText);
      toast.success('คัดลอกข้อมูลแล้ว');
    } catch (err) {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  return (
    <Card className={`
        ${widthClass} shadow-lg ${colorClass} 
        ${isOverlay || isDragging ? 'cursor-grabbing scale-105 shadow-xl' : ''} 
        ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''} 
        ${isLinkingSource ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        transition-all
        ${isDragging && !isOverlay ? 'opacity-0' : 'opacity-100'}
    `}>
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

            {/* Others Section (if any non-char/non-loc items get dropped) */}
            {item.children.some((c: any) => c.type !== 'character' && c.type !== 'location') && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Others</p>
                {item.children
                  .filter((c: any) => c.type !== 'character' && c.type !== 'location')
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
  );
}