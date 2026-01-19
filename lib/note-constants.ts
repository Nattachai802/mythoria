// Note Status Types and Constants
// แยกออกมาเพราะ "use server" file ห้าม export object

export type NoteStatus = "draft" | "writing" | "needs_rewrite" | "published";

export const NOTE_STATUS_CONFIG = {
    draft: { label: "ร่าง", color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800" },
    writing: { label: "กำลังเขียน", color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
    needs_rewrite: { label: "รอ Rewrite", color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
    published: { label: "เผยแพร่", color: "text-green-500", bgColor: "bg-green-100 dark:bg-green-900/30" },
} as const;
