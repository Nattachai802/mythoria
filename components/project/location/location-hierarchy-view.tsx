"use client";

import { useState } from "react";
import { LocationCard } from "./location-card";
import { EditLocationDialog } from "./edit-location-dialog";
import { Badge } from "@/components/ui/badge";
import { Location } from "@/db/schema";

interface LocationHierarchyViewProps {
    locations: any[];
    novelId: string;
}

export function LocationHierarchyView({ locations, novelId }: LocationHierarchyViewProps) {
    const [editLocation, setEditLocation] = useState<Location | null>(null);

    // Separate locations by hierarchy level
    const rootLocations = locations.filter(loc => !loc.parentLocationId);
    const level1Locations = locations.filter(loc => {
        if (!loc.parentLocationId) return false;
        const parent = locations.find(l => l.id === loc.parentLocationId);
        return parent && !parent.parentLocationId; // Parent is root
    });
    const level2Locations = locations.filter(loc => {
        if (!loc.parentLocationId) return false;
        const parent = locations.find(l => l.id === loc.parentLocationId);
        if (!parent || !parent.parentLocationId) return false;
        const grandparent = locations.find(l => l.id === parent.parentLocationId);
        return grandparent && !grandparent.parentLocationId; // Grandparent is root
    });

    return (
        <>
            <div className="space-y-6">
                {/* Root Locations (Level 0) */}
                {rootLocations.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-lg font-semibold">🌍 Root Locations</h2>
                            <Badge variant="outline" className="text-xs">{rootLocations.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {rootLocations.map((location) => (
                                <LocationCard
                                    key={location.id}
                                    location={location}
                                    novelId={novelId}
                                    onEdit={() => setEditLocation(location)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Level 1 Locations */}
                {level1Locations.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-lg font-semibold">📍 Sub-Locations (Level 1)</h2>
                            <Badge variant="outline" className="text-xs">{level1Locations.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pl-4 border-l-2 border-muted">
                            {level1Locations.map((location) => (
                                <LocationCard
                                    key={location.id}
                                    location={location}
                                    novelId={novelId}
                                    onEdit={() => setEditLocation(location)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Level 2 Locations */}
                {level2Locations.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-lg font-semibold">📌 Sub-Locations (Level 2)</h2>
                            <Badge variant="outline" className="text-xs">{level2Locations.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pl-8 border-l-2 border-muted">
                            {level2Locations.map((location) => (
                                <LocationCard
                                    key={location.id}
                                    location={location}
                                    novelId={novelId}
                                    onEdit={() => setEditLocation(location)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            {editLocation && (
                <EditLocationDialog
                    location={editLocation}
                    open={!!editLocation}
                    onOpenChange={(open) => !open && setEditLocation(null)}
                />
            )}
        </>
    );
}
