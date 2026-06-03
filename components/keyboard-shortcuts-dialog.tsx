"use client";

import { Keyboard } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KeyboardShortcutsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Shortcut {
    keys: string[];
    description: string;
}

interface ShortcutGroup {
    label: string;
    shortcuts: Shortcut[];
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
    return (
        <div className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">{shortcut.description}</span>
            <div className="flex items-center gap-1 shrink-0 ml-4">
                {shortcut.keys.map((key, j) => (
                    <span key={j} className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono shadow-sm">
                            {key}
                        </kbd>
                        {j < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
    const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
    const mod = isMac ? "⌘" : "Ctrl";
    const alt = isMac ? "⌥" : "Alt";

    const groups: ShortcutGroup[] = [
        {
            label: "ทั่วไป",
            shortcuts: [
                { keys: [mod, "K"], description: "เปิด Global Search" },
                { keys: [mod, "S"], description: "บันทึก" },
                { keys: ["?"], description: "แสดง Keyboard Shortcuts" },
                { keys: ["Esc"], description: "ปิด Dialog / ยกเลิก" },
            ],
        },
        {
            label: "Plot Playground",
            shortcuts: [
                { keys: ["Ctrl", "+"], description: "Zoom In" },
                { keys: ["Ctrl", "-"], description: "Zoom Out" },
                { keys: ["Ctrl", "0"], description: "Reset Zoom" },
            ],
        },
        {
            label: "Rewrite Workspace",
            shortcuts: [
                { keys: [mod, "F"], description: "ค้นหาและแทนที่" },
                { keys: [alt, "P"], description: "สลับโหมดเกลาย่อหน้า" },
                { keys: [mod, "↑"], description: "ย่อหน้าก่อนหน้า" },
                { keys: [mod, "↓"], description: "ย่อหน้าถัดไป" },
                { keys: [alt, "D"], description: "สลับ Word Diff" },
                { keys: [alt, "N"], description: "เพิ่มย่อหน้าใหม่ด้านล่าง" },
                { keys: [alt, "B"], description: "มาร์ก / ยกเลิก Bookmark" },
            ],
        },
        {
            label: "Dialog / Form",
            shortcuts: [
                { keys: [mod, "Enter"], description: "ยืนยัน / บันทึก" },
            ],
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Keyboard Shortcuts
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-2">
                    <div className="space-y-5">
                        {groups.map((group) => (
                            <div key={group.label}>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                                    {group.label}
                                </p>
                                <div className="space-y-0.5">
                                    {group.shortcuts.map((shortcut, i) => (
                                        <ShortcutRow key={i} shortcut={shortcut} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
