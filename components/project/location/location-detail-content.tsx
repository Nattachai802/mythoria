"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pencil, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EditLocationDialog } from "@/components/project/location/edit-location-dialog";
import { LocationCharacters } from "@/components/project/location/location-characters";
import { LocationPresence } from "@/components/project/location/location-presence";
import { Location } from "@/db/schema";

interface LocationDetailContentProps {
    location: Location;
    novelId: string;
}

const TYPE_COLORS = {
    city: "bg-blue-500",
    country: "bg-purple-500",
    building: "bg-orange-500",
    forest: "bg-green-500",
    mountain: "bg-gray-500",
    ocean: "bg-cyan-500",
    desert: "bg-yellow-500",
    village: "bg-amber-500",
};

export function LocationDetailContent({
    location,
    novelId
}: LocationDetailContentProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    return (
        <>
            <div className="p-8 max-w-5xl mx-auto">
                <div className="mb-6">
                    <Link href={`/dashboard/project/${novelId}/locations`}>
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Locations
                        </Button>
                    </Link>

                    <div className="flex items-start gap-6">
                        <div className="w-48 h-64 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                            {location.image ? (
                                <img
                                    src={location.image}
                                    alt={location.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <MapPin className="w-24 h-24 text-muted-foreground" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-4xl font-bold">{location.name}</h1>
                                    {location.type && (
                                        <Badge
                                            className={`mt-2 ${TYPE_COLORS[location.type as keyof typeof TYPE_COLORS] || "bg-gray-500"} text-white`}
                                        >
                                            {location.type}
                                        </Badge>
                                    )}
                                </div>
                                <Button onClick={() => setEditDialogOpen(true)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            </div>

                            {location.description && (
                                <p className="text-muted-foreground mt-4">
                                    {location.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <Separator className="my-8" />

                <div className="space-y-6">
                    {location.description && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{location.description}</p>
                            </CardContent>
                        </Card>
                    )}

                    <LocationCharacters locationId={location.id} novelId={novelId} />

                    {/* AI-Extracted Character Presence */}
                    <Card>
                        <CardHeader>
                            <CardTitle>ตัวละครที่ปรากฏ (AI)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <LocationPresence locationId={location.id} novelId={novelId} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Related Events</CardTitle>
                                <Button variant="outline" size="sm">
                                    Link Event
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm">
                                No events linked yet.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <EditLocationDialog
                location={location}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />
        </>
    );
}
