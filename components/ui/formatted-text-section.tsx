"use client";

import { cn } from "@/lib/utils";
import { Fragment } from "react";

interface FormattedTextSectionProps {
    text: string;
    className?: string;
}

interface ParsedSection {
    type: "paragraph" | "header" | "list";
    content: string;
    items?: string[];
}

/**
 * Parse text into structured sections based on formatting patterns:
 * - Double newline (\n\n) → New section
 * - Lines ending with : → Section header
 * - Lines starting with -, •, *, หรือ numbers (1. 2.) → List items
 */
function parseTextIntoSections(text: string): ParsedSection[] {
    if (!text) return [];

    // Split by double newlines to get major sections
    const rawSections = text.split(/\n\n+/).filter(Boolean);
    const sections: ParsedSection[] = [];

    for (const rawSection of rawSections) {
        const trimmed = rawSection.trim();
        if (!trimmed) continue;

        const lines = trimmed.split("\n").filter(Boolean);

        // Check if this section is primarily a list
        const bulletPattern = /^[\-\•\*\–\→]\s+|^\d+[\.\)]\s+/;
        const listLines = lines.filter(line => bulletPattern.test(line.trim()));
        const isListSection = listLines.length > 0 && listLines.length >= lines.length * 0.5;

        if (isListSection) {
            // Extract list items and any header
            const items: string[] = [];
            let header = "";

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (bulletPattern.test(line)) {
                    // Remove bullet and add as list item
                    items.push(line.replace(bulletPattern, "").trim());
                } else if (i === 0 && line.endsWith(":")) {
                    // First line ending with : is a header
                    header = line.slice(0, -1).trim();
                } else if (i === 0) {
                    // First non-bullet line could be a header
                    header = line;
                } else {
                    // Add as list item anyway
                    items.push(line);
                }
            }

            if (header) {
                sections.push({ type: "header", content: header });
            }
            if (items.length > 0) {
                sections.push({ type: "list", content: "", items });
            }
        } else {
            // Check if first line is a header (ends with : or is short)
            const firstLine = lines[0].trim();
            const isHeader = firstLine.endsWith(":") ||
                (firstLine.length < 50 && lines.length > 1 && !firstLine.includes("。") && !firstLine.includes("。"));

            if (isHeader && lines.length > 1) {
                sections.push({
                    type: "header",
                    content: firstLine.endsWith(":") ? firstLine.slice(0, -1).trim() : firstLine
                });
                sections.push({
                    type: "paragraph",
                    content: lines.slice(1).join("\n")
                });
            } else {
                sections.push({
                    type: "paragraph",
                    content: trimmed
                });
            }
        }
    }

    return sections;
}

export function FormattedTextSection({ text, className }: FormattedTextSectionProps) {
    const sections = parseTextIntoSections(text);

    if (sections.length === 0) {
        return <p className={cn("text-muted-foreground", className)}>-</p>;
    }

    return (
        <div className={cn("space-y-4", className)}>
            {sections.map((section, index) => (
                <Fragment key={index}>
                    {section.type === "header" && (
                        <div className="flex items-center gap-2.5 pt-3 first:pt-0">
                            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-sm shadow-primary/30" />
                            <h4 className="text-sm font-bold text-primary dark:text-primary/90 tracking-tight">
                                {section.content}
                            </h4>
                        </div>
                    )}

                    {section.type === "paragraph" && (
                        <div className="relative pl-4 py-2 rounded-r-lg bg-gradient-to-r from-muted/40 to-transparent border-l-2 border-primary/30 hover:border-primary/50 hover:from-muted/60 transition-all duration-200">
                            <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                                {section.content}
                            </p>
                        </div>
                    )}

                    {section.type === "list" && section.items && (
                        <ul className="space-y-2 pl-1">
                            {section.items.map((item, itemIndex) => (
                                <li
                                    key={itemIndex}
                                    className="flex items-start gap-2.5 text-sm text-foreground/85 py-1.5 px-3 rounded-lg bg-gradient-to-r from-muted/30 to-transparent hover:from-muted/50 transition-colors"
                                >
                                    <span className="text-primary mt-0.5 text-[10px] font-bold">▸</span>
                                    <span className="leading-relaxed">{item}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* More visible divider between sections */}
                    {index < sections.length - 1 && section.type !== "header" && (
                        <div className="flex items-center gap-2 py-1">
                            <div className="h-px flex-1 bg-gradient-to-r from-border/60 via-border to-transparent" />
                            <div className="w-1 h-1 rounded-full bg-border/60" />
                            <div className="h-px flex-1 bg-gradient-to-l from-border/60 via-border to-transparent" />
                        </div>
                    )}
                </Fragment>
            ))}
        </div>
    );
}
