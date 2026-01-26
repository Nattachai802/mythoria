"use client";

import { Keyboard } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
    const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
    const metaKey = isMac ? "⌘" : "Ctrl";

    const shortcuts = [
        { keys: [metaKey, "K"], description: "เปิด Search" },
        { keys: [metaKey, "S"], description: "บันทึก" },
        { keys: ["?"], description: "แสดง Keyboard Shortcuts" },
        { keys: ["Esc"], description: "ปิด Dialog" },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Keyboard Shortcuts
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-1">
                    {shortcuts.map((shortcut, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50 transition-colors"
                        >
                            <span className="text-sm text-muted-foreground">
                                {shortcut.description}
                            </span>
                            <div className="flex gap-1">
                                {shortcut.keys.map((key, j) => (
                                    <span key={j}>
                                        <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono shadow-sm">
                                            {key}
                                        </kbd>
                                        {j < shortcut.keys.length - 1 && (
                                            <span className="text-muted-foreground mx-0.5">+</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
