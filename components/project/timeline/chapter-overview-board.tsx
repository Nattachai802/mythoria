"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Navigation, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ----------------------------------------------------------------------
// Red String Connection (ด้ายแดงแบบนักสืบ)
// ----------------------------------------------------------------------
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

    // Create a slight droop in the middle (like real string)
    const midX = (sX + eX) / 2;
    const midY = (sY + eY) / 2 + Math.min(length * 0.1, 30); // Subtle droop

    // Quadratic bezier curve path
    const pathD = `M ${sX} ${sY} Q ${midX} ${midY}, ${eX} ${eY}`;

    return (
        <g>
            {/* Shadow for depth */}
            <path
                d={pathD}
                stroke="rgba(0,0,0,0.15)"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                style={{ filter: 'blur(2px)', transform: 'translate(2px, 2px)' }}
            />
            {/* Main red string */}
            <path
                d={pathD}
                stroke="#dc2626"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }}
            />
            {/* Highlight for texture */}
            <path
                d={pathD}
                stroke="rgba(255,120,120,0.4)"
                strokeWidth="1"
                fill="none"
                strokeLinecap="round"
                style={{ transform: 'translate(-0.5px, -0.5px)' }}
            />
            {/* Pin indicator at start */}
            <circle cx={sX} cy={sY} r="4" fill="#991b1b" stroke="#fca5a5" strokeWidth="1" />
            {/* Pin indicator at end */}
            <circle cx={eX} cy={eY} r="4" fill="#991b1b" stroke="#fca5a5" strokeWidth="1" />
        </g>
    );
}

