"use server";

import { db } from "@/db/drizzle";
import { notes, noteStylometry } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getNovelStylometry(novelId: string) {
    try {
        const data = await db
            .select({
                id: noteStylometry.id,
                noteId: noteStylometry.noteId,
                novelId: noteStylometry.novelId,
                pacingAndMood: noteStylometry.pacingAndMood,
                authorNarrationStyle: noteStylometry.authorNarrationStyle,
                characterDialogueVibes: noteStylometry.characterDialogueVibes,
                lexicalRichness: noteStylometry.lexicalRichness,
                chapterAnatomy: noteStylometry.chapterAnatomy,
                fingerprintAnalysis: noteStylometry.fingerprintAnalysis,
                createdAt: noteStylometry.createdAt,
                chapterTitle: notes.title,
                createdAtNote: notes.createdAt,
            })
            .from(noteStylometry)
            .innerJoin(notes, eq(noteStylometry.noteId, notes.id))
            .where(eq(noteStylometry.novelId, novelId))
            .orderBy(asc(notes.createdAt));

        // Check if any fingerprints are missing
        const hasMissing = data.some(d => !d.fingerprintAnalysis);
        
        if (hasMissing && data.length >= 2) {
            try {
                // Bulk recalculate everything
                // Remap camelCase keys → snake_case for Python compatibility
                const snakeCaseItems = data.map(d => ({
                    id: d.id,
                    lexical_richness: d.lexicalRichness,
                    pacing_and_mood: d.pacingAndMood,
                    chapter_anatomy: d.chapterAnatomy,
                    character_dialogue_vibes: d.characterDialogueVibes,
                }));

                const response = await fetch("http://localhost:8000/analyze-fingerprint-bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: snakeCaseItems })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // Update DB and return recalculated data
                        for (const item of result.results) {
                            await db.update(noteStylometry)
                                .set({ fingerprintAnalysis: item.fingerprint_analysis })
                                .where(eq(noteStylometry.id, item.id));
                            
                            // Update local data for immediate return
                            const localItem = data.find(d => d.id === item.id);
                            if (localItem) localItem.fingerprintAnalysis = item.fingerprint_analysis;
                        }
                    }
                }
            } catch (err) {
                console.error("Bulk fingerprint recalculation failed:", err);
            }
        }
            
        return { success: true, data };
    } catch (error: any) {
        console.error("Failed to fetch novel stylometry:", error);
        return { success: false, error: error.message };
    }
}
