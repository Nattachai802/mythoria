"use client";

import { LocationCard } from "./location-card";
import { Badge } from "@/components/ui/badge";

interface LocationHierarchyViewProps {
    locations: any[];
    novelId: string;
}

export function LocationHierarchyView({ locations, novelId }: LocationHierarchyViewProps) {
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
        <div className="space-y-8">
            {/* Root Locations (Level 0) */}
            {rootLocations.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold">Root Locations</h2>
                        <Badge variant="outline">{rootLocations.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {rootLocations.map((location) => (
                            <LocationCard
                                key={location.id}
                                location={location}
                                novelId={novelId}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Level 1 Locations */}
            {level1Locations.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold">Sub-Locations (Level 1)</h2>
                        <Badge variant="outline">{level1Locations.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pl-6 border-l-4 border-muted">
                        {level1Locations.map((location) => (
                            <LocationCard
                                key={location.id}
                                location={location}
                                novelId={novelId}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Level 2 Locations */}
            {level2Locations.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-semibold">Sub-Locations (Level 2)</h2>
                        <Badge variant="outline">{level2Locations.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pl-12 border-l-4 border-muted">
                        {level2Locations.map((location) => (
                            <LocationCard
                                key={location.id}
                                location={location}
                                novelId={novelId}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
