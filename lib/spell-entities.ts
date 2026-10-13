import "server-only";
import { db } from "@/db/drizzle";
import {
    characters, factions, locations, items, entities, powers, worldSystems, loreEntries,
} from "@/db/schema";
import { eq } from "drizzle-orm";

// คำเฉพาะของเรื่องที่ตัวตรวจคำผิดต้อง mask ก่อนตรวจ — type ใช้เลือกคำแทน (ดู MASK_BY_TYPE ฝั่ง Python)
export type SpellEntity = { text: string; type: string };

export async function getSpellEntities(novelId: string): Promise<SpellEntity[]> {
    const [chars, facs, locs, its, ents, pows, systems, lore] = await Promise.all([
        db.select({ name: characters.name, aliases: characters.aliases, species: characters.species })
            .from(characters).where(eq(characters.novelId, novelId)),
        db.select({ name: factions.name }).from(factions).where(eq(factions.novelId, novelId)),
        db.select({ name: locations.name }).from(locations).where(eq(locations.novelId, novelId)),
        db.select({ name: items.name }).from(items).where(eq(items.novelId, novelId)),
        db.select({ name: entities.name }).from(entities).where(eq(entities.novelId, novelId)),
        db.select({ name: powers.name }).from(powers).where(eq(powers.novelId, novelId)),
        db.select({ name: worldSystems.name, entries: worldSystems.entries })
            .from(worldSystems).where(eq(worldSystems.novelId, novelId)),
        db.select({ title: loreEntries.title }).from(loreEntries).where(eq(loreEntries.novelId, novelId)),
    ]);

    const out: SpellEntity[] = [
        ...chars.flatMap(c => [
            { text: c.name, type: "character" },
            ...((c.aliases as string[] | null) ?? []).map(a => ({ text: a, type: "character" })),
            ...(c.species ? [{ text: c.species, type: "creature" }] : []),
        ]),
        ...facs.map(f => ({ text: f.name, type: "faction" })),
        ...locs.map(l => ({ text: l.name, type: "location" })),
        ...its.map(i => ({ text: i.name, type: "item" })),
        ...ents.map(e => ({ text: e.name, type: "creature" })),
        ...pows.map(p => ({ text: p.name, type: "power" })),
        ...systems.flatMap(s => [
            { text: s.name, type: "system" },
            ...((s.entries as { label?: string }[] | null) ?? []).map(e => ({ text: e.label ?? "", type: "system" })),
        ]),
        ...lore.map(l => ({ text: l.title, type: "lore" })),
    ];
    return out.filter(e => typeof e.text === "string" && e.text.trim());
}
