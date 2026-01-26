"use client";
import { useEffect, useCallback, useState } from "react";

export const SHORTCUTS = {
  SEARCH: { key: "k", meta: true, label: "Search", description: "เปิด Global Search" },
  SAVE: { key: "s", meta: true, label: "Save", description: "บันทึก" },
  HELP: { key: "?", meta: false, label: "Help", description: "แสดง Shortcuts" },
  ESCAPE: { key: "Escape", meta: false, label: "Escape", description: "ปิด Dialog" },
} as const;


interface UseKeyboardShortcutsOptions {
  onSearch?: () => void;
  onSave?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onSearch, onSave, onHelp, onEscape, enabled = true } = options;
  // Check if user is typing in an input field
  const isInputFocused = useCallback(() => {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toLowerCase();
    return tagName === "input" || tagName === "textarea" || 
           (active as HTMLElement).isContentEditable;
  }, []);
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      // Cmd+K = Search
      if (meta && e.key === "k") {
        e.preventDefault();
        onSearch?.();
        return;
      }
      // Cmd+S = Save
      if (meta && e.key === "s") {
        e.preventDefault();
        onSave?.();
        return;
      }
      // Skip if typing
      if (isInputFocused()) return;
      // ? = Help
      if (e.key === "?") {
        e.preventDefault();
        onHelp?.();
        return;
      }
      // Escape
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onSearch, onSave, onHelp, onEscape, isInputFocused]);
}