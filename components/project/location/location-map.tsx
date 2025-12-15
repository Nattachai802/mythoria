"use client";

import { useCallback, useEffect, useState } from "react";
import {
    ReactFlow,
    Node,
    Edge,
    addEdge,
    Connection,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    MarkerType,
    ConnectionMode,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Plus, Trash2, Clock, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
    createLocationConnection,
    deleteLocationConnection,
} from "@/server/location-connections";
import { CONNECTION_TYPES } from "@/lib/location-constants";
import { TravelTimeEditor } from "./travel-time-editor";

interface LocationMapProps {
    locations: any[];
    connections: any[];
    novelId: string;
}

// Custom node component with handles for connections
function LocationNode({ data }: { data: any }) {
    return (
        <div className="px-4 py-3 rounded-lg border-2 bg-background shadow-lg min-w-[120px] text-center relative group">
            {/* Handles - hidden by default, visible on hover */}
            <Handle
                type="source"
                position={Position.Top}
                id="top-source"
                className="!w-3 !h-3 !bg-primary !border-2 !border-background !opacity-0 group-hover:!opacity-100 !transition-opacity"
            />
            <Handle
                type="target"
                position={Position.Bottom}
                id="bottom-target"
                className="!w-3 !h-3 !bg-primary !border-2 !border-background !opacity-0 group-hover:!opacity-100 !transition-opacity"
            />
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                className="!w-3 !h-3 !bg-primary !border-2 !border-background !opacity-0 group-hover:!opacity-100 !transition-opacity"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="!w-3 !h-3 !bg-primary !border-2 !border-background !opacity-0 group-hover:!opacity-100 !transition-opacity"
            />

            <div className="flex items-center justify-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{data.label}</span>
            </div>
            {data.type && (
                <span className="text-xs text-muted-foreground">{data.type}</span>
            )}
        </div>
    );
}

const nodeTypes = {
    location: LocationNode,
};

