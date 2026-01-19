"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteAllIdeas } from "@/server/idea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteAllIdeasButtonProps {
    novelId: string;
    ideaCount: number;
}

export function DeleteAllIdeasButton({ novelId, ideaCount }: DeleteAllIdeasButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteAllIdeas(novelId);

            if (result.success) {
                toast.success(`Deleted ${result.count} ideas`);
                window.location.reload();
            } else {
                toast.error(result.error || "Failed to delete ideas");
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete ideas");
        } finally {
            setIsDeleting(false);
        }
    };

    if (ideaCount === 0) return null;

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                >
                    <Trash2 className="w-4 h-4" />
                    Delete All
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        Delete All Ideas?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete <strong>{ideaCount} ideas</strong> from this project.
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? "Deleting..." : `Delete ${ideaCount} Ideas`}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
