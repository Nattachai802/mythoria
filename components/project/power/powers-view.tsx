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
        <div className="space-y-5">
            {/* Search Bar + count */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาพลัง ตามชื่อ ประเภท หรือความหายาก…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 chamfered-sm bg-card/50"
                    />
                </div>
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground tabular-nums shrink-0">
                    {searchQuery
                        ? `พบ ${filteredPowers.length}${filteredPowers.length !== powers.length ? ` / ${powers.length}` : ""} พลัง`
                        : `${powers.length} พลัง`}
                </span>
            </div>

            {/* Powers Grid */}
            {filteredPowers.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 chamfered border border-dashed border-border bg-card/40">
                    <Zap className="w-10 h-10 text-[var(--forge-gold)]/50 mb-4" />
                    <h3 className="font-display font-semibold text-lg">
                        {searchQuery ? "ไม่พบพลังที่ค้นหา" : "ยังไม่มีพลังในเรื่องนี้"}
                    </h3>
                    <p className="text-muted-foreground mt-1.5 mb-5 max-w-sm text-sm">
                        {searchQuery
                            ? `ไม่มีพลังที่ตรงกับ "${searchQuery}" — ลองคำค้นอื่นดู`
                            : "สร้างระบบพลังของโลกนิยาย กำหนดประเภท ความหายาก และระดับพลังได้ที่นี่"}
                    </p>
                    {!searchQuery && <CreatePowerDialog novelId={novelId} />}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
