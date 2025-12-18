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
import { MoreVertical, Pencil, Trash2, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";
import { deleteLocation } from "@/server/locations";
import { useState } from "react";
import { toast } from "sonner";

interface LocationCardProps {
    location: Location;
    novelId: string;
    onEdit?: () => void;
}

const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
    city: { color: "bg-blue-500", icon: "🏙️" },
    country: { color: "bg-purple-500", icon: "🗺️" },
    building: { color: "bg-orange-500", icon: "🏛️" },
    forest: { color: "bg-green-500", icon: "🌲" },
    mountain: { color: "bg-gray-500", icon: "⛰️" },
    ocean: { color: "bg-cyan-500", icon: "🌊" },
    desert: { color: "bg-yellow-500", icon: "🏜️" },
    village: { color: "bg-amber-500", icon: "🏘️" },
    dungeon: { color: "bg-rose-500", icon: "🏰" },
    cave: { color: "bg-stone-500", icon: "🕳️" },
};

export function LocationCard({ location, novelId, onEdit }: LocationCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const typeConfig = TYPE_CONFIG[location.type || ""] || { color: "bg-gray-500", icon: "📍" };

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
        <Card className="group hover:shadow-md transition-all hover:border-primary/30 overflow-hidden">
            <CardContent className="p-0">
                <div className="flex items-center gap-3 p-3">
                    {/* Icon/Image */}
                    <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {location.image ? (
                            <img
                                src={location.image}
                                alt={location.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-2xl">{typeConfig.icon}</span>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/dashboard/project/${novelId}/locations/${location.id}`}
                                className="font-medium truncate hover:underline hover:text-primary"
                            >
                                {location.name}
                            </Link>
                            {location.type && (
                                <Badge
                                    variant="secondary"
                                    className={`${typeConfig.color} text-white text-xs px-1.5 py-0`}
                                >
                                    {location.type}
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {(location as any).parentLocation && (
                                <span className="truncate">
                                    📍 {(location as any).parentLocation.name}
                                </span>
                            )}
                            {(location as any).childLocations?.length > 0 && (
                                <span>
                                    • {(location as any).childLocations.length} sub
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        <Link href={`/dashboard/project/${novelId}/locations/${location.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </Link>

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
                </div>
            </CardContent>
        </Card>
    );
}
