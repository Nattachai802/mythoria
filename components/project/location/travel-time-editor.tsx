"use client";

import { useState } from "react";
import { Clock, Save, Loader2, MapPin, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateLocationConnection, deleteLocationConnection } from "@/server/location-connections";
import { toast } from "sonner";
import { CONNECTION_TYPES } from "@/lib/location-constants";

interface TravelTimeEditorProps {
    connection: {
        id: string;
        sourceLocation?: { name: string } | null;
        targetLocation?: { name: string } | null;
        connectionType?: string | null;
        customLabel?: string | null;
        isBidirectional?: boolean | null;
        travelTime?: number | null;
        travelTimeUnit?: string | null;
        travelMethod?: string | null;
        travelNotes?: string | null;
    };
    novelId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
    onDelete?: () => void;
}

const TIME_UNITS = [
    { value: "hours", label: "ชั่วโมง" },
    { value: "days", label: "วัน" },
    { value: "weeks", label: "สัปดาห์" },
];

const TRAVEL_METHODS = [
    { value: "walk", label: "เดินเท้า", icon: "🚶" },
    { value: "horse", label: "ขี่ม้า", icon: "🐴" },
    { value: "carriage", label: "รถม้า", icon: "🛒" },
    { value: "boat", label: "เรือ", icon: "⛵" },
    { value: "teleport", label: "เทเลพอร์ต", icon: "✨" },
    { value: "custom", label: "อื่นๆ", icon: "⚙️" },
];

export function TravelTimeEditor({
    connection,
    novelId,
    open,
    onOpenChange,
    onUpdate,
    onDelete,
}: TravelTimeEditorProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Connection settings
    const [connectionType, setConnectionType] = useState(connection.connectionType || "adjacent");
    const [customLabel, setCustomLabel] = useState(connection.customLabel || "");
    const [isBidirectional, setIsBidirectional] = useState(connection.isBidirectional !== false);

    // Travel time settings
    const [travelTime, setTravelTime] = useState<string>(
        connection.travelTime?.toString() || ""
    );
    const [timeUnit, setTimeUnit] = useState(
        connection.travelTimeUnit || "hours"
    );
    const [method, setMethod] = useState(connection.travelMethod || "walk");
    const [notes, setNotes] = useState(connection.travelNotes || "");

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateLocationConnection(
                connection.id,
                {
                    connectionType,
                    customLabel: connectionType === "custom" ? customLabel : null,
                    isBidirectional,
                    travelTime: travelTime ? parseInt(travelTime) : null,
                    travelTimeUnit: timeUnit,
                    travelMethod: method,
                    travelNotes: notes || null,
                },
                novelId
            );

            if (result.success) {
                toast.success("บันทึกการเชื่อมต่อแล้ว");
                onOpenChange(false);
                onUpdate?.();
            } else {
                toast.error("ไม่สามารถบันทึกได้");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("ต้องการลบการเชื่อมต่อนี้?")) return;

        setIsDeleting(true);
        try {
            const result = await deleteLocationConnection(connection.id, novelId);
            if (result.success) {
                toast.success("ลบการเชื่อมต่อแล้ว");
                onOpenChange(false);
                onDelete?.();
            } else {
                toast.error("ไม่สามารถลบได้");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsDeleting(false);
        }
    };

    const sourceName = connection.sourceLocation?.name || "ต้นทาง";
    const targetName = connection.targetLocation?.name || "ปลายทาง";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        แก้ไขการเชื่อมต่อ
                    </DialogTitle>
                </DialogHeader>

                {/* Route info */}
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg text-sm">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{sourceName}</span>
                    <span className="text-muted-foreground">{isBidirectional ? "↔" : "→"}</span>
                    <span className="font-medium">{targetName}</span>
                </div>

                <Tabs defaultValue="connection" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="connection">ประเภทเส้น</TabsTrigger>
                        <TabsTrigger value="travel">เวลาเดินทาง</TabsTrigger>
                    </TabsList>

                    {/* Connection Type Tab */}
                    <TabsContent value="connection" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>ประเภทการเชื่อมต่อ</Label>
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

                        {connectionType === "custom" && (
                            <div className="space-y-2">
                                <Label>ชื่อเส้นทาง</Label>
                                <Input
                                    value={customLabel}
                                    onChange={(e) => setCustomLabel(e.target.value)}
                                    placeholder="เช่น ทางลับ, ถ้ำใต้ดิน..."
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <Label>เชื่อมต่อสองทาง</Label>
                            <Switch
                                checked={isBidirectional}
                                onCheckedChange={setIsBidirectional}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isBidirectional
                                ? "ทั้งสองสถานที่เชื่อมต่อกัน"
                                : "เชื่อมต่อทางเดียว (จะแสดงลูกศร)"}
                        </p>
                    </TabsContent>

                    {/* Travel Time Tab */}
                    <TabsContent value="travel" className="space-y-4 mt-4">
                        {/* Travel Time */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>ระยะเวลา</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={travelTime}
                                    onChange={(e) => setTravelTime(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>หน่วย</Label>
                                <Select value={timeUnit} onValueChange={setTimeUnit}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIME_UNITS.map((unit) => (
                                            <SelectItem key={unit.value} value={unit.value}>
                                                {unit.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Travel Method */}
                        <div className="space-y-2">
                            <Label>วิธีการเดินทาง</Label>
                            <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRAVEL_METHODS.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>
                                            <span className="flex items-center gap-2">
                                                <span>{m.icon}</span>
                                                <span>{m.label}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>หมายเหตุ</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="เช่น ต้องผ่านป่าดิบ, อันตราย..."
                                rows={2}
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="flex justify-between gap-2">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="mr-auto"
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        ลบ
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        บันทึก
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
