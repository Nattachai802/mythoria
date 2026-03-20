import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { chapters, characters, chapterStylometry, notes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ novelId: string; chapterId: string }> }
) {
  try {
    const { novelId, chapterId } = await params;
    
    // 1. Fetch chapter content from linked notes
    const chapterNotes = await db.query.notes.findMany({
      where: eq(notes.linkedToChapterId, chapterId),
      orderBy: (notes, { asc }) => [asc(notes.createdAt)],
    });

    let plainText = "";
    if (chapterNotes.length > 0) {
        for (const note of chapterNotes) {
            if (note.content) {
                const contentObj = note.content as any;
                const text = (contentObj.text || contentObj).toString().replace(/<[^>]*>?/gm, " ") || "";
                plainText += text + "\n\n";
            }
        }
    } else {
        // Fallback to chapter table if no notes are linked yet
        const chapter = await db.query.chapters.findFirst({
            where: eq(chapters.id, chapterId),
        });
        if (chapter) {
            plainText = chapter.plainText || "";
            if (!plainText && chapter.content) {
                const contentObj = chapter.content as any;
                plainText = (contentObj.text || contentObj).toString().replace(/<[^>]*>?/gm, " ") || "";
            }
        }
    }

    if (!plainText.trim()) {
      return NextResponse.json({ error: "ไม่พบเนื้อหาในตอนนี้ (ต้องมีโน้ตที่ผูกกับ Chapter)" }, { status: 400 });
    }

    // 2. Fetch all characters to provide context for the Python API
    const novelCharacters = await db.query.characters.findMany({
      where: eq(characters.novelId, novelId),
      columns: { name: true, aliases: true }
    });
    
    const characterNames = novelCharacters.flatMap(c => {
       const names = [c.name];
       if (Array.isArray(c.aliases)) {
          names.push(...(c.aliases as string[]));
       }
       return names;
    });

    // 3. Send request to Python API
    const pythonResponse = await fetch("http://localhost:8000/analyze-chapter-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            novel_id: novelId,
            chapter_text: plainText,
            character_names: characterNames
        })
    });

    if (!pythonResponse.ok) throw new Error("Failed to connect to stylometry service");
    const result = await pythonResponse.json();
    if (!result.success) throw new Error(result.error || "Analysis failed");

    const { style_metrics } = result;

    // 4. Save to Database
    const existing = await db.query.chapterStylometry.findFirst({
        where: eq(chapterStylometry.chapterId, chapterId)
    });

    if (existing) {
        await db.update(chapterStylometry)
          .set({
              pacingAndMood: style_metrics.pacing_and_mood,
              authorNarrationStyle: style_metrics.author_narration_style,
              characterDialogueVibes: style_metrics.character_dialogue_vibes,
              lexicalRichness: style_metrics.lexical_richness,
              chapterAnatomy: style_metrics.chapter_anatomy,
          })
          .where(eq(chapterStylometry.id, existing.id));
    } else {
        await db.insert(chapterStylometry).values({
            chapterId,
            novelId,
            pacingAndMood: style_metrics.pacing_and_mood,
            authorNarrationStyle: style_metrics.author_narration_style,
            characterDialogueVibes: style_metrics.character_dialogue_vibes,
            lexicalRichness: style_metrics.lexical_richness,
            chapterAnatomy: style_metrics.chapter_anatomy,
        });
    }

    return NextResponse.json({ success: true, data: style_metrics });

  } catch (error: any) {
    console.error("[Stylometry Analysis Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ novelId: string; chapterId: string }> }
) {
    try {
        const { chapterId } = await params;
        const data = await db.query.chapterStylometry.findFirst({
            where: eq(chapterStylometry.chapterId, chapterId)
        });
        return NextResponse.json({ success: true, data });
    } catch(error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
