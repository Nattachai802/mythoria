"use server";

import { db } from "@/db/drizzle";
import { chapters, notes, characterStates, chapterCharacters, characters } from "@/db/schema";
import { and, eq, ne, inArray } from "drizzle-orm";

/**
 * Consistency Guardian — ตรวจความขัดแย้งเชิงโครงสร้างทั้งเล่ม (deterministic, ไม่ใช้ LLM)
 * v1: "ตายแล้วยังปรากฏ" — เทียบ status='dead' (จาก characterStates) กับการปรากฏในบทถัดมา
 *     (chapterCharacters) ด้วย chapters.orderIndex ล้วนๆ
 *
 * manual/opt-in: ผู้ใช้กดตรวจเอง · ตรวจได้เฉพาะข้อมูลที่ extract แล้ว (states + chapterCharacters)
 */

export interface ConsistencyIssue {
    id: string;
    type: "dead_reappearance";
    severity: "error" | "warning";
    characterId: string;
    characterName: string;
    message: string;
    deathChapter: { id: string; title: string; order: number };
    appearChapter: { id: string; title: string; order: number };
}

export async function getConsistencyIssues(
    novelId: string,
): Promise<{ success: boolean; issues: ConsistencyIssue[]; error?: string }> {
    try {
        type ChRow = { id: string; title: string; orderIndex: number };

        // 1. บททั้งหมด + ลำดับ
        const chs = (await db
            .select({ id: chapters.id, title: chapters.title, orderIndex: chapters.orderIndex })
            .from(chapters)
            .where(eq(chapters.novelId, novelId))) as ChRow[];
        if (chs.length === 0) return { success: true, issues: [] };

        const chapterById = new Map<string, ChRow>(chs.map((c) => [c.id, c]));
        const novelChapterIds = chs.map((c) => c.id);

        // 2. note → บท (เพื่อรู้ว่า state ของ note อยู่บทไหน)
        const nts = (await db
            .select({ id: notes.id, linkedToChapterId: notes.linkedToChapterId })
            .from(notes)
            .where(eq(notes.novelId, novelId))) as { id: string; linkedToChapterId: string | null }[];
        const noteChapter = new Map<string, string | null>(nts.map((n) => [n.id, n.linkedToChapterId]));

        // 3. state ที่ตาย
        const deadStates = (await db
            .select({ noteId: characterStates.noteId, characterId: characterStates.characterId })
            .from(characterStates)
            .where(and(eq(characterStates.novelId, novelId), eq(characterStates.status, "dead")))) as {
            noteId: string;
            characterId: string;
        }[];
        if (deadStates.length === 0) return { success: true, issues: [] };

        // บทที่ตาย "ครั้งแรกสุด" ต่อตัวละคร (กัน edge case มีหลาย dead state)
        const deathByChar = new Map<string, { order: number; chapterId: string }>();
        for (const s of deadStates) {
            const chId = s.noteId ? noteChapter.get(s.noteId) : null;
            if (!chId) continue;
            const ch = chapterById.get(chId);
            if (!ch) continue;
            const prev = deathByChar.get(s.characterId);
            if (!prev || ch.orderIndex < prev.order) {
                deathByChar.set(s.characterId, { order: ch.orderIndex, chapterId: ch.id });
            }
        }
        if (deathByChar.size === 0) return { success: true, issues: [] };

        const deadCharIds = [...deathByChar.keys()];

        // 3.5 ชุบชีวิต: เก็บบทที่ "ฟื้น" (non-dead state แรกสุดหลังบทตาย) ต่อตัวละคร
        //     → เตือนเฉพาะการปรากฏในช่วง ตาย→ก่อนฟื้น (ปรากฏหลังฟื้น = ปกติ ไม่เตือน)
        const aliveStates = (await db
            .select({ noteId: characterStates.noteId, characterId: characterStates.characterId })
            .from(characterStates)
            .where(
                and(
                    eq(characterStates.novelId, novelId),
                    ne(characterStates.status, "dead"),
                    inArray(characterStates.characterId, deadCharIds),
                ),
            )) as { noteId: string; characterId: string }[];
        const revivalByChar = new Map<string, number>();
        for (const s of aliveStates) {
            const death = deathByChar.get(s.characterId);
            const chId = s.noteId ? noteChapter.get(s.noteId) : null;
            const ch = chId ? chapterById.get(chId) : null;
            if (death && ch && ch.orderIndex > death.order) {
                const prev = revivalByChar.get(s.characterId);
                if (prev === undefined || ch.orderIndex < prev) revivalByChar.set(s.characterId, ch.orderIndex);
            }
        }

        // 4. ชื่อตัวละคร
        const charRows = (await db
            .select({ id: characters.id, name: characters.name })
            .from(characters)
            .where(inArray(characters.id, deadCharIds))) as { id: string; name: string }[];
        const nameById = new Map<string, string>(charRows.map((c) => [c.id, c.name]));

        // 5. การปรากฏของตัวละครที่ตาย ในบทของนิยายนี้
        const appearances = (await db
            .select({ characterId: chapterCharacters.characterId, chapterId: chapterCharacters.chapterId })
            .from(chapterCharacters)
            .where(
                and(
                    inArray(chapterCharacters.characterId, deadCharIds),
                    inArray(chapterCharacters.chapterId, novelChapterIds),
                ),
            )) as { characterId: string; chapterId: string }[];

        // 6. ปรากฏในบทที่ orderIndex > บทที่ตาย → ขัดแย้ง
        const issues: ConsistencyIssue[] = [];
        for (const ap of appearances) {
            const death = deathByChar.get(ap.characterId);
            const appearCh = chapterById.get(ap.chapterId);
            if (!death || !appearCh) continue;
            // เตือนเฉพาะช่วงตาย→ก่อนฟื้น: ปรากฏหลังบทตาย และ (ยังไม่ฟื้น หรือ ก่อนบทที่ฟื้น)
            const revival = revivalByChar.get(ap.characterId);
            if (appearCh.orderIndex > death.order && (revival === undefined || appearCh.orderIndex < revival)) {
                const deathCh = chapterById.get(death.chapterId)!;
                const name = nameById.get(ap.characterId) ?? "ตัวละคร";
                issues.push({
                    id: `${ap.characterId}:${ap.chapterId}`,
                    type: "dead_reappearance",
                    severity: "error",
                    characterId: ap.characterId,
                    characterName: name,
                    message: `${name} ตายในบท "${deathCh.title}" แต่ยังปรากฏในบท "${appearCh.title}"`,
                    deathChapter: { id: deathCh.id, title: deathCh.title, order: deathCh.orderIndex },
                    appearChapter: { id: appearCh.id, title: appearCh.title, order: appearCh.orderIndex },
                });
            }
        }

        issues.sort((a, b) => a.appearChapter.order - b.appearChapter.order);
        return { success: true, issues };
    } catch (error) {
        console.error("[guardian] getConsistencyIssues error:", error);
        return { success: false, issues: [], error: "ตรวจความสอดคล้องไม่สำเร็จ" };
    }
}
