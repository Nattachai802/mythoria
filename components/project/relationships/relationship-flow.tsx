"use client";

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    BackgroundVariant,
    Panel,
    Connection,
    addEdge,
} from '@xyflow/react';
import dagre from 'dagre';
import { Character } from '@/db/schema';
import { RelationshipNode } from './relationship-node';
import '@xyflow/react/dist/style.css';
import { useTheme } from 'next-themes';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RELATIONSHIP_TYPES } from "@/components/project/character/relationship-constants";
import { createCharacterRelationship, deleteCharacterRelationship } from "@/server/character";
import { toast } from "sonner";

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph({ compound: true });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 200;
    const nodeHeight = 100;

    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        if (node.type === 'group') {
            dagreGraph.setNode(node.id, {});
        } else {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        }

        if (node.parentId) {
            dagreGraph.setParent(node.id, node.parentId);
        }
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        let x = nodeWithPosition.x - (node.type === 'group' ? nodeWithPosition.width! / 2 : nodeWidth / 2);
        let y = nodeWithPosition.y - (node.type === 'group' ? nodeWithPosition.height! / 2 : nodeHeight / 2);

        return {
            ...node,
            targetPosition: 'top',
            sourcePosition: 'bottom',
            position: { x, y },
            style: node.type === 'group' ? {
                ...node.style,
                width: nodeWithPosition.width,
                height: nodeWithPosition.height
            } : node.style,
        };
    });

    return { nodes: newNodes, edges };
};

interface RelationshipFlowProps {
    characters: Character[];
    relationships: any[];
    factions?: any[];
    novelId: string;
    onRelationshipCreated?: () => void;
}

