"use client";

import { useState } from "react";
import { Power, PowerLevel } from "@/db/schema";
import { PowerCard } from "./power-card";
import { CreatePowerDialog } from "./create-power-dialog";
import { EditPowerDialog } from "./edit-power-dialog";
import { Input } from "@/components/ui/input";
import { Search, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

interface PowersViewProps {
    powers: (Power & { levels?: PowerLevel[] })[];
    novelId: string;
}

export function PowersView({ powers, novelId }: PowersViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [editingPower, setEditingPower] = useState<Power | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const router = useRouter();

    // Filter powers by search query
    const filteredPowers = powers.filter((power) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        if (power.name.toLowerCase().includes(query)) return true;
        if (power.type?.toLowerCase().includes(query)) return true;
        if (power.rarity?.toLowerCase().includes(query)) return true;
        if (power.description?.toLowerCase().includes(query)) return true;

        return false;
    });

    const handleEdit = (power: Power) => {
        setEditingPower(power);
        setEditDialogOpen(true);
    };

    const handleEditSuccess = () => {
        router.refresh();
    };

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ค้นหาพลัง..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Results count */}
            {searchQuery && (
                <p className="text-sm text-muted-foreground">
                    พบ {filteredPowers.length} พลัง
                    {filteredPowers.length !== powers.length && ` (จาก ${powers.length})`}
                </p>
            )}

            {/* Powers Grid */}
            {filteredPowers.length === 0 ? (
                <div className="text-center py-12">
                    <Zap className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground mb-4">
                        {searchQuery
                            ? `ไม่พบพลังที่ตรงกับ "${searchQuery}"`
                            : "ยังไม่มีพลัง สร้างพลังแรกเลย!"}
                    </p>
                    {!searchQuery && <CreatePowerDialog novelId={novelId} />}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPowers.map((power) => (
                        <PowerCard
                            key={power.id}
                            power={power}
                            novelId={novelId}
                            onEdit={() => handleEdit(power)}
                        />
                    ))}
                </div>
            )}

            {/* Edit Power Dialog */}
            {editingPower && (
                <EditPowerDialog
                    power={editingPower}
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    onSuccess={handleEditSuccess}
                />
            )}
        </div>
    );
}
