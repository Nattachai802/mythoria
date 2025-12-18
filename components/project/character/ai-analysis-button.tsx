"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AIAnalysisDialog } from "@/components/project/character/ai-analysis-dialog";

interface AIAnalysisButtonProps {
    novelId: string;
}

export function AIAnalysisButton({ novelId }: AIAnalysisButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI วิเคราะห์
            </Button>

            <AIAnalysisDialog
                novelId={novelId}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    );
}
