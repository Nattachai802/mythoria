"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, MapPin, Lightbulb, X, Link as LinkIcon } from "lucide-react";
import { useCallback } from "react";

// For items already on the canvas (moveable)
export function DraggableCanvasItem({
  item,
  onRemove,
  onRemoveChild,
  onLinkStart,
  onLinkComplete,
  isLinkingSource
}: {
  item: any;
  onRemove: () => void;
  onRemoveChild?: (id: string) => void;
  onLinkStart?: (id: string) => void;
  onLinkComplete?: (id: string) => void;
  isLinkingSource?: boolean;
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
      />
    </div>
  );
}

// The Visual Representation (used for both Canvas and DragOverlay)
export function CanvasItem({ item, onRemove, onRemoveChild, isDragging, isOverlay, isOver, isLinkingSource, onLinkStart }: any) {
  const Icon = () => {
    if (item.type === 'character') return <User className="w-4 h-4" />;
    if (item.type === 'location') return <MapPin className="w-4 h-4" />;
    return <Lightbulb className="w-4 h-4" />;
  }

  const colorClass =
    item.type === 'character' ? 'border-l-4 border-l-blue-500' :
      item.type === 'location' ? 'border-l-4 border-l-green-500' :
        'border-l-4 border-l-yellow-500';

  // If idea, maybe make it wider/bigger to imply container
  const isContainer = item.type === 'idea';
  const widthClass = isContainer ? 'w-80' : 'w-64';

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
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1 rounded-full ${isOverlay ? 'bg-background' : 'bg-muted'}`}>
                <Icon />
              </div>
              <p className="font-semibold text-sm truncate">{item.title}</p>
            </div>

            {item.type === 'idea' && item.content && (
              <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/30 p-2 rounded mb-2">
                {typeof item.content === 'string' ? item.content : 'Rich text content...'}
              </p>
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
          </div>
        </div>

        {/* Children Area for Ideas */}
        {isContainer && item.children && item.children.length > 0 && (
          <div className="space-y-3 pt-2 border-t mt-2 bg-muted/20 rounded p-2">

            {/* Characters Section */}
            {item.children.some((c: any) => c.type === 'character') && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-blue-500/80 tracking-wider mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Characters
                </p>
                {item.children
                  .filter((c: any) => c.type === 'character')
                  .map((child: any) => (
                    <div key={child.id} className="flex items-center gap-2 bg-background p-1.5 rounded border shadow-sm text-xs group/item">
                      <User className="w-3 h-3 text-blue-500" />
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

            {/* Locations Section */}
            {item.children.some((c: any) => c.type === 'location') && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-green-500/80 tracking-wider mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Locations
                </p>
                {item.children
                  .filter((c: any) => c.type === 'location')
                  .map((child: any) => (
                    <div key={child.id} className="flex items-center gap-2 bg-background p-1.5 rounded border shadow-sm text-xs group/item">
                      <MapPin className="w-3 h-3 text-green-500" />
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