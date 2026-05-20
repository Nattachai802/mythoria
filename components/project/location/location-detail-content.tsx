"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
    Pencil,
    MapPin,
    ArrowLeft,
    Sparkles,
    Thermometer,
    AlertTriangle,
    Users,
    Gem,
    Lock,
    History,
    Landmark,
    Globe,
    Lightbulb,
    BookOpen,
} from "lucide-react";
import Link from "next/link";
import { EditLocationDialog } from "@/components/project/location/edit-location-dialog";
import { LocationCharacters } from "@/components/project/location/location-characters";
import { LocationPresence } from "@/components/project/location/location-presence";
import { EntityIdeasTab } from "@/components/project/shared/entity-ideas-tab";
import { Location } from "@/db/schema";

interface LocationDetailContentProps {
    location: Location;
    novelId: string;
    ideas?: any[];
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; gradient: string }> = {
    city: { color: "bg-blue-500", icon: "🏙️", gradient: "from-blue-500/20 to-blue-600/5" },
    country: { color: "bg-purple-500", icon: "🗺️", gradient: "from-purple-500/20 to-purple-600/5" },
    building: { color: "bg-orange-500", icon: "🏛️", gradient: "from-orange-500/20 to-orange-600/5" },
    forest: { color: "bg-green-500", icon: "🌲", gradient: "from-green-500/20 to-green-600/5" },
    mountain: { color: "bg-gray-500", icon: "⛰️", gradient: "from-gray-500/20 to-gray-600/5" },
    ocean: { color: "bg-cyan-500", icon: "🌊", gradient: "from-cyan-500/20 to-cyan-600/5" },
    desert: { color: "bg-yellow-500", icon: "🏜️", gradient: "from-yellow-500/20 to-yellow-600/5" },
    village: { color: "bg-amber-500", icon: "🏘️", gradient: "from-amber-500/20 to-amber-600/5" },
    dungeon: { color: "bg-rose-500", icon: "🏰", gradient: "from-rose-500/20 to-rose-600/5" },
    cave: { color: "bg-stone-500", icon: "🕳️", gradient: "from-stone-500/20 to-stone-600/5" },
};

