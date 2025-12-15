"use client";

import { useEffect, useState } from "react";
import {
    MapPin,
    Loader2,
    ChevronDown,
    RefreshCw,
    Edit3,
    Save,
    X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    getCharacterStatesForNote,
    updateCharacterState,
    CharacterStateWithCharacter
} from "@/server/character-state-queries";
import { reprocessNoteStates } from "@/server/character-state-extractor";
import { cn } from "@/lib/utils";

interface CharacterStateEditorProps {
    noteId: string;
}

const STATUS_OPTIONS = [
    { value: "alive", label: "มีชีวิต", color: "text-emerald-600" },
    { value: "injured", label: "บาดเจ็บ", color: "text-amber-600" },
    { value: "severely_injured", label: "บาดเจ็บหนัก", color: "text-orange-600" },
    { value: "unconscious", label: "หมดสติ", color: "text-purple-600" },
    { value: "dead", label: "เสียชีวิต", color: "text-red-600" },
    { value: "escaped", label: "หลบหนี", color: "text-blue-600" },
];

const ENERGY_OPTIONS = [
    { value: "exhausted", label: "หมดแรง" },
    { value: "tired", label: "เหนื่อย" },
    { value: "normal", label: "ปกติ" },
    { value: "energetic", label: "กระปรี้กระเปร่า" },
    { value: "high", label: "พลังสูง" },
];

function getStatusInfo(status: string) {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

function MinimalStateRow({
    state,
    onUpdate
}: {
    state: CharacterStateWithCharacter;
    onUpdate: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editData, setEditData] = useState({
        locationName: state.locationName || "",
        health: state.health || 100,
        energy: state.energy || "normal",
        status: state.status || "alive",
    });

    const statusInfo = getStatusInfo(state.status || "alive");

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateCharacterState(state.id, {
                ...editData,
                isManuallyEdited: true,
            });
            setIsEditing(false);
            onUpdate();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="group flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors">
            {/* Avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-medium text-primary">
                {state.character?.name?.charAt(0).toUpperCase() || "?"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                        {state.character?.name}
                    </span>
                    {state.isManuallyEdited && (
                        <span className="text-[10px] text-muted-foreground">✎</span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("font-medium", statusInfo.color)}>
                        {statusInfo.label}
                    </span>
                    {state.locationName && (
                        <>
                            <span className="opacity-30">•</span>
                            <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                                <MapPin className="h-2.5 w-2.5" />
                                {state.locationName}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Edit Popover */}
            <Popover open={isEditing} onOpenChange={setIsEditing}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">แก้ไขสถานะ</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => setIsEditing(false)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">สถานะ</label>
                                <Select
                                    value={editData.status}
                                    onValueChange={(v) => setEditData({ ...editData, status: v })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                <span className={opt.color}>{opt.label}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">สถานที่</label>
                                <Input
                                    value={editData.locationName}
                                    onChange={(e) => setEditData({ ...editData, locationName: e.target.value })}
                                    placeholder="สถานที่"
                                    className="h-8 text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">HP</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={editData.health}
                                        onChange={(e) => setEditData({ ...editData, health: parseInt(e.target.value) || 0 })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">พลังงาน</label>
                                    <Select
                                        value={editData.energy}
                                        onValueChange={(v) => setEditData({ ...editData, energy: v })}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ENERGY_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Button
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                    <Save className="h-3 w-3 mr-1" />
                                    บันทึก
                                </>
                            )}
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export function CharacterStateEditor({ noteId }: CharacterStateEditorProps) {
    const [states, setStates] = useState<CharacterStateWithCharacter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReprocessing, setIsReprocessing] = useState(false);

    const fetchStates = async () => {
        setIsLoading(true);
        try {
            const result = await getCharacterStatesForNote(noteId);
            if (result.success) {
                setStates(result.states);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStates();
    }, [noteId]);

    const handleReprocess = async () => {
        setIsReprocessing(true);
        try {
            await reprocessNoteStates(noteId);
            setTimeout(fetchStates, 5000);
        } finally {
            setIsReprocessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    สถานะตัวละคร {states.length > 0 && `(${states.length})`}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                    title="วิเคราะห์ใหม่"
                >
                    {isReprocessing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3 w-3" />
                    )}
                </Button>
            </div>

            {/* List */}
            {states.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                    <p className="text-xs">ยังไม่มีข้อมูล</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={handleReprocess}
                        disabled={isReprocessing}
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        วิเคราะห์ด้วย AI
                    </Button>
                </div>
            ) : (
                <div className="space-y-0.5">
                    {states.map((state) => (
                        <MinimalStateRow
                            key={state.id}
                            state={state}
                            onUpdate={fetchStates}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
