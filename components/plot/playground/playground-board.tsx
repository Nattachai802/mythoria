"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    useDroppable,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    pointerWithin,
    DragOverlay,
} from "@dnd-kit/core";
import { ResourceSidebar } from "./resource-sidebar";
import { CanvasItem, DraggableCanvasItem } from "./canvas-item";
import { updateTimelineCanvas } from "@/server/timeline";
import { updateIdea } from "@/server/idea"; // For auto-reset isUsed flag
import { getSceneElementDetails } from "@/server/scene-element-details";
import { SceneElementDetailDialog } from "./scene-element-detail-dialog";
import { IdeaNoteDialog } from "./idea-note-dialog";
import { SceneElementDetails } from "@/db/schema";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Save, ZoomIn, ZoomOut, Maximize2, Link2, X, Check, Move } from "lucide-react";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";

interface PlaygroundBoardProps {
    eventId: string;
    novelId: string;
    initialItems: any[];
    characters: any[];
    locations: any[];
    ideas: any[];
}

function ConnectionLine({ start, end }: { start: { x: number; y: number }; end: { x: number; y: number } }) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    const shorten = 60;

    if (length < shorten * 2) return null;

    const sX = start.x + Math.cos(angle) * shorten;
    const sY = start.y + Math.sin(angle) * shorten;
    const eX = end.x - Math.cos(angle) * shorten;
    const eY = end.y - Math.sin(angle) * shorten;

    return (
        <g>
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
            </defs>
            <line
                x1={sX}
                y1={sY}
                x2={eX}
                y2={eY}
                stroke="#94a3b8"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                strokeDasharray="5,5"
            />
        </g>
    );
}

function DroppableCanvas({
    children,
    onCanvasRefChange,
    items,
    zoom,
    panOffset,
    isPanning,
    onMouseDown,
    onMouseMove,
    onMouseUp,
}: {
    children: React.ReactNode;
    onCanvasRefChange: (element: HTMLDivElement | null) => void;
    items: any[];
    zoom: number;
    panOffset: { x: number; y: number };
    isPanning: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
}) {
    const { setNodeRef } = useDroppable({
        id: "canvas-droppable",
    });

    // Combine refs
    const combinedRef = useCallback((element: HTMLDivElement | null) => {
        setNodeRef(element);
        onCanvasRefChange(element);
    }, [setNodeRef, onCanvasRefChange]);

    // Render connections
    const connections = items.flatMap(source =>
        (source.links || []).map((targetId: string) => {
            const target = items.find(i => i.id === targetId);
            if (!target) return null;

            // Calculate centers
            // Card width ~256px, height variable but let's assume ~100px middle
            const start = { x: source.x + (source.type === 'idea' ? 160 : 128), y: source.y + (source.type === 'idea' ? 100 : 50) };
            const end = { x: target.x + (target.type === 'idea' ? 160 : 128), y: target.y + (target.type === 'idea' ? 100 : 50) };

            return <ConnectionLine key={`${source.id}-${target.id}`} start={start} end={end} />;
        })
    );

    return (
        <div
            id="canvas-area"
            ref={combinedRef}
            className={`absolute inset-0 w-full h-full transition-colors border-4 border-transparent ${isPanning ? 'cursor-grabbing' : ''}`}
            style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                backgroundPosition: `${panOffset.x}px ${panOffset.y}px`,
                touchAction: 'none',
                overflow: 'hidden'
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
        >
            <div
                style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                    transformOrigin: 'top left',
                    position: 'relative',
                    minWidth: '5000px',
                    minHeight: '5000px',
                }}
            >
                <svg
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '5000px',
                        height: '5000px',
                        pointerEvents: 'none',
                        zIndex: 0,
                        overflow: 'visible'
                    }}
                >
                    {connections}
                </svg>
                {children}
            </div>
        </div>
    );
}