export function LocationDetailContent({
    location,
    novelId,
    ideas = []
}: LocationDetailContentProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const typeConfig = TYPE_CONFIG[location.type || ""] || { color: "bg-gray-500", icon: "📍", gradient: "from-gray-500/20 to-gray-600/5" };
    const loc = location as any; // For new fields

    return (
        <>
            <div className="max-w-6xl mx-auto">
                {/* Back button */}
                <Link href={`/dashboard/project/${novelId}/worldbuilding`}>
                    <Button variant="ghost" className="mb-4">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to World Building
                    </Button>
                </Link>

                {/* Hero Section */}
                <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${typeConfig.gradient} border mb-8`}>
                    <div className="absolute inset-0 bg-grid-white/5" />

                    <div className="relative p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Image */}
                            <div className="w-full md:w-72 h-80 bg-background/50 backdrop-blur rounded-xl overflow-hidden flex-shrink-0 border shadow-xl">
                                {location.image ? (
                                    <img
                                        src={location.image}
                                        alt={location.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                        <span className="text-7xl">{typeConfig.icon}</span>
                                        <MapPin className="w-12 h-12 text-muted-foreground/30" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 flex flex-col">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-4xl">{typeConfig.icon}</span>
                                            <Badge className={`${typeConfig.color} text-white`}>
                                                {location.type || "location"}
                                            </Badge>
                                        </div>
                                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{location.name}</h1>
                                    </div>
                                    <Button onClick={() => setEditDialogOpen(true)} size="lg">
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                </div>

                                {location.description && (
                                    <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
                                        {location.description}
                                    </p>
                                )}

                                {/* Quick Stats */}
                                <div className="flex flex-wrap gap-3 mt-6">
                                    {loc.climate && (
                                        <Badge variant="secondary" className="gap-1 py-1.5 px-3">
                                            <Thermometer className="h-3 w-3" />
                                            {loc.climate}
                                        </Badge>
                                    )}
                                    {loc.inhabitants && (
                                        <Badge variant="secondary" className="gap-1 py-1.5 px-3">
                                            <Users className="h-3 w-3" />
                                            {loc.inhabitants}
                                        </Badge>
                                    )}
                                </div>

                                {/* Highlights */}
                                {loc.highlights && loc.highlights.length > 0 && (
                                    <div className="mt-6">
                                        <div className="flex flex-wrap gap-2">
                                            {(loc.highlights as string[]).map((h: string, i: number) => (
                                                <Badge key={i} className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 gap-1">
                                                    ✨ {h}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="overview" className="gap-2">
                            <BookOpen className="w-4 h-4" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="ideas" className="gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Ideas
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        {/* Content Grid */}
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {/* Atmosphere Card */}
                            {loc.atmosphere && (
                                <Card className="md:col-span-2 lg:col-span-1 border-l-4 border-l-purple-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Sparkles className="h-5 w-5 text-purple-500" />
                                            บรรยากาศ
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground italic leading-relaxed">
                                            "{loc.atmosphere}"
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Landmarks Card */}
                            {loc.landmarks && loc.landmarks.length > 0 && (
                                <Card className="border-l-4 border-l-blue-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Landmark className="h-5 w-5 text-blue-500" />
                                            จุดสังเกต
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {(loc.landmarks as string[]).map((l: string, i: number) => (
                                                <li key={i} className="flex items-center gap-2 text-sm">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                    {l}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Resources Card */}
                            {loc.resources && loc.resources.length > 0 && (
                                <Card className="border-l-4 border-l-emerald-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Gem className="h-5 w-5 text-emerald-500" />
                                            ทรัพยากร
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {(loc.resources as string[]).map((r: string, i: number) => (
                                                <Badge key={i} className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                    💎 {r}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Dangers Card */}
                            {loc.dangers && loc.dangers.length > 0 && (
                                <Card className="border-l-4 border-l-red-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <AlertTriangle className="h-5 w-5 text-red-500" />
                                            อันตราย
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {(loc.dangers as string[]).map((d: string, i: number) => (
                                                <li key={i} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {d}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Secrets Card */}
                            {loc.secrets && (
                                <Card className="border-l-4 border-l-purple-500 bg-purple-500/5">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Lock className="h-5 w-5 text-purple-500" />
                                            ความลับ
                                        </CardTitle>
                                        <CardDescription>ข้อมูลลับที่ตัวละครอาจค้นพบ</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground italic">
                                            🔒 {loc.secrets}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* History Card */}
                            {loc.history && (
                                <Card className="md:col-span-2 border-l-4 border-l-amber-500">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <History className="h-5 w-5 text-amber-500" />
                                            ประวัติสถานที่
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                            {loc.history}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Sub-locations (พื้นที่รอง) Card */}
                            <Card className="md:col-span-2 lg:col-span-3 border-l-4 border-l-cyan-500">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <MapPin className="h-5 w-5 text-cyan-500" />
                                        พื้นที่รอง (Sub-locations)
                                    </CardTitle>
                                    <CardDescription>สถานที่ย่อยที่อยู่ภายใต้สถานที่นี้</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loc.childLocations && loc.childLocations.length > 0 ? (
                                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                                            {loc.childLocations.map((sub: any) => (
                                                <Link key={sub.id} href={`/dashboard/project/${novelId}/locations/${sub.id}`}>
                                                    <div className="p-4 border rounded-lg hover:border-cyan-500 hover:bg-cyan-500/5 transition-colors group cursor-pointer h-full flex flex-col justify-center">
                                                        <h3 className="font-semibold text-lg group-hover:text-cyan-600 transition-colors">
                                                            {sub.name}
                                                        </h3>
                                                        {sub.type && (
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                {sub.type}
                                                            </p>
                                                        )}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm py-4 text-center border border-dashed rounded-lg">
                                            ยังไม่มีพื้นที่รอง
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Separator className="my-8" />

                        {/* Characters Section */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <LocationCharacters locationId={location.id} novelId={novelId} />

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Globe className="h-5 w-5" />
                                        ตัวละครที่ปรากฏ (AI)
                                    </CardTitle>
                                    <CardDescription>ข้อมูลจากการวิเคราะห์โน้ตอัตโนมัติ</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <LocationPresence locationId={location.id} novelId={novelId} />
                                </CardContent>
                            </Card>
                        </div>

                        <Separator className="my-8" />

                        {/* Related Events */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Related Events</CardTitle>
                                        <CardDescription>เหตุการณ์ที่เกิดขึ้นในสถานที่นี้</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        Link Event
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground text-sm text-center py-8">
                                    ยังไม่มีเหตุการณ์ที่เชื่อมโยง
                                </p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="ideas">
                        <EntityIdeasTab
                            entityType="location"
                            entityId={location.id}
                            entityName={location.name}
                            novelId={novelId}
                            ideas={ideas}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <EditLocationDialog
                location={location}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />
        </>
    );
}
