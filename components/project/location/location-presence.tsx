"use client";

import { useEffect, useState } from "react";
import { MapPin, User, Loader2, ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    getCharactersAtLocation,
    CharacterAtLocation
} from "@/server/character-state-queries";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LocationPresenceProps {
    locationId: string;
    novelId: string;
}

const STATUS_COLORS: Record<string, string> = {
    alive: "text-emerald-600",
    injured: "text-amber-600",
    severely_injured: "text-orange-600",
    unconscious: "text-purple-600",
    dead: "text-red-600",
    escaped: "text-blue-600",
};

const STATUS_LABELS: Record<string, string> = {
    alive: "มีชีวิต",
    injured: "บาดเจ็บ",
    severely_injured: "บาดเจ็บหนัก",
    unconscious: "หมดสติ",
    dead: "เสียชีวิต",
    escaped: "หลบหนี",
};

export function LocationPresence({ locationId, novelId }: LocationPresenceProps) {
    const [characters, setCharacters] = useState<CharacterAtLocation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchCharacters() {
            setIsLoading(true);
            const result = await getCharactersAtLocation(locationId);
            if (result.success) {
                setCharacters(result.characters);
            }
            setIsLoading(false);
        }
        fetchCharacters();
    }, [locationId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (characters.length === 0) {
        return (
            <div className="text-center py-6 text-muted-foreground">
                <MapPin className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-sm">ยังไม่มีข้อมูลตัวละครในสถานที่นี้</p>
                <p className="text-xs mt-1">AI จะวิเคราะห์เมื่อมีการเขียน Note</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>ตัวละครที่เคยปรากฏ ({characters.length})</span>
            </div>

            <div className="space-y-0.5">
                {characters.map((char) => (
                    <Link
                        key={char.characterId}
                        href={`/dashboard/project/${novelId}/characters/${char.characterId}`}
                        className="group flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                        {/* Avatar */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-muted">
                            {char.characterImage ? (
                                <img
                                    src={char.characterImage}
                                    alt={char.characterName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                    <span className="text-xs font-medium text-primary">
                                        {char.characterName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">
                                    {char.characterName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {char.status && (
                                    <span className={cn("font-medium", STATUS_COLORS[char.status])}>
                                        {STATUS_LABELS[char.status] || char.status}
                                    </span>
                                )}
                                {char.mood && (
                                    <>
                                        <span className="opacity-30">•</span>
                                        <span className="truncate">{char.mood}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Note link indicator */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
