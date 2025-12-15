"use client";

import { EditProjectDialog } from "./edit-project-dialog";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface ProjectHeaderActionsProps {
    novelId: string;
    novelTitle: string;
    novelDescription: string;
}

export function ProjectHeaderActions({
    novelId,
    novelTitle,
    novelDescription,
}: ProjectHeaderActionsProps) {
    return (
        <EditProjectDialog
            novelId={novelId}
            initialTitle={novelTitle}
            initialDescription={novelDescription}
            trigger={
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                    <Settings className="h-3 w-3 mr-1" />
                    Edit
                </Button>
            }
        />
    );
}
