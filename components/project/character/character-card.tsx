"use client";

import { Character } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CharacterSheet } from "./character-sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Pencil, Trash2, User } from "lucide-react";
import Link from "next/link";
import { deleteCharacter } from "@/server/character";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface CharacterCardProps {
  character: Character;
  novelId: string;
  onEdit?: () => void;
}

const ROLE_CONFIG = {
  protagonist: { label: "Main", color: "bg-blue-500/80" },
  antagonist: { label: "Villain", color: "bg-red-500/80" },
  supporting: { label: "Support", color: "bg-emerald-500/80" },
  minor: { label: "Minor", color: "bg-zinc-500/80" },
};

export function CharacterCard({ character, novelId, onEdit }: CharacterCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteCharacter(character.id);

    if (result.success) {
      toast.success("Character deleted successfully");
      setIsDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete character");
    }
    setIsDeleting(false);
  };

  const roleConfig = ROLE_CONFIG[character.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.minor;

  return (
    <>
      <Link
        href={`/dashboard/project/${novelId}/characters/${character.id}`}
        className="group relative block aspect-[3/4] rounded-xl overflow-hidden"
      >
        {/* Background Image */}
        {character.image ? (
          <img
            src={character.image}
            alt={character.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <User className="w-16 h-16 text-muted-foreground/40" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Role Badge - Top Left */}
        <div className="absolute top-2 left-2">
          <Badge
            className={cn(
              "text-[10px] font-medium text-white border-0 backdrop-blur-sm",
              roleConfig.color
            )}
          >
            {roleConfig.label}
          </Badge>
        </div>

        {/* Menu - Top Right */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); setIsSheetOpen(true); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setIsDeleteOpen(true); }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Name - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-semibold text-white text-base leading-tight drop-shadow-lg truncate">
            {character.name}
          </h3>
        </div>
      </Link>

      <CharacterSheet
        character={character}
        novelId={novelId}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Character</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{character.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
