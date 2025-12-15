"use client";

import { useState } from "react";
import { Clock, Save, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { updateLocationConnection } from "@/server/location-connections";
import { toast } from "sonner";

interface TravelTimeEditorProps {
    connection: {
        id: string;
        sourceLocation?: { name: string } | null;
        targetLocation?: { name: string } | null;
        travelTime?: number | null;
        travelTimeUnit?: string | null;
        travelMethod?: string | null;
        travelNotes?: string | null;
    };
    novelId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
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
}: TravelTimeEditorProps) {
    const [isSaving, setIsSaving] = useState(false);
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
                    travelTime: travelTime ? parseInt(travelTime) : null,
                    travelTimeUnit: timeUnit,
                    travelMethod: method,
                    travelNotes: notes || null,
                },
                novelId
            );

            if (result.success) {
                toast.success("บันทึกเวลาเดินทางแล้ว");
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

    const sourceName = connection.sourceLocation?.name || "ต้นทาง";
    const targetName = connection.targetLocation?.name || "ปลายทาง";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        เวลาเดินทาง
                    </DialogTitle>
                </DialogHeader>

                {/* Route info */}
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg text-sm">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{sourceName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{targetName}</span>
                </div>

                <div className="space-y-4 py-2">
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
                </div>

                <DialogFooter>
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