export function RelationshipFlow({
    characters,
    relationships,
    factions = [],
    novelId,
    onRelationshipCreated
}: RelationshipFlowProps) {
    const { theme } = useTheme();

    // Connection dialog state
    const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
    const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
    const [relType, setRelType] = useState("Friend");
    const [description, setDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
        const nodes: any[] = [];
        const edges: any[] = [];

        // Map character ID to Faction ID
        const charFactionMap = new Map<string, string>();

        // 1. Create Faction Group Nodes
        factions.forEach(faction => {
            nodes.push({
                id: faction.id,
                type: 'group',
                data: { label: faction.name },
                style: {
                    backgroundColor: faction.color ? `${faction.color}20` : 'rgba(0, 0, 0, 0.05)',
                    border: `2px dashed ${faction.color || '#ccc'}`,
                    borderRadius: '8px',
                    width: 300,
                    height: 200,
                },
                position: { x: 0, y: 0 }
            });

            // Map members
            faction.members.forEach((member: any) => {
                charFactionMap.set(member.characterId, faction.id);
            });
        });

        // 2. Create Character Nodes
        characters.forEach((char) => {
            const factionId = charFactionMap.get(char.id);

            nodes.push({
                id: char.id,
                type: 'characterNode',
                data: {
                    label: char.name,
                    role: char.role,
                    image: char.image
                },
                position: { x: 0, y: 0 },
                parentId: factionId,
                extent: factionId ? 'parent' : undefined,
                expandParent: !!factionId,
            });
        });

        // 3. Create Edges from existing relationships
        relationships.forEach((rel) => {
            edges.push({
                id: rel.id,
                source: rel.sourceCharacterId,
                target: rel.targetCharacterId,
                label: rel.type,
                type: 'smoothstep',
                animated: false,
                style: {
                    stroke: getRelationshipColor(rel.type),
                    strokeWidth: 2
                },
                labelStyle: {
                    fill: '#fff',
                    fontWeight: 600,
                    fontSize: 11
                },
                labelBgStyle: {
                    fill: '#1e293b',
                    rx: 4,
                    ry: 4,
                    fillOpacity: 1
                },
                zIndex: 10,
            });
        });

        return getLayoutedElements(nodes, edges);

    }, [characters, relationships, factions, theme]);

    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

    useEffect(() => {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

    const nodeTypes = useMemo(() => ({ characterNode: RelationshipNode }), []);

    // Handle when user drags a connection line between two nodes
    const onConnect = useCallback((connection: Connection) => {
        console.log("🔗 onConnect triggered!", connection);

        if (!connection.source || !connection.target) {
            console.log("❌ Missing source or target");
            return;
        }
        if (connection.source === connection.target) {
            console.log("❌ Self-connection not allowed");
            return;
        }

        // Check if relationship already exists
        const exists = relationships.some(
            r => (r.sourceCharacterId === connection.source && r.targetCharacterId === connection.target) ||
                (r.sourceCharacterId === connection.target && r.targetCharacterId === connection.source)
        );

        if (exists) {
            console.log("❌ Relationship already exists");
            toast.error("Relationship already exists between these characters");
            return;
        }

        console.log("✅ Opening dialog for new relationship");
        // Open dialog to configure relationship
        setPendingConnection(connection);
        setRelType("Friend");
        setDescription("");
        setIsConnectDialogOpen(true);
    }, [relationships]);

    // Create the relationship when dialog is confirmed
    const handleCreateConnection = async () => {
        if (!pendingConnection?.source || !pendingConnection?.target) return;

        setIsCreating(true);

        const result = await createCharacterRelationship({
            novelId,
            sourceCharacterId: pendingConnection.source,
            targetCharacterId: pendingConnection.target,
            type: relType,
            description: description || undefined,
        });

        if (result.success) {
            toast.success("Relationship created!");

            // Add edge visually immediately
            const newEdge = {
                id: result.data?.id || `temp-${Date.now()}`,
                source: pendingConnection.source,
                target: pendingConnection.target,
                label: relType,
                type: 'smoothstep',
                style: {
                    stroke: getRelationshipColor(relType),
                    strokeWidth: 2
                },
                labelStyle: {
                    fill: '#fff',
                    fontWeight: 600,
                    fontSize: 11
                },
                labelBgStyle: {
                    fill: '#1e293b',
                    rx: 4,
                    ry: 4,
                    fillOpacity: 1
                },
            };
            setEdges((eds) => addEdge(newEdge, eds));

            // Notify parent to refresh data
            onRelationshipCreated?.();
        } else {
            toast.error(result.error || "Failed to create relationship");
        }

        setIsCreating(false);
        setIsConnectDialogOpen(false);
        setPendingConnection(null);
    };

    // Get source and target character names for dialog
    const getCharName = (id: string | null) => {
        if (!id) return "Unknown";
        return characters.find(c => c.id === id)?.name || "Unknown";
    };

    return (
        <>
            <div className="w-full h-[600px] border rounded-lg bg-background/50 overflow-hidden">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={(event, params) => {
                        console.log("🟢 Connection started!", params);
                    }}
                    onConnectEnd={(event) => {
                        console.log("🔴 Connection ended!");
                    }}
                    nodeTypes={nodeTypes}
                    fitView
                    connectOnClick={true}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                    <Controls />
                    <MiniMap zoomable pannable
                        nodeColor={(n) => {
                            if (n.type === 'characterNode') return '#3b82f6';
                            if (n.type === 'group') return '#f59e0b';
                            return '#eee';
                        }}
                    />
                    <Panel position="top-right" className="bg-background/80 p-2 rounded shadow text-xs">
                        {characters.length} Characters | {edges.length} Relationships | {factions.length} Factions
                    </Panel>
                    <Panel position="top-left" className="bg-background/80 p-2 rounded shadow text-xs text-muted-foreground">
                        💡 Drag from one character to another to create a relationship
                    </Panel>
                </ReactFlow>
            </div>

            {/* Create Relationship Dialog */}
            <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Relationship</DialogTitle>
                        <DialogDescription>
                            Define the relationship between <strong>{getCharName(pendingConnection?.source || null)}</strong> and <strong>{getCharName(pendingConnection?.target || null)}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Relationship Type</Label>
                            <Select value={relType} onValueChange={setRelType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RELATIONSHIP_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Description (Optional)</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the relationship..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateConnection} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create Relationship"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Helper function to get color based on relationship type
function getRelationshipColor(type: string): string {
    const colors: Record<string, string> = {
        "Friend": "#22c55e",
        "Family": "#3b82f6",
        "Enemy": "#ef4444",
        "Romantic Partner": "#ec4899",
        "Mentor": "#f59e0b",
        "Rival": "#f97316",
        "Ally": "#10b981",
        "Colleague": "#6366f1",
    };
    return colors[type] || "#64748b";
}
