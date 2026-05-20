"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, List, Loader2 } from "lucide-react";
import { LocationHierarchyView } from "./location-hierarchy-view";

const LocationMap = dynamic(
    () => import("./location-map").then(m => ({ default: m.LocationMap })),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> }
);

interface LocationsViewProps {
    locations: any[];
    connections: any[];
    novelId: string;
}

export function LocationsView({ locations, connections, novelId }: LocationsViewProps) {
    return (
        <Tabs defaultValue="map" className="w-full">
            <TabsList className="mb-4">
                <TabsTrigger value="map" className="flex items-center gap-2">
                    <Map className="w-4 h-4" />
                    Map View
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Hierarchy View
                </TabsTrigger>
            </TabsList>

            <TabsContent value="map">
                <LocationMap
                    locations={locations}
                    connections={connections}
                    novelId={novelId}
                />
            </TabsContent>

            <TabsContent value="hierarchy">
                <LocationHierarchyView
                    locations={locations}
                    novelId={novelId}
                />
            </TabsContent>
        </Tabs>
    );
}
