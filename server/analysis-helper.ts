'use server';

import { db } from "@/db/drizzle";
import { chapterCharacters, notes, characters, noteCharacters } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

// ฟังก์ชั่นหลักสำหรับ Scan หาตัวละครและอัปเดตข้อมูล (รวม Cast Deck)
export async function syncChapterCharactersFromNotes(chapterId: string, novelId: string) {
    console.log(`Syncing characters for chapter: ${chapterId}`);
    try {
        // 1. ดึง Note ทั้งหมดที่เชื่อมกับ Chapter นี้
        const linkedNotes = await db.query.notes.findMany({
            where: (n, { eq, and }) => and(
                eq(n.linkedToChapterId, chapterId),
                eq(n.novelId, novelId)
            ),
            with: {
                characters: {
                    with: {
                        character: true
                    }
                }
            }
        });

        if (linkedNotes.length === 0) {
            // ถ้าไม่มี Note เลย ให้ล้างข้อมูลเก่าออก
            await db.delete(chapterCharacters).where(eq(chapterCharacters.chapterId, chapterId));
            return;
        }

        // 2. ดึงตัวละครทั้งหมดในโปรเจกต์มาเพื่อใช้ค้นหา
        const allCharacters = await db.query.characters.findMany({
            where: (c, { eq }) => eq(c.novelId, novelId)
        });

        // 3. รวมเนื้อหา Note ทั้งหมดเข้าด้วยกันเพื่อสแกนทีเดียว
        const combinedText = linkedNotes.map(n => {
            const content = n.content as any;
            return typeof content === 'string' ? content : (content?.text || JSON.stringify(content));
        }).join(" ");

        // 4. สแกนหาชื่อตัวละครและนับจำนวน (จาก text)
        const characterCounts = new Map<string, number>();

        for (const char of allCharacters) {
            try {
                const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedName, 'gi');
                const matches = combinedText.match(regex);

                if (matches && matches.length > 0) {
                    characterCounts.set(char.id, matches.length);
                }
            } catch (err) {
                console.error(`Regex error for character ${char.name}`, err);
            }
        }

        // 5. รวมตัวละครจาก Cast Deck (noteCharacters) ของแต่ละ note
        // นับ 1 ครั้งต่อ note ที่เลือกตัวละครนั้นไว้
        for (const note of linkedNotes) {
            for (const nc of note.characters) {
                const currentCount = characterCounts.get(nc.characterId) || 0;
                characterCounts.set(nc.characterId, currentCount + 1);
            }
        }

        // 6. อัปเดตข้อมูลลงตาราง chapter_characters
        await db.delete(chapterCharacters).where(eq(chapterCharacters.chapterId, chapterId));

        const insertData = [];
        for (const [charId, count] of characterCounts.entries()) {
            // ตรวจสอบว่าตัวละครนี้ถูกเลือกใน Cast Deck หรือแค่ถูก detect จาก text
            const isInCastDeck = linkedNotes.some(note =>
                note.characters.some(nc => nc.characterId === charId)
            );

            insertData.push({
                chapterId: chapterId,
                characterId: charId,
                frequency: count,
                role: isInCastDeck ? "Cast" : "Detected", // Role based on source
                notes: `Auto-synced from ${linkedNotes.length} notes`
            });
        }

        if (insertData.length > 0) {
            await db.insert(chapterCharacters).values(insertData);
        }

        console.log(`Synced ${insertData.length} characters for chapter ${chapterId}`);

    } catch (error) {
        console.error("Error syncing chapter characters:", error);
    }
}
