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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Save, ZoomIn, ZoomOut, Maximize2, Link2, X, Check } from "lucide-react";
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
    zoom
}: {
    children: React.ReactNode;
    onCanvasRefChange: (element: HTMLDivElement | null) => void;
    items: any[];
    zoom: number;
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
            className="absolute inset-0 w-full h-full transition-colors border-4 border-transparent"
            style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                touchAction: 'none'
            }}
        >
            <div
                style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: `${100 / zoom}%`,
                    height: `${100 / zoom}%`,
                    position: 'relative'
                }}
            >
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
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

    const canvasRef = useRef<HTMLDivElement>(null);
    const isFirstMount = useRef(true);

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
            setItems((prev) =>
                prev.map((item) => {
                    if (item.id === activeData.id) {
                        return {
                            ...item,
                            x: Math.max(0, item.x + delta.x / zoom),
                            y: Math.max(0, item.y + delta.y / zoom),
                        };
                    }
                    return item;
                })
            );
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

                // Adjust for zoom level
                x = Math.max(0, (dropX - rect.left - 100) / zoom);
                y = Math.max(0, (dropY - rect.top - 40) / zoom);
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

    const handleRemoveItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
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
                    <DroppableCanvas onCanvasRefChange={handleCanvasRefChange} items={items} zoom={zoom}>
                        {items.map((item) => (
                            <DraggableCanvasItem
                                key={item.id}
                                item={item}
                                onRemove={() => handleRemoveItem(item.id)}
                                onRemoveChild={(childId) => handleRemoveChild(item.id, childId)}
                                onLinkStart={handleStartLink}
                                onLinkComplete={linkingSourceId && linkingSourceId !== item.id ? handleCompleteLink : undefined}
                                isLinkingSource={linkingSourceId === item.id}
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
        </DndContext>
    );
}