"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { GlobalSearch } from "@/components/global-search";

interface KeyboardShortcutsContextType {
    openSearch: () => void;
    openHelp: () => void;
    isSearchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
    const [helpOpen, setHelpOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    useKeyboardShortcuts({
        onSearch: () => setSearchOpen(true),
        onHelp: () => setHelpOpen(true),
        onEscape: () => {
            setHelpOpen(false);
            setSearchOpen(false);
        },
    });

    return (
        <KeyboardShortcutsContext.Provider
            value={{
                openSearch: () => setSearchOpen(true),
                openHelp: () => setHelpOpen(true),
                isSearchOpen: searchOpen,
                setSearchOpen,
            }}
        >
            {children}
            <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
            <GlobalSearch />
        </KeyboardShortcutsContext.Provider>
    );
}

export function useKeyboardShortcutsContext() {
    const ctx = useContext(KeyboardShortcutsContext);
    if (!ctx) {
        throw new Error("useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider");
    }
    return ctx;
}
