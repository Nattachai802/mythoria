'use server';

import { db } from "@/db/drizzle";
import { characterFactions, characterPowers, characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireNovelAccess } from "@/lib/authz";
import type { NestWorld } from "@/lib/participant-nest";

/**
 * ความสัมพันธ์ที่กระดานพล็อตใช้อนุมานโครงชั้นในการ์ดไอเดีย (P-nest รอบ 2)
 * -----------------------------------------------------------------------
 * เอาเฉพาะคู่ id ที่ต้องใช้จริง ไม่ join ชื่อกลับมา — ชื่อมีอยู่ใน characters/powers
 * ที่หน้าพล็อตโหลดไปแล้ว ดึงซ้ำก็เปลืองอย่างเดียว
 *
 * ตาราง character_factions / character_powers ไม่มีคอลัมน์ novel_id
 * ต้อง join ผ่าน characters เอา (characters มี index novel_id อยู่แล้ว)
 */
export async function getParticipantLinks(novelId: string): Promise<
    Pick<NestWorld, "charFactions" | "charPowers">
> {
    await requireNovelAccess(novelId);

    const [charFactions, charPowers] = await Promise.all([
        db
            .select({
                characterId: characterFactions.characterId,
                factionId: characterFactions.factionId,
            })
            .from(characterFactions)
            .innerJoin(characters, eq(characters.id, characterFactions.characterId))
            .where(eq(characters.novelId, novelId)),
        db
            .select({
                characterId: characterPowers.characterId,
                powerId: characterPowers.powerId,
                currentLevel: characterPowers.currentLevel,
            })
            .from(characterPowers)
            .innerJoin(characters, eq(characters.id, characterPowers.characterId))
            .where(eq(characters.novelId, novelId)),
    ]);

    return { charFactions, charPowers };
}
