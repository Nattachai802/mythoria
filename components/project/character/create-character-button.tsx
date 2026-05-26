"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CharacterSheet } from "./character-sheet";
import { useRouter } from "next/navigation";

interface CreateCharacterButtonProps {
    novelId: string;
}

export function CreateCharacterButton({ novelId }: CreateCharacterButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Character
            </Button>
            <CharacterSheet
                open={open}
                onOpenChange={setOpen}
                novelId={novelId}
                character={null}
                onSaved={() => router.refresh()}
            />
        </>
    );
}
