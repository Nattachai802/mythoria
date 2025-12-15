"use client";

import { Location } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, MapPin } from "lucide-react";
import Link from "next/link";
import { deleteLocation } from "@/server/locations";
import { useState } from "react";
import { toast } from "sonner";

interface LocationCardProps {
    location: Location;
    novelId: string;
    onEdit?: () => void;
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

export function LocationCard({ location, novelId, onEdit }: LocationCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${location.name}"?`)) {
            return;
        }

        setIsDeleting(true);
        const result = await deleteLocation(location.id);

        if (result.success) {
            toast.success("Location deleted successfully");
        } else {
            toast.error(result.error || "Failed to delete location");
            setIsDeleting(false);
        }
    };

    return (
        <Card className="group hover:shadow-lg transition-shadow overflow-hidden">
            <Link href={`/dashboard/project/${novelId}/locations/${location.id}`}>
                <div className="aspect-[3/4] bg-muted relative">
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
            </Link>

            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <Link href={`/dashboard/project/${novelId}/locations/${location.id}`}>
                            <h3 className="font-semibold text-lg truncate hover:underline">
                                {location.name}
                            </h3>
                        </Link>
                        {location.type && (
                            <Badge
                                variant="secondary"
                                className={`mt-1 ${TYPE_COLORS[location.type as keyof typeof TYPE_COLORS] || "bg-gray-500"} text-white`}
                            >
                                {location.type}
                            </Badge>
                        )}

                        {/* Hierarchy Info */}
                        <div className="mt-2 space-y-1">
                            {(location as any).parentLocation && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    📍 Part of: <span className="font-medium">{(location as any).parentLocation.name}</span>
                                </p>
                            )}
                            {(location as any).childLocations && (location as any).childLocations.length > 0 && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    📍 Contains: <span className="font-medium">{(location as any).childLocations.length} sub-location{(location as any).childLocations.length !== 1 ? 's' : ''}</span>
                                </p>
                            )}
                        </div>

                        {location.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {location.description}
                            </p>
                        )}
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEdit}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="text-red-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isDeleting ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}
