"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(
    async () => {
        const RQ = await import("react-quill-new");
        const { Quill } = RQ;
        if (typeof window !== "undefined") {
            (window as any).Quill = Quill;
        }
        const { Mention, MentionBlot } = await import("quill-mention");
        // Register both the blot and the module explicitly on the correct Quill instance.
        // We cannot use quill-mention's autoregister because it imports from the 'quill'
        // package directly, not react-quill-new's bundled Quill, resulting in a different instance.
        Quill.register({ "blots/mention": MentionBlot, "modules/mention": Mention }, true);
        return RQ.default;
    },
    { ssr: false }
);

export interface MentionItem {
    id: string;
    value: string;
    type: "character" | "location" | "lore";
}

interface LoreRichEditorProps {
    value: string;
    onChange: (val: string) => void;
    mentionItems: MentionItem[];
}

export function LoreRichEditor({ value, onChange, mentionItems }: LoreRichEditorProps) {
    const modules = useMemo(() => ({
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
        ],
        mention: {
            allowedChars: /^[A-Za-z\sก-๙]*$/,
            mentionDenotationChars: ["@"],
            minChars: 0,
            isolateCharacter: true,
            source: function (searchTerm: string, renderList: (data: any[], searchTerm: string) => void) {
                // If search term is empty, show top 10 recent items to avoid clutter
                if (searchTerm.length === 0) {
                    renderList(mentionItems.slice(0, 10), searchTerm);
                    return;
                }
                const matches = mentionItems.filter(item => 
                    item.value.toLowerCase().includes(searchTerm.toLowerCase())
                ).slice(0, 15); // Limit to 15 items
                renderList(matches, searchTerm);
            },
            renderItem: (item: any) => {
                const typeIcon = item.type === "character" ? "👤" : item.type === "location" ? "📍" : "📜";
                const typeLabel = item.type === "character" ? "ตัวละคร" : item.type === "location" ? "สถานที่" : "Lore";
                const typeColor = item.type === "character" ? "text-blue-500 bg-blue-500/10" : 
                                  item.type === "location" ? "text-green-500 bg-green-500/10" : 
                                  "text-amber-500 bg-amber-500/10";
                
                return `
                    <div class="flex items-center justify-between p-1.5 w-full">
                        <div class="flex items-center gap-2">
                            <span class="text-sm">${typeIcon}</span>
                            <span class="font-medium text-sm text-foreground">${item.value}</span>
                        </div>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${typeColor}">${typeLabel}</span>
                    </div>
                `;
            }
        }
    }), [mentionItems]);

    return (
        <div className="relative lore-quill-wrapper">
            <style dangerouslySetInnerHTML={{__html: `
                .lore-quill-wrapper .ql-mention-list-container {
                    background-color: hsl(var(--popover));
                    border: 1px solid hsl(var(--border));
                    border-radius: var(--radius);
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    overflow: hidden;
                    z-index: 100;
                    width: 300px;
                    margin-top: 4px;
                }
                .lore-quill-wrapper .ql-mention-list {
                    list-style: none;
                    margin: 0;
                    padding: 4px;
                    max-height: 250px;
                    overflow-y: auto;
                }
                .lore-quill-wrapper .ql-mention-list-item {
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.15s ease;
                }
                .lore-quill-wrapper .ql-mention-list-item.selected {
                    background-color: hsl(var(--accent));
                }
                .lore-quill-wrapper .ql-mention-list-item:hover:not(.selected) {
                    background-color: hsl(var(--accent) / 0.5);
                }
            `}} />
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                className="bg-background rounded-md border"
                placeholder="เล่าเรื่องราว ตำนาน หรือเหตุการณ์ (พิมพ์ @ เพื่ออ้างอิง)..."
            />
        </div>
    );
}
