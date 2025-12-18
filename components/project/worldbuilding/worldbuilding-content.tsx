"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ScrollText, Bug, MapPin } from "lucide-react";
import { ItemsView } from "./items-view";
import { LoreTimeline } from "./lore-timeline";
import { EntitiesView } from "./entities-view";
import { LocationsView } from "@/components/project/location/locations-view";
import { CreateLocationDialog } from "@/components/project/location/create-location-dialog";

interface WorldBuildingContentProps {
    novelId: string;
    novel: {
        id: string;
        title: string;
        characters?: { id: string; name: string }[];
        locations?: any[];
    };
    items: any[];
    loreEntries: any[];
    loreGroups: any[];
    eras: any[];
    entities: any[];
    connections: any[];
}

export function WorldBuildingContent({
    novelId,
    novel,
    items,
    loreEntries,
    loreGroups,
    eras,
    entities,
    connections,
}: WorldBuildingContentProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("locations");

    const handleRefresh = () => {
        router.refresh();
    };

    // Get characters and locations from novel for linking
    const characters = (novel as any).characters || [];
    const locations = (novel as any).locations || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">🌍 World Building</h1>
                <p className="text-muted-foreground mt-1">
                    จัดการสถานที่ ไอเทม ประวัติศาสตร์ และสิ่งมีชีวิตในโลกของคุณ
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "locations" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("locations")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Locations</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{locations.length}</div>
                        <p className="text-xs text-muted-foreground">สถานที่และแผนที่</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "items" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("items")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Items</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{items.length}</div>
                        <p className="text-xs text-muted-foreground">ของวิเศษและอาวุธ</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "lore" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("lore")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Lore</CardTitle>
                        <ScrollText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loreEntries.length}</div>
                        <p className="text-xs text-muted-foreground">เหตุการณ์และตำนาน</p>
                    </CardContent>
                </Card>

                <Card
                    className={`cursor-pointer transition-colors ${activeTab === "entities" ? "border-primary" : "hover:bg-muted/50"}`}
                    onClick={() => setActiveTab("entities")}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Entities</CardTitle>
                        <Bug className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{entities.length}</div>
                        <p className="text-xs text-muted-foreground">สิ่งมีชีวิตและมอนสเตอร์</p>
                    </CardContent>
                </Card>
            </div>

            {/* Create Location Button */}
            {activeTab === "locations" && (
                <div className="flex justify-end">
                    <CreateLocationDialog novelId={novelId} />
                </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-lg grid-cols-4">
                    <TabsTrigger value="locations" className="gap-2">
                        <MapPin className="h-4 w-4" />
                        Locations
                    </TabsTrigger>
                    <TabsTrigger value="items" className="gap-2">
                        <Package className="h-4 w-4" />
                        Items
                    </TabsTrigger>
                    <TabsTrigger value="lore" className="gap-2">
                        <ScrollText className="h-4 w-4" />
                        Lore
                    </TabsTrigger>
                    <TabsTrigger value="entities" className="gap-2">
                        <Bug className="h-4 w-4" />
                        Entities
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="locations" className="mt-6">
                    {locations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                            <p className="text-lg mb-2">ยังไม่มีสถานที่</p>
                            <p className="text-sm mb-4">สร้างสถานที่แรกของคุณเพื่อเริ่มต้นสร้างโลก</p>
                            <CreateLocationDialog novelId={novelId} />
                        </div>
                    ) : (
                        <LocationsView
                            locations={locations}
                            connections={connections}
                            novelId={novelId}
                        />
                    )}
                </TabsContent>

                <TabsContent value="items" className="mt-6">
                    <ItemsView
                        items={items}
                        novelId={novelId}
                        characters={characters}
                        locations={locations}
                        onRefresh={handleRefresh}
                    />
                </TabsContent>

                <TabsContent value="lore" className="mt-6">
                    <LoreTimeline
                        entries={loreEntries}
                        groups={loreGroups}
                        eras={eras}
                        novelId={novelId}
                        onRefresh={handleRefresh}
                    />
                </TabsContent>

                <TabsContent value="entities" className="mt-6">
                    <EntitiesView
                        entities={entities}
                        novelId={novelId}
                        onRefresh={handleRefresh}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