// ----------------------------------------------------------------------
// Simple Read-Only Canvas Item (Polaroid Style)
// ----------------------------------------------------------------------
function SimpleCanvasItem({ item }: { item: any }) {
    // Random rotation logic from original CanvasItem
    // Use item.id to keep rotation consistent
    const rotation = item.id ? (parseInt(item.id.slice(-2), 16) % 7) - 3 : 0;

    const widthClass = item.type === 'idea' ? 'w-80' : 'w-64';
    const colorClass = item.type === 'idea'
        ? 'border-yellow-200 bg-yellow-50'
        : item.type === 'character'
            ? 'border-blue-200 bg-blue-50'
            : 'border-green-200 bg-green-50'; // location

    return (
        <div
            className="absolute select-none pointer-events-auto hover:z-50 transition-all duration-200 hover:scale-105"
            style={{
                left: item.x,
                top: item.y,
                transform: `rotate(${rotation}deg)`,
            }}
        >
            {/* Tape effect */}
            <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-gradient-to-b from-amber-100/80 to-amber-200/60 rounded-sm shadow-sm z-10"
                style={{
                    transform: `rotate(${-rotation + (rotation > 0 ? 2 : -2)}deg)`,
                    backdropFilter: 'blur(1px)'
                }}
            />

            {/* Polaroid Card */}
            <Card className={`
                ${widthClass} bg-white shadow-md ${colorClass}
                border-4 border-white
            `}
                style={{
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)'
                }}
            >
                <div className="p-3">
                    <div className="flex items-start gap-3">
                        {/* Avatar / Image */}
                        {(item.type === 'character' || item.type === 'location') && (
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm rounded-sm">
                                <AvatarImage src={item.image} alt={item.title} className="object-cover" />
                                <AvatarFallback className={`rounded-sm text-[10px] ${item.type === 'character' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                    {item.title?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        )}
                        {item.type === 'idea' && (
                            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0 border border-yellow-200">
                                <span className="text-lg">💡</span>
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm leading-tight text-slate-800 font-serif">
                                {item.title}
                            </h4>
                            {item.description && (
                                <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                    {item.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// ----------------------------------------------------------------------
// Main Board Component
// ----------------------------------------------------------------------
interface ChapterOverviewBoardProps {
    chapterTitle: string;
    events: any[];
}

export function ChapterOverviewBoard({ chapterTitle, events }: ChapterOverviewBoardProps) {
    const [zoom, setZoom] = useState(0.8);
    const [panOffset, setPanOffset] = useState({ x: 50, y: 50 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const panOffsetStartRef = useRef({ x: 0, y: 0 });

    const SCENE_GAP = 150;    // Gap between scenes
    const MIN_SCENE_WIDTH = 800; // Minimum width
    const MIN_SCENE_HEIGHT = 600; // Minimum height
    const ITEM_WIDTH = 320; // Approximate item width
    const ITEM_HEIGHT = 150; // Approximate item height
    const PADDING = 80; // Padding around items

    // Helper: Calculate bounding box of items
    const calculateBoundingBox = (items: any[]) => {
        if (!items || items.length === 0) {
            return { width: MIN_SCENE_WIDTH, height: MIN_SCENE_HEIGHT };
        }
        let maxX = 0;
        let maxY = 0;
        items.forEach((item: any) => {
            const itemRight = (item.x || 0) + ITEM_WIDTH + PADDING;
            const itemBottom = (item.y || 0) + ITEM_HEIGHT + PADDING;
            maxX = Math.max(maxX, itemRight);
            maxY = Math.max(maxY, itemBottom);
        });
        return {
            width: Math.max(maxX, MIN_SCENE_WIDTH),
            height: Math.max(maxY, MIN_SCENE_HEIGHT)
        };
    };

    // === Pan Logic ===
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0 || e.button === 1) { // Left or Middle click
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
            panOffsetStartRef.current = { ...panOffset };
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

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // === Zoom Logic ===
    const handleWheel = useCallback((e: React.WheelEvent) => {
        const delta = e.deltaY;
        const zoomFactor = 0.05;
        const direction = delta < 0 ? 1 : -1;
        setZoom(prev => Math.min(Math.max(prev + (direction * zoomFactor), 0.1), 2.0));
    }, []);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2.0));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));
    const handleZoomReset = () => {
        setZoom(0.8);
        setPanOffset({ x: 50, y: 50 });
    };

    // Helper: get center of item
    const getItemCenter = (item: any) => ({
        x: item.x + (item.type === 'idea' ? 160 : 128),
        y: item.y + (item.type === 'idea' ? 100 : 50)
    });

    // Export All Scenes
    const handleExportAll = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            chapterTitle,
            totalScenes: events.length,
            scenes: events.map((event, index) => {
                const elementDetails = (event as any).elementDetails || [];

                return {
                    sceneNumber: index + 1,
                    sceneId: event.id,
                    sceneTitle: event.title,
                    items: ((event.canvasData as any[]) || []).map(item => {
                        // Find element details (notes) directly on this item
                        const itemNotes = elementDetails.filter(
                            (d: any) => d.canvasItemId === item.id || d.elementId === item.id
                        );

                        return {
                            id: item.id,
                            type: item.type,
                            title: item.title,
                            content: item.content,
                            x: item.x,
                            y: item.y,
                            links: item.links,
                            notes: itemNotes.length > 0 ? itemNotes.map((n: any) => ({
                                id: n.id,
                                elementType: n.elementType,
                                action: n.action,
                                how: n.how,
                                goal: n.goal,
                                outcome: n.outcome,
                                notes: n.notes,
                            })) : undefined,
                            children: item.children?.map((child: any) => {
                                // Find notes for this child element
                                const childNotes = elementDetails.filter(
                                    (d: any) => d.canvasItemId === child.id ||
                                        (d.elementId === child.referenceId && d.canvasItemId === item.id)
                                );

                                return {
                                    id: child.id,
                                    type: child.type,
                                    title: child.title,
                                    content: child.content,
                                    referenceId: child.referenceId,
                                    notes: childNotes.length > 0 ? childNotes.map((n: any) => ({
                                        id: n.id,
                                        elementType: n.elementType,
                                        action: n.action,
                                        how: n.how,
                                        goal: n.goal,
                                        outcome: n.outcome,
                                        notes: n.notes,
                                    })) : undefined,
                                };
                            })
                        };
                    }),
                    // Standalone idea_notes for the scene
                    ideaNotes: elementDetails
                        .filter((d: any) => d.elementType === 'idea_note')
                        .map((n: any) => ({
                            id: n.id,
                            canvasItemId: n.canvasItemId,
                            elementId: n.elementId,
                            action: n.action,
                            how: n.how,
                            goal: n.goal,
                            outcome: n.outcome,
                            notes: n.notes,
                        })),
                };
            })
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Sanitize filename
        const safeTitle = chapterTitle.replace(/[^a-zA-Z0-9ก-๙]/g, '_').substring(0, 50);
        a.download = `chapter-${safeTitle}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Export สำเร็จ! (${events.length} scenes)`);
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-stone-100 flex flex-col font-sans">
            {/* Header / Info */}
            <div className="absolute top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur border-b z-50 flex items-center px-6 justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <h2 className="font-bold text-lg text-slate-800">
                        🎬 {chapterTitle} : Overview
                    </h2>
                    <Badge variant="outline" className="text-xs font-normal">
                        {events.length} Scenes
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">Use wheel to zoom, drag to pan</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportAll}
                        className="flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export All
                    </Button>
                </div>
            </div>

            {/* Canvas Area */}
            <div
                id="overview-canvas"
                className={`flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden`}
                style={{
                    backgroundColor: '#e5e5e5', // Neutral grey background
                    backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <div
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    {/* Render Scenes as a Strip */}
                    <div className="flex" style={{ gap: SCENE_GAP }}>
                        {events.map((event, index) => {
                            const items = (event.canvasData as any[]) || [];
                            const { width: sceneWidth, height: sceneHeight } = calculateBoundingBox(items);

                            // Build connections from items' links
                            const connections = items.flatMap((source: any) =>
                                (source.links || []).map((targetId: string) => {
                                    const target = items.find((i: any) => i.id === targetId);
                                    if (!target) return null;
                                    const start = getItemCenter(source);
                                    const end = getItemCenter(target);
                                    return { key: `${source.id}-${target.id}`, start, end };
                                }).filter(Boolean)
                            );

                            return (
                                <div
                                    key={event.id}
                                    className="relative flex-shrink-0 bg-white border-2 border-slate-300 shadow-xl rounded-lg group hover:border-slate-400 transition-colors"
                                    style={{
                                        width: sceneWidth,
                                        height: sceneHeight,
                                        minWidth: MIN_SCENE_WIDTH,
                                        minHeight: MIN_SCENE_HEIGHT
                                    }}
                                >
                                    {/* Scene Header */}
                                    <div className="absolute top-0 left-0 right-0 bg-slate-100 border-b p-3 flex justify-between items-center z-10">
                                        <div className="font-bold text-slate-700">
                                            <span className="text-slate-400 mr-2">#{index + 1}</span>
                                            {event.title}
                                        </div>
                                    </div>

                                    {/* Canvas Items Area */}
                                    <div className="relative w-full h-full mt-10">
                                        {/* Connection Lines SVG */}
                                        <svg
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                pointerEvents: 'none',
                                                zIndex: 0,
                                                overflow: 'visible'
                                            }}
                                        >
                                            {connections.map((conn: any) => (
                                                <ConnectionLine key={conn.key} start={conn.start} end={conn.end} />
                                            ))}
                                        </svg>

                                        {items.length === 0 ? (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-lg font-serif italic">
                                                Empty Scene
                                            </div>
                                        ) : (
                                            items.map((item: any) => (
                                                <SimpleCanvasItem key={item.id} item={item} />
                                            ))
                                        )}
                                    </div>

                                    {/* Scene Footer / Number */}
                                    <div className="absolute bottom-2 right-4 text-9xl font-bold text-slate-100 pointer-events-none select-none">
                                        {index + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Controls (Bottom Right) */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-50">
                <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-1 flex flex-col gap-1">
                    <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In"><ZoomIn className="w-4 h-4" /></Button>
                    <div className="text-center text-[10px] font-medium text-slate-500">{Math.round(zoom * 100)}%</div>
                    <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out"><ZoomOut className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={handleZoomReset} title="Reset View"><Navigation className="w-4 h-4" /></Button>
                </div>
            </div>
        </div>
    );
}
