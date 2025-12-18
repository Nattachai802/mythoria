import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { chapters, characters, notes } from "@/db/schema";
import { eq, asc, isNotNull } from "drizzle-orm";

type Props = {
    params: Promise<{ novelId: string }>;
};

// Helper: Strip HTML tags from string
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
}

// Helper: Extract plain text from Quill Delta or Tiptap JSON content
function extractPlainText(content: unknown): string {
    if (!content) return "";

    // If it's already a string, strip HTML and return it
    if (typeof content === "string") return stripHtml(content);

    // If it's an array (Quill Delta ops format)
    if (Array.isArray(content)) {
        let text = "";
        for (const item of content) {
            if (typeof item === "string") {
                text += item;
            } else if (item && typeof item === "object") {
                const op = item as Record<string, unknown>;
                if (typeof op.insert === "string") {
                    text += op.insert;
                }
            }
        }
        return text.trim();
    }

    // If it's Quill Delta format { ops: [...] }
    if (typeof content === "object" && content !== null) {
        const contentObj = content as Record<string, unknown>;

        if (Array.isArray(contentObj.ops)) {
            let text = "";
            for (const op of contentObj.ops) {
                if (typeof op.insert === "string") {
                    text += op.insert;
                }
            }
            return text.trim();
        }

        // Tiptap/ProseMirror format
        const extractFromNode = (node: Record<string, unknown>): string => {
            let text = "";

            if (node.text && typeof node.text === "string") {
                text += node.text;
            }

            if (Array.isArray(node.content)) {
                for (const child of node.content) {
                    text += extractFromNode(child as Record<string, unknown>);
                }
            }

            if (node.type === "paragraph" || node.type === "heading") {
                text += "\n";
            }

            return text;
        };

        return extractFromNode(contentObj).trim();
    }

    return "";
}

// GET - ดึง chapters (พร้อม notes) และ characters สำหรับ AI analysis
export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;

        // Get all chapters
        const allChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            columns: {
                id: true,
                title: true,
                orderIndex: true,
            },
            orderBy: [asc(chapters.orderIndex)],
        });

        // Get all notes linked to chapters with chapter info
        const linkedNotes = await db.query.notes.findMany({
            where: eq(notes.novelId, novelId),
            columns: {
                id: true,
                title: true,
                content: true,
                linkedToChapterId: true,
            },
        });

        // Create chapter lookup map
        const chapterMap = new Map(allChapters.map(c => [c.id, c]));

        // Process notes as individual documents for analysis
        const processedNotes = linkedNotes
            .filter(note => note.linkedToChapterId) // Only notes linked to chapters
            .map((note) => {
                const plainText = extractPlainText(note.content);
                const chapter = chapterMap.get(note.linkedToChapterId!);

                return {
                    id: note.id,
                    title: note.title, // Note title
                    chapterId: note.linkedToChapterId,
                    chapterTitle: chapter?.title || "Unknown",
                    orderIndex: chapter?.orderIndex ?? 0,
                    plainText,
                };
            })
            .filter(note => note.plainText.length > 0) // Only notes with content
            .sort((a, b) => a.orderIndex - b.orderIndex); // Sort by chapter order

        // Get all characters with aliases
        const allCharacters = await db.query.characters.findMany({
            where: eq(characters.novelId, novelId),
            columns: {
                id: true,
                name: true,
                role: true,
                description: true,
                aliases: true,
            },
        });

        console.log(`[analysis-data] Total: ${processedNotes.length} notes, ${allCharacters.length} characters`);
        console.log(`[analysis-data] Notes with content: ${processedNotes.filter(n => n.plainText.length > 0).length}`);

        return NextResponse.json({
            success: true,
            // Return notes instead of chapters for per-note analysis
            chapters: processedNotes, // Keep as 'chapters' for backward compatibility
            characters: allCharacters,
        });
    } catch (error) {
        console.error("Error fetching analysis data:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch data" },
            { status: 500 }
        );
    }
}