export function LocationMap({ locations, connections, novelId }: LocationMapProps) {
    const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
    const [selectedConnection, setSelectedConnection] = useState<{ source: string; target: string } | null>(null);
    const [connectionType, setConnectionType] = useState("adjacent");
    const [customLabel, setCustomLabel] = useState("");
    const [isBidirectional, setIsBidirectional] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Travel time editor state
    const [travelTimeEditorOpen, setTravelTimeEditorOpen] = useState(false);
    const [selectedEdgeForTravel, setSelectedEdgeForTravel] = useState<any>(null);

    // Calculate hierarchical positions for nodes
    const calculatePositions = () => {
        const positions: Record<string, { x: number; y: number }> = {};

        // Get root locations (no parent)
        const rootLocs = locations.filter(loc => !loc.parentLocationId);

        // Position root locations first
        rootLocs.forEach((loc, index) => {
            positions[loc.id] = {
                x: 150 + index * 300,
                y: 100,
            };
        });

        // Position level 1 children (under their parents)
        const level1Locs = locations.filter(loc => {
            if (!loc.parentLocationId) return false;
            const parent = locations.find(l => l.id === loc.parentLocationId);
            return parent && !parent.parentLocationId;
        });

        level1Locs.forEach((loc, index) => {
            const parentPos = positions[loc.parentLocationId];
            if (parentPos) {
                // Get siblings count
                const siblings = level1Locs.filter(l => l.parentLocationId === loc.parentLocationId);
                const siblingIndex = siblings.findIndex(s => s.id === loc.id);

                positions[loc.id] = {
                    x: parentPos.x + (siblingIndex - (siblings.length - 1) / 2) * 180,
                    y: parentPos.y + 150,
                };
            } else {
                positions[loc.id] = { x: 150 + index * 200, y: 250 };
            }
        });

        // Position level 2 children
        const level2Locs = locations.filter(loc => {
            if (!loc.parentLocationId) return false;
            const parent = locations.find(l => l.id === loc.parentLocationId);
            if (!parent || !parent.parentLocationId) return false;
            return true;
        });

        level2Locs.forEach((loc, index) => {
            const parentPos = positions[loc.parentLocationId];
            if (parentPos) {
                const siblings = level2Locs.filter(l => l.parentLocationId === loc.parentLocationId);
                const siblingIndex = siblings.findIndex(s => s.id === loc.id);

                positions[loc.id] = {
                    x: parentPos.x + (siblingIndex - (siblings.length - 1) / 2) * 180,
                    y: parentPos.y + 150,
                };
            } else {
                positions[loc.id] = { x: 150 + index * 200, y: 400 };
            }
        });

        return positions;
    };

    const nodePositions = calculatePositions();

    // Convert locations to nodes with hierarchical positions
    const initialNodes: Node[] = locations.map((loc) => ({
        id: loc.id,
        type: "location",
        position: nodePositions[loc.id] || { x: 150, y: 100 },
        data: { label: loc.name, type: loc.type },
    }));

    // Create parent-child edges (hierarchy edges)
    // Child (ด้านล่าง) ออกจากด้านบน -> Parent (ด้านบน) รับที่ด้านล่าง
    const hierarchyEdges: Edge[] = locations
        .filter(loc => loc.parentLocationId)
        .map(loc => ({
            id: `hierarchy-${loc.id}`,
            source: loc.id,  // child
            target: loc.parentLocationId,  // parent
            sourceHandle: 'top-source',  // child ออกจากด้านบน
            targetHandle: 'bottom-target',  // parent รับที่ด้านล่าง
            label: "อยู่ใน",
            type: "smoothstep",
            style: {
                stroke: '#94a3b8',
                strokeWidth: 2,
                strokeDasharray: '5,5',
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            data: { isHierarchy: true },
        }));

    // Convert connections to edges
    const connectionEdges: Edge[] = connections.map((conn) => ({
        id: conn.id,
        source: conn.sourceLocationId,
        target: conn.targetLocationId,
        label: conn.connectionType === 'custom' ? conn.customLabel :
            CONNECTION_TYPES.find(t => t.value === conn.connectionType)?.label || conn.connectionType,
        markerEnd: conn.isBidirectional ? undefined : { type: MarkerType.ArrowClosed },
        markerStart: conn.isBidirectional ? undefined : undefined,
        animated: conn.connectionType === 'shortcut',
        style: {
            stroke: conn.connectionType === 'shortcut' ? '#10b981' :
                conn.connectionType === 'path' ? '#f59e0b' : '#6366f1',
            strokeWidth: 2,
        },
        data: conn,
    }));

    // Combine all edges
    const initialEdges: Edge[] = [...hierarchyEdges, ...connectionEdges];

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [locations, connections]);

    const onConnect = useCallback((params: Connection) => {
        if (params.source && params.target) {
            setSelectedConnection({ source: params.source, target: params.target });
            setConnectionDialogOpen(true);
        }
    }, []);

    const handleCreateConnection = async () => {
        if (!selectedConnection) return;

        setIsSubmitting(true);
        const result = await createLocationConnection({
            sourceLocationId: selectedConnection.source,
            targetLocationId: selectedConnection.target,
            connectionType,
            customLabel: connectionType === 'custom' ? customLabel : undefined,
            isBidirectional,
            novelId,
        });

        if (result.success) {
            toast.success("Connection created");
            setConnectionDialogOpen(false);
            // Reset form
            setConnectionType("adjacent");
            setCustomLabel("");
            setIsBidirectional(true);
        } else {
            toast.error(result.error || "Failed to create connection");
        }
        setIsSubmitting(false);
    };

    const handleDeleteConnection = async (connectionId: string) => {
        if (!confirm("Delete this connection?")) return;

        const result = await deleteLocationConnection(connectionId, novelId);
        if (result.success) {
            toast.success("Connection deleted");
            setEdges(edges.filter(e => e.id !== connectionId));
        } else {
            toast.error(result.error || "Failed to delete");
        }
    };

    const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
        // Skip hierarchy edges (parent-child)
        if ((edge.data as any)?.isHierarchy) return;

        // For connection edges, open travel time editor
        const connData = connections.find(c => c.id === edge.id);
        if (connData) {
            setSelectedEdgeForTravel({
                ...connData,
                sourceLocation: locations.find(l => l.id === connData.sourceLocationId),
                targetLocation: locations.find(l => l.id === connData.targetLocationId),
            });
            setTravelTimeEditorOpen(true);
        }
    }, [connections, locations]);

    const handleDeleteEdge = async (connectionId: string) => {
        const result = await deleteLocationConnection(connectionId, novelId);
        if (result.success) {
            toast.success("Connection deleted");
            setEdges(edges.filter(e => e.id !== connectionId));
            setTravelTimeEditorOpen(false);
        } else {
            toast.error(result.error || "Failed to delete");
        }
    };

    return (
        <>
            <Card className="h-[600px]">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Location Map
                        </CardTitle>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-0.5 bg-slate-400 border-dashed border-t-2 border-slate-400" />
                                <span>อยู่ใน</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-indigo-500 rounded" />
                                <span>ติดกับ</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-emerald-500 rounded animate-pulse" />
                                <span>ทางลัด</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-amber-500 rounded" />
                                <span>ทางไป</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Drag locations to arrange. Connect by dragging from one location to another.
                    </p>
                </CardHeader>
                <CardContent className="h-[500px] p-0">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onEdgeClick={onEdgeClick}
                        nodeTypes={nodeTypes}
                        connectionMode={ConnectionMode.Loose}
                        fitView
                        className="bg-muted/20 rounded-b-lg"
                    >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                    </ReactFlow>
                </CardContent>
            </Card>

            {/* Connection Dialog */}
            <Dialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Connection</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            Connecting <strong>{locations.find(l => l.id === selectedConnection?.source)?.name}</strong>
                            {" → "}
                            <strong>{locations.find(l => l.id === selectedConnection?.target)?.name}</strong>
                        </div>

                        <div className="space-y-2">
                            <Label>Connection Type</Label>
                            <Select value={connectionType} onValueChange={setConnectionType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONNECTION_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {connectionType === 'custom' && (
                            <div className="space-y-2">
                                <Label>Custom Label</Label>
                                <Input
                                    value={customLabel}
                                    onChange={(e) => setCustomLabel(e.target.value)}
                                    placeholder="Enter custom label..."
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <Label>Two-way connection</Label>
                            <Switch
                                checked={isBidirectional}
                                onCheckedChange={setIsBidirectional}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isBidirectional
                                ? "Both locations are connected to each other"
                                : "One-way connection (will show arrow)"}
                        </p>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConnectionDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateConnection} disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Travel Time Editor */}
            {selectedEdgeForTravel && (
                <TravelTimeEditor
                    connection={selectedEdgeForTravel}
                    novelId={novelId}
                    open={travelTimeEditorOpen}
                    onOpenChange={(open) => {
                        setTravelTimeEditorOpen(open);
                        if (!open) setSelectedEdgeForTravel(null);
                    }}
                    onUpdate={() => {
                        // Page will revalidate from server
                    }}
                />
            )}
        </>
    );
}
