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
import { GroupFrame, CanvasGroup } from "./group-frame";
import { updateTimelineCanvas } from "@/server/timeline";
import { updateIdea } from "@/server/idea"; // For auto-reset isUsed flag
import { getSceneElementDetails, getIdeaNotesForIdeas } from "@/server/scene-element-details";
import { SceneElementDetailDialog } from "./scene-element-detail-dialog";
import { IdeaNoteDialog } from "./idea-note-dialog";
import { SceneElementDetails } from "@/db/schema";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save, ZoomIn, ZoomOut, Maximize2, Link2, X, Check, Move, Download, List, Navigation, SkipBack, SkipForward, StickyNote, GitBranchPlus, Lightbulb, Group, Loader2 } from "lucide-react";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PlaygroundBoardProps {
    eventId: string;
    novelId: string;
    initialItems: any[];
    characters: any[];
    locations: any[];
    ideas: any[];
}

// Red String Connection (ด้ายแดงแบบนักสืบ)
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

// Ancestor Connection Line (เส้นประสีน้ำเงิน + ลูกศร = "ทำไมถึงทำแบบนี้")
function AncestorConnectionLine({ start, end, label }: { start: { x: number; y: number }; end: { x: number; y: number }; label?: string | null }) {
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

    // Arrowhead at source (pointing from ancestor TO this idea)
    const arrowSize = 10;
    const arrowAngle = Math.PI / 7;
    const arrowX1 = sX - arrowSize * Math.cos(angle - arrowAngle);
    const arrowY1 = sY - arrowSize * Math.sin(angle - arrowAngle);
    const arrowX2 = sX - arrowSize * Math.cos(angle + arrowAngle);
    const arrowY2 = sY - arrowSize * Math.sin(angle + arrowAngle);

    // Label position
    const labelX = (sX + eX) / 2;
    const labelY = (sY + eY) / 2 - 10;

    return (
        <g>
            {/* Dashed blue line */}
            <line
                x1={sX} y1={sY}
                x2={eX} y2={eY}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="8,4"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(59,130,246,0.3))' }}
            />
            {/* Arrow at source end */}
            <polygon
                points={`${sX},${sY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
                fill="#3b82f6"
            />
            {/* Pin at ancestor end (target) */}
            <circle cx={eX} cy={eY} r="4" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1" />
            {/* Label */}
            {label && (
                <g>
                    <rect
                        x={labelX - (label.length * 3.5)}
                        y={labelY - 8}
                        width={label.length * 7}
                        height={16}
                        rx="4"
                        fill="white"
                        stroke="#93c5fd"
                        strokeWidth="1"
                        opacity="0.9"
                    />
                    <text
                        x={labelX}
                        y={labelY + 3}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#2563eb"
                        fontWeight="500"
                    >
                        {label}
                    </text>
                </g>
            )}
        </g>
    );
}

function DroppableCanvas({
    children,
    onCanvasRefChange,
    items,
    ancestorConnections,
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
    ancestorConnections: Array<{ id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null }>;
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

    // Render Red String connections
    const connections = items.flatMap(source =>
        (source.links || []).map((targetId: string) => {
            const target = items.find(i => i.id === targetId);
            if (!target) return null;

            // Calculate centers
            const start = { x: source.x + (source.type === 'idea' ? 160 : 128), y: source.y + (source.type === 'idea' ? 100 : 50) };
            const end = { x: target.x + (target.type === 'idea' ? 160 : 128), y: target.y + (target.type === 'idea' ? 100 : 50) };

            return <ConnectionLine key={`${source.id}-${target.id}`} start={start} end={end} />;
        })
    );

    // Render Ancestor connections (blue dashed lines)
    const ancestorLines = ancestorConnections.map(conn => {
        const source = items.find(i => i.referenceId === conn.sourceIdeaId || i.id === conn.sourceIdeaId);
        const target = items.find(i => i.referenceId === conn.targetIdeaId || i.id === conn.targetIdeaId);
        if (!source || !target) return null;

        const start = { x: source.x + (source.type === 'idea' ? 160 : 128), y: source.y + (source.type === 'idea' ? 100 : 50) };
        const end = { x: target.x + (target.type === 'idea' ? 160 : 128), y: target.y + (target.type === 'idea' ? 100 : 50) };

        return <AncestorConnectionLine key={`ancestor-${conn.id}`} start={start} end={end} label={conn.label} />;
    });

    return (
        <div
            id="canvas-area"
            ref={combinedRef}
            className={`absolute inset-0 w-full h-full transition-colors border-4 border-transparent ${isPanning ? 'cursor-grabbing' : ''}`}
            style={{
                // Corkboard texture background
                backgroundColor: '#b8956c',
                backgroundImage: `
                    radial-gradient(ellipse at 20% 30%, rgba(139,90,43,0.3) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 70%, rgba(160,120,60,0.2) 0%, transparent 40%),
                    radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.05) 0%, transparent 70%),
                    repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 2px,
                        rgba(101,67,33,0.1) 2px,
                        rgba(101,67,33,0.1) 4px
                    ),
                    repeating-linear-gradient(
                        -45deg,
                        transparent,
                        transparent 2px,
                        rgba(139,90,43,0.08) 2px,
                        rgba(139,90,43,0.08) 4px
                    )
                `,
                backgroundSize: '100% 100%, 100% 100%, 100% 100%, 8px 8px, 8px 8px',
                touchAction: 'none',
                overflow: 'hidden',
                // Subtle inner shadow for depth
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.15)'
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
                    {ancestorLines}
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
    const [items, setItems] = useState<any[]>(initialItems.filter((i: any) => i.type !== 'group'));
    const [groups, setGroups] = useState<CanvasGroup[]>(
        initialItems.filter((i: any) => i.type === 'group').map((g: any) => ({
            id: g.id,
            type: 'group' as const,
            label: g.label || g.title || 'Group',
            color: g.color || '#3B82F6',
            x: g.x || 0,
            y: g.y || 0,
            width: g.width || 500,
            height: g.height || 350,
        }))
    );
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

    // Ancestor connections state
    const [ancestorConnections, setAncestorConnections] = useState<Array<{
        id: string;
        sourceIdeaId: string;
        targetIdeaId: string;
        label?: string | null;
    }>>([]);
    const [ancestorDialogItem, setAncestorDialogItem] = useState<any | null>(null); // Which idea is setting ancestor
    const [ancestorSearch, setAncestorSearch] = useState('');
    const [ancestorLabel, setAncestorLabel] = useState('');
    const [ancestorIdeaNotesMap, setAncestorIdeaNotesMap] = useState<Map<string, string[]>>(new Map());

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

    const handleResetPan = useCallback(() => {
        setPanOffset({ x: 0, y: 0 });
    }, []);

    const handleAddStickyNote = useCallback(() => {
        // คำนวณตำแหน่งกลางจอของ user ใน world space
        // สูตร: worldX = (viewportCenter - panOffset) / zoom
        const container = canvasRef.current?.parentElement;
        const viewportWidth = container?.clientWidth ?? 800;
        const viewportHeight = container?.clientHeight ?? 600;

        const centerX = (viewportWidth / 2 - panOffset.x) / zoom;
        const centerY = (viewportHeight / 2 - panOffset.y) / zoom;

        // offset เล็กน้อยเพื่อกัน note ซ้อนกันเวลากดหลายครั้ง
        const jitter = () => (Math.random() - 0.5) * 60;

        const newNote = {
            id: crypto.randomUUID(),
            type: 'sticky-note',
            title: 'Note',
            content: '',
            x: Math.round(centerX + jitter()),
            y: Math.round(centerY + jitter()),
            links: []
        };

        setItems(prev => [...prev, newNote]);
        toast.success("Sticky Note added!");
    }, [panOffset, zoom]);

    // Add Group handler
    const handleAddGroup = useCallback(() => {
        const container = canvasRef.current?.parentElement;
        const viewportWidth = container?.clientWidth ?? 800;
        const viewportHeight = container?.clientHeight ?? 600;

        const centerX = (viewportWidth / 2 - panOffset.x) / zoom;
        const centerY = (viewportHeight / 2 - panOffset.y) / zoom;

        const newGroup: CanvasGroup = {
            id: crypto.randomUUID(),
            type: 'group',
            label: 'New Group',
            color: '#3B82F6',
            x: Math.round(centerX - 250),
            y: Math.round(centerY - 175),
            width: 500,
            height: 350,
        };

        setGroups(prev => [...prev, newGroup]);
        toast.success('Group created!');
    }, [panOffset, zoom]);

    // Update Group handler
    const handleUpdateGroup = useCallback((id: string, updates: Partial<CanvasGroup>) => {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    }, []);

    // Remove Group handler
    const handleRemoveGroup = useCallback((id: string) => {
        setGroups(prev => prev.filter(g => g.id !== id));
        toast.success('Group removed');
    }, []);

    // Sync initialItems when eventId changes (but not on every render)
    useEffect(() => {
        setItems(initialItems.filter((i: any) => i.type !== 'group'));
        setGroups(
            initialItems.filter((i: any) => i.type === 'group').map((g: any) => ({
                id: g.id,
                type: 'group' as const,
                label: g.label || g.title || 'Group',
                color: g.color || '#3B82F6',
                x: g.x || 0,
                y: g.y || 0,
                width: g.width || 500,
                height: g.height || 350,
            }))
        );
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

    // Fetch ancestor connections on mount
    useEffect(() => {
        const fetchAncestorConnections = async () => {
            const { getAncestorConnectionsByNovelId } = await import('@/server/idea');
            const result = await getAncestorConnectionsByNovelId(novelId);
            if (result.success && result.data) {
                setAncestorConnections(result.data.map(c => ({
                    id: c.id,
                    sourceIdeaId: c.sourceIdeaId,
                    targetIdeaId: c.targetIdeaId,
                    label: c.label,
                })));
            }
        };
        fetchAncestorConnections();
    }, [novelId]);

    // Fetch ancestor idea notes (cross-scene) when connections change
    useEffect(() => {
        const targetIds = [...new Set(ancestorConnections.map(c => c.targetIdeaId))];
        if (targetIds.length === 0) {
            setAncestorIdeaNotesMap(new Map());
            return;
        }
        const fetchNotes = async () => {
            const result = await getIdeaNotesForIdeas(novelId, targetIds);
            if (result.success && result.data) {
                setAncestorIdeaNotesMap(result.data);
            }
        };
        fetchNotes();
    }, [ancestorConnections, novelId]);

    // Handler to open ancestor dialog for an idea
    const handleOpenAncestorDialog = useCallback((item: any) => {
        setAncestorDialogItem(item);
        setAncestorSearch('');
        setAncestorLabel('');
    }, []);

    // Handler to create ancestor connection
    const handleCreateAncestor = useCallback(async (ancestorIdeaId: string) => {
        if (!ancestorDialogItem) return;
        const sourceIdeaId = ancestorDialogItem.referenceId || ancestorDialogItem.id;

        const { createIdeaConnection } = await import('@/server/idea');
        const result = await createIdeaConnection({
            sourceIdeaId: sourceIdeaId,
            targetIdeaId: ancestorIdeaId,
            novelId: novelId,
            connectionType: 'ancestor',
            label: ancestorLabel || undefined,
        });

        if (result.success && result.data) {
            setAncestorConnections(prev => [...prev, {
                id: result.data.id,
                sourceIdeaId: result.data.sourceIdeaId,
                targetIdeaId: result.data.targetIdeaId,
                label: result.data.label,
            }]);
            toast.success('เชื่อมเหตุผลสำเร็จ!');
            setAncestorDialogItem(null);
        } else {
            toast.error('ไม่สามารถเชื่อมได้');
        }
    }, [ancestorDialogItem, novelId, ancestorLabel]);

    // Handler to remove ancestor connection
    const handleRemoveAncestor = useCallback(async (connectionId: string) => {
        const { deleteIdeaConnection } = await import('@/server/idea');
        const result = await deleteIdeaConnection(connectionId);
        if (result.success) {
            setAncestorConnections(prev => prev.filter(c => c.id !== connectionId));
            toast.success('ลบเหตุผลสำเร็จ');
        }
    }, []);
    // Auto-save logic (items + groups together)
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            // Merge items and groups into a single array for saving
            const allCanvasData = [...items, ...groups];
            const result = await updateTimelineCanvas(eventId, allCanvasData);
            if (result.success) {
                setLastSaved(new Date());
            }
            setIsSaving(false);
        }, 2000); // Wait 2 seconds after last change

        return () => clearTimeout(timeoutId);
    }, [items, groups, eventId]);

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

        setItems(prev => {
            const sourceItem = prev.find(i => i.id === linkingSourceId);
            const targetItem = prev.find(i => i.id === targetId);

            // Check if already connected
            if (sourceItem?.links?.includes(targetId)) {
                toast.info("Already connected");
                return prev;
            }

            // Get children to copy (characters + others, NOT locations or sticky-notes)
            const childrenToCopy = (sourceItem?.children || [])
                .filter((c: any) => c.type !== 'location' && c.type !== 'sticky-note')
                .map((c: any) => ({
                    ...c,
                    id: crypto.randomUUID(), // Generate new ID to avoid conflicts
                }));

            // Filter out duplicates (same referenceId already exists in target)
            const existingRefIds = new Set(
                (targetItem?.children || []).map((c: any) => c.referenceId)
            );
            const newChildren = childrenToCopy.filter(
                (c: any) => !existingRefIds.has(c.referenceId)
            );

            const copiedCount = newChildren.length;

            return prev.map(item => {
                // Update source with new link
                if (item.id === linkingSourceId) {
                    return { ...item, links: [...(item.links || []), targetId] };
                }
                // Update target with copied children
                if (item.id === targetId && newChildren.length > 0) {
                    return {
                        ...item,
                        children: [...(item.children || []), ...newChildren]
                    };
                }
                return item;
            });
        });

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
        setPanOffset({ x: 0, y: 0 }); // Reset pan as well
    };

    const [showNavigator, setShowNavigator] = useState(false);

    // Quick Navigator - Center view on item
    const handleCenterOnItem = (itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        // Calculate functionality to center the item
        // Item center coordinates
        const itemWidth = item.type === 'idea' ? 320 : 256; // estimated widths
        const itemHeight = 200; // estimated height

        const itemCenterX = item.x + itemWidth / 2;
        const itemCenterY = item.y + itemHeight / 2;

        // Container (viewport) dimensions
        const container = document.getElementById('canvas-viewport'); // We need to add this ID to the outer div
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // New pan offset to center the item
        // panOffset + itemCenter * zoom = containerCenter
        // panOffset = containerCenter - itemCenter * zoom
        // Note: Coordinates are typically negative for panOffset to move content left/up

        const newPanX = (containerWidth / 2) - (itemCenterX * zoom);
        const newPanY = (containerHeight / 2) - (itemCenterY * zoom);

        setPanOffset({ x: newPanX, y: newPanY });
        setShowNavigator(false); // Close navigator after selection
    };

    // Jump to First Item (Left-most)
    const handleJumpToFirst = () => {
        if (items.length === 0) return;
        // Sort by X position
        const sorted = [...items].sort((a, b) => a.x - b.x);
        handleCenterOnItem(sorted[0].id);
    };

    // Jump to Last Item (Right-most)
    const handleJumpToLast = () => {
        if (items.length === 0) return;
        // Sort by X position
        const sorted = [...items].sort((a, b) => b.x - a.x); // Descending
        handleCenterOnItem(sorted[0].id);
    };

    // Mouse Wheel Zoom Handler
    const handleWheel = useCallback((e: React.WheelEvent) => {
        // Prevent default browser scrolling behavior is handled by overflow: hidden
        // Simple zoom logic: scroll up (negative delta) = zoom in, scroll down = zoom out
        const delta = e.deltaY;

        // Determine zoom direction and factor
        const zoomFactor = 0.05; // Smaller step for smoother feel
        const direction = delta < 0 ? 1 : -1;

        setZoom(prev => {
            const newZoom = prev + (direction * zoomFactor);
            // Clamp between 0.3 and 2.0
            return Math.min(Math.max(newZoom, 0.3), 2.0);
        });
    }, []);


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
        // Sticky notes have no referenceId and are allowed to appear multiple times → skip them
        const isDuplicate = (parentItem: any, newItemRefId: string | undefined) => {
            if (!newItemRefId) return false; // no referenceId = not a database entity, always allow
            return parentItem.children?.some(
                (c: any) => c.referenceId && c.referenceId === newItemRefId
            );
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
                    role: activeData.role, // Include role for character color coding
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
                role: activeData.role, // Include role for character color coding
                children: [], // Initialize children array
                links: [] // Initialize links
            };

            setItems((prev) => [...prev, newItem]);

            // Auto-mark idea as used when placed on canvas
            if (activeData.type === 'idea' && activeData.id) {
                updateIdea(activeData.id, {
                    canvasX: Math.round(x),
                    canvasY: Math.round(y),
                    isUsed: true
                });
            }
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

    const handleExport = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            novelId,
            eventId,
            totalItems: items.length,
            totalGroups: groups.length,
            items: items.map(item => ({
                id: item.id,
                type: item.type,
                title: item.title,
                content: item.content,
                x: item.x,
                y: item.y,
                links: item.links,
                children: item.children?.map((child: any) => ({
                    id: child.id,
                    type: child.type,
                    title: child.title,
                    content: child.content,
                    referenceId: child.referenceId
                }))
            })),
            groups: groups.map(g => ({
                id: g.id,
                label: g.label,
                color: g.color,
                x: g.x,
                y: g.y,
                width: g.width,
                height: g.height,
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plot-board-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Export Playground สำเร็จ!');
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
                <div
                    id="canvas-viewport"
                    className="flex-1 relative bg-slate-50 min-h-[400px]"
                    onWheel={handleWheel}
                >
                    {/* Linking Mode Banner */}
                    {linkingSourceId && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
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
                            {/* Navigator Toggle */}
                            <div className="relative">
                                <Button
                                    variant={showNavigator ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setShowNavigator(!showNavigator)}
                                    title="Quick Navigator"
                                >
                                    <List className="h-4 w-4" />
                                </Button>

                                {/* Navigator Popover */}
                                {showNavigator && (
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border overflow-hidden flex flex-col max-h-[60vh] z-50 animate-in slide-in-from-top-2 fade-in duration-200">
                                        <div className="p-2 border-b bg-muted/30 font-semibold text-xs text-muted-foreground flex items-center gap-2">
                                            <Navigation className="w-3 h-3" />
                                            <span>Jump to Component</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 ml-auto"
                                                onClick={() => setShowNavigator(false)}
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="overflow-y-auto p-1 space-y-1">
                                            {items.length === 0 && (
                                                <div className="p-4 text-center text-xs text-muted-foreground">
                                                    No items on canvas
                                                </div>
                                            )}
                                            {/* Group by Type */}
                                            {['character', 'location', 'idea', 'sticky-note'].map(type => {
                                                const typeItems = items.filter(i => i.type === type);
                                                if (typeItems.length === 0) return null;

                                                return (
                                                    <div key={type} className="mb-2 last:mb-0">
                                                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/20 rounded-sm mb-0.5">
                                                            {type === 'sticky-note' ? 'Notes' : type + 's'}
                                                        </div>
                                                        {typeItems.map(item => (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => handleCenterOnItem(item.id)}
                                                                className="w-full text-left px-2 py-1.5 hover:bg-slate-100 rounded text-xs flex items-center gap-2 transition-colors group"
                                                            >
                                                                <div className={`w-2 h-2 rounded-full shrink-0 ${type === 'character' ? 'bg-blue-400' :
                                                                    type === 'location' ? 'bg-green-400' :
                                                                        type === 'idea' ? 'bg-yellow-400' : 'bg-purple-400'
                                                                    }`} />
                                                                <span className="truncate group-hover:text-primary transition-colors">
                                                                    {item.title || (type === 'sticky-note' ? (item.content?.slice(0, 15) || 'Empty Note') : 'Untitled')}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Add Sticky Note Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-purple-600 hover:bg-purple-100"
                                onClick={handleAddStickyNote}
                                title="Add Sticky Note"
                            >
                                <StickyNote className="h-4 w-4" />
                            </Button>

                            {/* Add Group Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:bg-blue-100"
                                onClick={handleAddGroup}
                                title="Add Group Frame"
                            >
                                <Group className="h-4 w-4" />
                            </Button>

                            <div className="w-px h-4 bg-border mx-1" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleJumpToFirst}
                                title="Jump to First (Top-Left)"
                            >
                                <SkipBack className="h-4 w-4" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleJumpToLast}
                                title="Jump to Last (Bottom-Right)"
                            >
                                <SkipForward className="h-4 w-4" />
                            </Button>

                            <div className="w-px h-4 bg-border mx-1" />

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
                            size="icon"
                            variant="outline"
                            className={`pointer-events-auto bg-white/80 backdrop-blur hover:bg-white border shadow-sm transition-all h-9 w-9 ${lastSaved && !isSaving ? 'text-green-600 border-green-300 hover:border-green-400' : 'text-foreground'}`}
                            title={isSaving ? "กำลังบันทึก..." : lastSaved ? "บันทึกแล้ว" : "บันทึก Layout"}
                        >
                            {isSaving
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : lastSaved
                                    ? <Check className="w-4 h-4" />
                                    : <Save className="w-4 h-4" />
                            }
                        </Button>

                        <Button
                            onClick={handleExport}
                            size="icon"
                            variant="outline"
                            className="pointer-events-auto bg-white/80 backdrop-blur hover:bg-white text-foreground border shadow-sm transition-all h-9 w-9"
                            title="Export to JSON"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Bottom Right FAB - Create Idea */}
                    <div className="absolute bottom-6 right-6 z-50 pointer-events-none">
                        <div className="pointer-events-auto">
                            <CreateIdeaDialog
                                novelId={novelId}
                                onIdeaCreated={(idea) => {
                                    // คำนวณตำแหน่งกลางจอ user ใน world space (เหมือน handleAddStickyNote)
                                    const container = canvasRef.current?.parentElement;
                                    const viewportWidth = container?.clientWidth ?? 800;
                                    const viewportHeight = container?.clientHeight ?? 600;

                                    const centerX = (viewportWidth / 2 - panOffset.x) / zoom;
                                    const centerY = (viewportHeight / 2 - panOffset.y) / zoom;

                                    const jitter = () => (Math.random() - 0.5) * 60;

                                    const newItem = {
                                        id: crypto.randomUUID(),
                                        type: 'idea',
                                        referenceId: idea.id,
                                        title: idea.title,
                                        content: idea.content,
                                        x: Math.round(centerX + jitter()),
                                        y: Math.round(centerY + jitter()),
                                        children: [],
                                        links: [],
                                    };

                                    setItems(prev => [...prev, newItem]);

                                    // Mark as used in DB
                                    updateIdea(idea.id, {
                                        canvasX: Math.round(centerX),
                                        canvasY: Math.round(centerY),
                                        isUsed: true,
                                    });
                                }}
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
                        ancestorConnections={ancestorConnections}
                        zoom={zoom}
                        panOffset={panOffset}
                        isPanning={isPanning}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    >
                        {/* Render Groups (behind items) */}
                        {groups.map((group) => (
                            <GroupFrame
                                key={group.id}
                                group={group}
                                onUpdate={handleUpdateGroup}
                                onRemove={handleRemoveGroup}
                            />
                        ))}

                        {/* Render Items */}
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
                                onSetAncestor={item.type === 'idea' ? () => handleOpenAncestorDialog(item) : undefined}
                                ancestorConnections={item.type === 'idea' ? ancestorConnections
                                    .filter(c => c.sourceIdeaId === (item.referenceId || item.id))
                                    .map(c => {
                                        const targetIdea = ideas.find((idea: any) => idea.id === c.targetIdeaId);
                                        // Get idea_notes from cross-scene data
                                        const targetNotes = ancestorIdeaNotesMap.get(c.targetIdeaId) || [];
                                        return {
                                            ...c,
                                            targetIdeaTitle: targetIdea?.title || null,
                                            targetIdeaContent: targetIdea?.content || null,
                                            targetIdeaCategory: targetIdea?.category || null,
                                            targetIdeaNotes: targetNotes.length > 0 ? targetNotes : undefined,
                                        };
                                    }) : undefined}
                                onRemoveAncestor={item.type === 'idea' ? handleRemoveAncestor : undefined}
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
            {
                editingChild && (
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
                )
            }

            {/* Idea Note Dialog */}
            {
                editingNote && (
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
                )
            }

            {/* Ancestor Idea Dialog */}
            <Dialog open={!!ancestorDialogItem} onOpenChange={(open) => !open && setAncestorDialogItem(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitBranchPlus className="w-5 h-5 text-blue-500" />
                            เชื่อมเหตุผล (Ancestor Idea)
                        </DialogTitle>
                        <DialogDescription>
                            เลือกไอเดียที่เป็นต้นเหตุ / แรงจูงใจ ของ &quot;{ancestorDialogItem?.title}&quot;
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {/* Search */}
                        <Input
                            placeholder="ค้นหาไอเดีย..."
                            value={ancestorSearch}
                            onChange={(e) => setAncestorSearch(e.target.value)}
                            className="w-full"
                        />
                        {/* Optional Label */}
                        <Input
                            placeholder="เหตุผล (ไม่บังคับ) เช่น: ทำเพราะ..."
                            value={ancestorLabel}
                            onChange={(e) => setAncestorLabel(e.target.value)}
                            className="w-full text-sm"
                        />
                        {/* Idea List */}
                        <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
                            {ideas
                                .filter((idea: any) => {
                                    // Don't show the current idea
                                    const currentId = ancestorDialogItem?.referenceId || ancestorDialogItem?.id;
                                    if (idea.id === currentId) return false;
                                    // Search filter
                                    if (ancestorSearch) {
                                        return idea.title?.toLowerCase().includes(ancestorSearch.toLowerCase()) ||
                                            idea.content?.toLowerCase().includes(ancestorSearch.toLowerCase());
                                    }
                                    return true;
                                })
                                .map((idea: any) => (
                                    <button
                                        key={idea.id}
                                        onClick={() => handleCreateAncestor(idea.id)}
                                        className="w-full text-left p-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors flex items-start gap-2"
                                    >
                                        <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{idea.title}</p>
                                            {idea.content && (
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {typeof idea.content === 'string' ? idea.content : 'Rich text...'}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            {ideas.filter((idea: any) => {
                                const currentId = ancestorDialogItem?.referenceId || ancestorDialogItem?.id;
                                if (idea.id === currentId) return false;
                                if (ancestorSearch) {
                                    return idea.title?.toLowerCase().includes(ancestorSearch.toLowerCase());
                                }
                                return true;
                            }).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">ไม่พบไอเดีย</p>
                                )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DndContext >
    );
}