export function PlaygroundBoard({
    eventId,
    novelId,
    initialItems,
    characters,
    locations,
    ideas,
}: PlaygroundBoardProps) {
    const [items, setItems] = useState<any[]>(initialItems);
    const [activeDragItem, setActiveDragItem] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);

    // Scene element details state
    const [elementDetailsMap, setElementDetailsMap] = useState<Map<string, SceneElementDetails>>(new Map());
    const [editingChild, setEditingChild] = useState<{
        child: any;
        canvasItemId: string;
    } | null>(null);

    // Idea notes state
    const [ideaNotes, setIdeaNotes] = useState<SceneElementDetails[]>([]);
    const [editingNote, setEditingNote] = useState<{
        item: any;
        existingNote?: SceneElementDetails;
    } | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const isFirstMount = useRef(true);

    // Pan state for mouse drag
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const panOffsetStartRef = useRef({ x: 0, y: 0 });

    // Handle mouse pan - middle mouse OR left click on empty canvas
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        // Middle mouse button (button === 1) - always pan
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
            panOffsetStartRef.current = { ...panOffset };
            return;
        }

        // Left click (button === 0) - only on canvas background
        if (e.button === 0) {
            // Check if clicking on a card/item (should not pan)
            const isClickOnItem = target.closest('[data-canvas-item]') !== null;
            // Check if within canvas area
            const isInCanvas = target.closest('#canvas-area') !== null;

            console.log('[Pan Debug]', { isInCanvas, isClickOnItem, tagName: target.tagName });

            if (isInCanvas && !isClickOnItem) {
                e.preventDefault();
                console.log('[Pan Debug] Starting left click pan');
                setIsPanning(true);
                panStartRef.current = { x: e.clientX, y: e.clientY };
                panOffsetStartRef.current = { ...panOffset };
            }
        }
    }, [panOffset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;

        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;

        setPanOffset({
            x: panOffsetStartRef.current.x + dx,
            y: panOffsetStartRef.current.y + dy,
        });
    }, [isPanning]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        // Stop panning for both left (0) and middle (1) mouse buttons
        if (e.button === 0 || e.button === 1) {
            setIsPanning(false);
        }
    }, []);

    // Reset pan
    const handleResetPan = useCallback(() => {
        setPanOffset({ x: 0, y: 0 });
    }, []);

    // Sync initialItems when eventId changes (but not on every render)
    useEffect(() => {
        setItems(initialItems);
        isFirstMount.current = true; // Reset first mount flag
    }, [eventId]); // Only when eventId changes, not initialItems

    // Fetch element details on mount
    useEffect(() => {
        const fetchDetails = async () => {
            const result = await getSceneElementDetails(eventId);
            if (result.success && result.data) {
                const map = new Map<string, SceneElementDetails>();
                const notes: SceneElementDetails[] = [];

                result.data.forEach(detail => {
                    if (detail.elementType === 'idea_note') {
                        notes.push(detail);
                    } else {
                        // Key: canvasItemId-elementType-elementId
                        const key = `${detail.canvasItemId}-${detail.elementType}-${detail.elementId}`;
                        map.set(key, detail);
                    }
                });

                setElementDetailsMap(map);
                setIdeaNotes(notes);
            }
        };
        fetchDetails();
    }, [eventId]);

    // Handler for when a detail is saved
    const handleDetailSaved = useCallback((detail: SceneElementDetails) => {
        if (detail.elementType === 'idea_note') {
            // Update idea notes
            setIdeaNotes(prev => {
                const existing = prev.findIndex(n => n.id === detail.id);
                if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = detail;
                    return updated;
                }
                return [...prev, detail];
            });
        } else {
            setElementDetailsMap(prev => {
                const newMap = new Map(prev);
                const key = `${detail.canvasItemId}-${detail.elementType}-${detail.elementId}`;
                newMap.set(key, detail);
                return newMap;
            });
        }
    }, []);

    // Handler for when a note is deleted
    const handleNoteDeleted = useCallback((id: string) => {
        setIdeaNotes(prev => prev.filter(n => n.id !== id));
    }, []);

    // Handler to open edit dialog for a child
    const handleEditChild = useCallback((child: any) => {
        setEditingChild({
            child,
            canvasItemId: child.canvasItemId,
        });
    }, []);

    // Handler to add/edit note on idea
    const handleAddNote = useCallback((item: any) => {
        // Check if editing existing note
        if (item.existingNoteId) {
            const existingNote = ideaNotes.find(n => n.id === item.existingNoteId);
            setEditingNote({ item, existingNote });
        } else {
            setEditingNote({ item });
        }
    }, [ideaNotes]);


    // Auto-save logic
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            const result = await updateTimelineCanvas(eventId, items);
            if (result.success) {
                setLastSaved(new Date());
            }
            setIsSaving(false);
        }, 2000); // Wait 2 seconds after last change

        return () => clearTimeout(timeoutId);
    }, [items, eventId]);

    // Keyboard shortcuts for zoom
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    handleZoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    handleZoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    handleZoomReset();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zoom]);

    // Linking Handlers
    const handleStartLink = (id: string) => {
        if (linkingSourceId === id) {
            setLinkingSourceId(null); // Toggle off
            toast.info("Linking mode cancelled");
        } else {
            setLinkingSourceId(id);
            toast.info("Linking mode: Click items to connect");
        }
    };

    const handleCompleteLink = (targetId: string) => {
        if (!linkingSourceId) return;
        if (linkingSourceId === targetId) return;

        setItems(prev => prev.map(item => {
            if (item.id === linkingSourceId) {
                const links = item.links || [];
                if (links.includes(targetId)) {
                    toast.info("Already connected");
                    return item;
                }
                toast.success("Connected!");
                return { ...item, links: [...links, targetId] };
            }
            return item;
        }));

        // DON'T reset linkingSourceId - stay in linking mode for one-to-many
    };

    const handleFinishLinking = () => {
        const sourceItem = items.find(i => i.id === linkingSourceId);
        const linkCount = sourceItem?.links?.length || 0;
        setLinkingSourceId(null);
        toast.success(`Linking complete! ${linkCount} connection${linkCount !== 1 ? 's' : ''} made.`);
    };

    const handleCancelLink = () => {
        setLinkingSourceId(null);
        toast.info("Linking cancelled");
    };

    const handleUnlink = (sourceId: string, targetId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === sourceId) {
                return { ...item, links: (item.links || []).filter((id: string) => id !== targetId) };
            }
            return item;
        }));
    };

    // Zoom handlers
    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.1, 2)); // Max 200%
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.1, 0.3)); // Min 30%
    };

    const handleZoomReset = () => {
        setZoom(1);
    };


    // Configure sensors for better drag experience
    // Disable drag when linking
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
                shouldActivate: (event: any) => !linkingSourceId && event.button === 0, // Only activate drag if not linking and left click
            },
        })
    );

    const handleRemoveChild = (parentId: string, childId: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === parentId) {
                return {
                    ...item,
                    children: (item.children || []).filter((c: any) => c.id !== childId)
                };
            }
            return item;
        }));
    };

    // Callback to receive canvas ref from child component
    const handleCanvasRefChange = useCallback((element: HTMLDivElement | null) => {
        canvasRef.current = element;
    }, []);

    const handleDragStart = (event: DragStartEvent) => {
        if (linkingSourceId) return; // Prevent drag if linking
        console.log("Drag started:", event.active.data.current);
        setActiveDragItem(event.active.data.current);
    };

    const handleDragOver = (event: DragOverEvent) => {
        // Optional: visual feedback during drag
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (linkingSourceId) return;

        const { active, over, delta, activatorEvent } = event;
        console.log("Drag ended:", { activeId: active.id, overId: over?.id });
        setActiveDragItem(null);

        const activeData = active.data.current as any;

        // Helper to check duplicates
        const isDuplicate = (parentItem: any, newItemRefId: string) => {
            return parentItem.children?.some((c: any) => c.referenceId === newItemRefId);
        };

        // --- CASE 1: Moving existing item on canvas (repositioning) ---
        if (activeData?.from === "canvas") {
            // Check if dropping INTO an Idea (that is not itself)
            if (over?.data?.current?.acceptDrops && over.id !== active.id) {
                // Prevent Idea nesting
                if (activeData.type === 'idea') {
                    toast.error("Ideas cannot be placed inside other Ideas");
                    return;
                }

                // Remove from root items and add to the target idea's children
                // Note: deeply nested logic would be recursive, here we assume 1 level depth for now or root->idea
                setItems(prev => {
                    const targetIdea = prev.find(i => i.id === over.id);
                    // Check duplicate for existing canvas item moving into idea
                    if (targetIdea && isDuplicate(targetIdea, activeData.referenceId)) {
                        toast.error("This item is already in this group");
                        return prev; // Do nothing
                    }

                    const activeItem = prev.find(i => i.id === active.id);
                    if (!activeItem) return prev; // Should be there if at root

                    // Clean up any links TO or FROM this item before moving it to child
                    // (optional policy: deleting links when nesting, or keeping them? deleting is safer for visuals)
                    // implemented implicitly by removing from root items list used for rendering connections

                    return prev.map(item => {
                        if (item.id === over.id) {
                            return {
                                ...item,
                                children: [...(item.children || []), activeItem]
                            }
                        }
                        return item;
                    }).filter(i => i.id !== active.id); // Remove from root
                });
                return;
            }

            // Otherwise, standard movement
            setItems((prev) => {
                const updated = prev.map((item) => {
                    if (item.id === activeData.id) {
                        const newX = Math.max(0, item.x + delta.x / zoom);
                        const newY = Math.max(0, item.y + delta.y / zoom);
                        console.log(`[Drag] Moving item ${item.id} from (${item.x}, ${item.y}) to (${newX}, ${newY})`);
                        return {
                            ...item,
                            x: newX,
                            y: newY,
                        };
                    }
                    return item;
                });
                console.log('[Drag] Updated items:', updated);
                return updated;
            });
            return;
        }


        // --- CASE 2: New item from Sidebar ---
        if (!over) {
            return;
        }

        // 2.1 Dropping new item INTO an Idea
        if (over.data.current?.acceptDrops) {
            // Prevent Idea nesting
            if (activeData.type === 'idea') {
                toast.error("Ideas cannot be placed inside other Ideas");
                return;
            }

            const incomingRefId = activeData.id; // from sidebar, id is the resource id

            setItems(prev => {
                const targetIdea = prev.find(i => i.id === over.id);
                // Check duplicate
                if (targetIdea && isDuplicate(targetIdea, incomingRefId)) {
                    toast.error("This item is already in this group");
                    return prev;
                }

                const newItem = {
                    id: crypto.randomUUID(),
                    type: activeData.type,
                    referenceId: incomingRefId,
                    title: activeData.title,
                    content: activeData.content,
                    // x,y irrelevant for children
                };

                return prev.map(item => {
                    if (item.id === over.id) {
                        return {
                            ...item,
                            children: [...(item.children || []), newItem]
                        }
                    }
                    return item;
                });
            });
            return;
        }

        // 2.2 Dropping new item ONTO Canvas
        if (over.id === "canvas-droppable") {
            let x = 100;
            let y = 100;

            if (canvasRef.current && activatorEvent instanceof PointerEvent) {
                const rect = canvasRef.current.getBoundingClientRect();
                const dropX = activatorEvent.clientX + delta.x;
                const dropY = activatorEvent.clientY + delta.y;

                // Adjust for zoom level AND pan offset
                // Formula: (mouse_pos - canvas_offset - pan_offset - card_center_adjustment) / zoom
                x = Math.max(0, (dropX - rect.left - panOffset.x - 100) / zoom);
                y = Math.max(0, (dropY - rect.top - panOffset.y - 40) / zoom);

                console.log('[Drop] Position calc:', {
                    mouseX: dropX,
                    mouseY: dropY,
                    canvasLeft: rect.left,
                    canvasTop: rect.top,
                    panOffsetX: panOffset.x,
                    panOffsetY: panOffset.y,
                    zoom,
                    finalX: x,
                    finalY: y
                });
            }

            const newItem = {
                id: crypto.randomUUID(),
                type: activeData.type,
                referenceId: activeData.id,
                title: activeData.title,
                x,
                y,
                content: activeData.content,
                children: [], // Initialize children array
                links: [] // Initialize links
            };

            setItems((prev) => [...prev, newItem]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateTimelineCanvas(eventId, items);
        if (result.success) {
            setLastSaved(new Date());
            toast.success("Saved canvas layout");
        } else {
            toast.error("Failed to save layout");
        }
        setIsSaving(false);
    };

    const handleRemoveItem = async (id: string) => {
        const removedItem = items.find(item => item.id === id);

        // Remove from canvas
        setItems((prev) => prev.filter((item) => item.id !== id));

        // If it's an idea, reset isUsed to false (undo feature)
        if (removedItem?.type === 'idea' && removedItem?.referenceId) {
            await updateIdea(removedItem.referenceId, {
                canvasX: null,
                canvasY: null,
                isUsed: false
            });
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full">
                {/* Sidebar */}
                <div className="w-60 border-r bg-muted/10 overflow-hidden flex flex-col">
                    <ResourceSidebar
                        characters={characters}
                        locations={locations}
                        ideas={ideas}
                    />
                </div>

                {/* Main Canvas Area */}
                <div className="flex-1 relative bg-slate-50 min-h-[400px]">
                    {/* Linking Mode Banner */}
                    {linkingSourceId && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-3 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg border-2 border-blue-600">
                                <Link2 className="w-4 h-4 animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Linking Mode Active</span>
                                    <span className="text-xs opacity-90">
                                        Click other items to connect ({items.find(i => i.id === linkingSourceId)?.links?.length || 0} linked)
                                    </span>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 bg-white/20 hover:bg-white/30 text-white border-0"
                                        onClick={handleFinishLinking}
                                    >
                                        <Check className="w-3.5 h-3.5 mr-1" />
                                        Done
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 bg-white/20 hover:bg-white/30 text-white border-0"
                                        onClick={handleCancelLink}
                                    >
                                        <X className="w-3.5 h-3.5 mr-1" />
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Right Controls */}
                    <div className="absolute top-4 right-4 z-50 pointer-events-none flex gap-2">
                        {/* Zoom Controls */}
                        <div className="pointer-events-auto flex items-center gap-1 bg-white/80 backdrop-blur border shadow-sm rounded-md p-1">
                            <Button
                                onClick={handleZoomOut}
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={zoom <= 0.3}
                                title="Zoom Out (Ctrl + -)">
                                <ZoomOut className="w-3.5 h-3.5" />
                            </Button>
                            <span className="text-xs font-medium px-2 min-w-[3rem] text-center">
                                {Math.round(zoom * 100)}%
                            </span>
                            <Button
                                onClick={handleZoomIn}
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={zoom >= 2}
                                title="Zoom In (Ctrl + +)">
                                <ZoomIn className="w-3.5 h-3.5" />
                            </Button>
                            <div className="h-4 w-px bg-border mx-1" />
                            <Button
                                onClick={handleZoomReset}
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Reset Zoom (Ctrl + 0)">
                                <Maximize2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                onClick={handleResetPan}
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Reset Pan (Middle mouse to pan)">
                                <Move className="w-3.5 h-3.5" />
                            </Button>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            size="sm"
                            variant="outline"
                            className="pointer-events-auto bg-white/80 backdrop-blur hover:bg-white text-foreground border shadow-sm transition-all text-xs"
                        >
                            <Save className={`w-3.5 h-3.5 mr-2 ${isSaving ? 'animate-pulse' : ''}`} />
                            {isSaving ? "Saving..." : lastSaved ? "All changes saved" : "Save Layout"}
                        </Button>
                    </div>

                    {/* Bottom Right FAB - Create Idea */}
                    <div className="absolute bottom-6 right-6 z-50 pointer-events-none">
                        <div className="pointer-events-auto">
                            <CreateIdeaDialog
                                novelId={novelId}
                                trigger={
                                    <Button size="icon" className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 bg-primary text-primary-foreground">
                                        <Plus className="w-6 h-6" />
                                    </Button>
                                }
                            />
                        </div>
                    </div>

                    {/* Droppable Canvas - useDroppable is now INSIDE DndContext */}
                    <DroppableCanvas
                        onCanvasRefChange={handleCanvasRefChange}
                        items={items}
                        zoom={zoom}
                        panOffset={panOffset}
                        isPanning={isPanning}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                        {items.map((item) => (
                            <DraggableCanvasItem
                                key={item.id}
                                item={item}
                                onRemove={() => handleRemoveItem(item.id)}
                                onRemoveChild={(childId) => handleRemoveChild(item.id, childId)}
                                onLinkStart={handleStartLink}
                                onLinkComplete={linkingSourceId && linkingSourceId !== item.id ? handleCompleteLink : undefined}
                                isLinkingSource={linkingSourceId === item.id}
                                elementDetails={elementDetailsMap}
                                onEditChild={handleEditChild}
                                ideaNotes={ideaNotes}
                                onAddNote={handleAddNote}
                                novelId={novelId}
                            />
                        ))}
                    </DroppableCanvas>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {activeDragItem ? (
                    <div
                        className="pointer-events-none"
                        style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top left'
                        }}
                    >
                        <CanvasItem item={activeDragItem} isOverlay />
                    </div>
                ) : null}
            </DragOverlay>

            {/* Scene Element Detail Edit Dialog */}
            {editingChild && (
                <SceneElementDetailDialog
                    open={!!editingChild}
                    onOpenChange={(open) => !open && setEditingChild(null)}
                    elementType={editingChild.child.type}
                    elementId={editingChild.child.referenceId || editingChild.child.refId || editingChild.child.id}
                    elementName={editingChild.child.title}
                    sceneId={eventId}
                    novelId={novelId}
                    canvasItemId={editingChild.canvasItemId}
                    existingDetail={elementDetailsMap.get(
                        `${editingChild.canvasItemId}-${editingChild.child.type}-${editingChild.child.referenceId || editingChild.child.refId || editingChild.child.id}`
                    )}
                    onSaved={handleDetailSaved}
                />
            )}

            {/* Idea Note Dialog */}
            {editingNote && (
                <IdeaNoteDialog
                    open={!!editingNote}
                    onOpenChange={(open) => !open && setEditingNote(null)}
                    ideaId={editingNote.item.referenceId || editingNote.item.id}
                    ideaTitle={editingNote.item.title}
                    canvasItemId={editingNote.item.id}
                    sceneId={eventId}
                    novelId={novelId}
                    existingNote={editingNote.existingNote}
                    onSaved={handleDetailSaved}
                    onDeleted={handleNoteDeleted}
                />
            )}
        </DndContext>
    );
}