import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { notes, characters, noteStylometry } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ novelId: string; noteId: string }> }
) {
  try {
    const { novelId, noteId } = await params;
    
    // 1. Fetch note content
    const note = await db.query.notes.findFirst({
      where: eq(notes.id, noteId),
    });
    
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const contentObj = note.content as any;
    const plainText = (contentObj.text || contentObj).toString().replace(/<[^>]*>?/gm, " ") || "";

    if (!plainText.trim()) {
      return NextResponse.json({ error: "ไม่พบเนื้อหาในโน้ตนี้" }, { status: 400 });
    }

    // 2. Fetch all characters for context
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

    // 4. Save to Database (noteStylometry table)
    const existing = await db.query.noteStylometry.findFirst({
        where: eq(noteStylometry.noteId, noteId)
    });

    if (existing) {
        await db.update(noteStylometry)
          .set({
              pacingAndMood: style_metrics.pacing_and_mood,
              authorNarrationStyle: style_metrics.author_narration_style,
              characterDialogueVibes: style_metrics.character_dialogue_vibes,
              lexicalRichness: style_metrics.lexical_richness,
              chapterAnatomy: style_metrics.chapter_anatomy,
          })
          .where(and(eq(noteStylometry.id, existing.id), eq(noteStylometry.novelId, novelId)));
    } else {
        await db.insert(noteStylometry).values({
            noteId,
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
    console.error("[Note Stylometry Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
