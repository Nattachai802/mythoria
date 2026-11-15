/**
 * Treatment — ตรวจความสมเหตุสมผลบนแกนเวลาโลก (เส้นเวลาเฟส 4) · pure ไม่แตะ DB ไม่เรียก AI
 * -----------------------------------------------------------------------------------------
 * แผน: docs/treatment-timeline-plan.md หัวข้อ 7 เฟส 4
 * กฎทุกตัว deterministic อธิบายได้ว่าทำไมเตือน — ข้อมูลไม่พอ = ไม่เตือน (เลี่ยง false positive)
 *
 * ไฟล์นี้ไม่ import อะไร (ตัวรัน check resolve relative import ไม่ได้ ดู task.md 9e)
 * server ต้องแปลงข้อมูลให้เป็นรูปข้างล่างก่อน (เลขวันในโลก, ยุคจากเวลา, เวลาเดินทางเป็นวัน)
 */

export type CsRefKind = "scene" | "lore" | "character" | "chapter";
export interface CsRef { kind: CsRefKind; id: string; title: string }

/** ตัวละครอยู่ที่ไหน ณ วันไหน — จากฉาก (มีวันที่) และเหตุการณ์ที่ละเอียดถึงวัน */
export interface CsAppearance {
    characterId: string;
    day: number;
    locationIds: string[];
    ref: CsRef;
}

export interface CsSceneLink {
    scene: CsRef;
    sceneDay: number | null;
    lore: CsRef;
    loreDay: number | null;
}

export interface CsLoreEra {
    lore: CsRef;
    /** ยุคที่ผู้เขียนผูกไว้เอง */
    setEra: { id: string; name: string } | null;
    /** ยุคที่ครอบปีของเวลาที่ตั้ง */
    timeEra: { id: string; name: string } | null;
}

export interface ConsistencyInput {
    characters: { id: string; name: string }[];
    locations: { id: string; name: string }[];
    appearances: CsAppearance[];
    sceneLinks: CsSceneLink[];
    loreEras: CsLoreEra[];
    /** key `${from}|${to}` → จำนวนวันที่ใช้เดินทาง (ทิศที่ไปได้จริง) */
    travelDays: Record<string, number>;
}

export type FindingRule = "two-places" | "travel-too-fast" | "shown-before-happens" | "era-mismatch" | "dead-reappears" | "travel-states";

export interface Finding {
    id: string;
    rule: FindingRule;
    severity: "error" | "warning";
    message: string;
    refs: CsRef[];
}

export const RULE_LABEL: Record<FindingRule, string> = {
    "two-places": "อยู่สองที่พร้อมกัน",
    "travel-too-fast": "เดินทางเร็วเกินระยะ",
    "shown-before-happens": "ฉากเล่าเหตุการณ์ที่ยังไม่เกิด",
    "era-mismatch": "ยุคไม่ตรงกับเวลา",
    "dead-reappears": "ตายแล้วยังปรากฏ",
    "travel-states": "เดินทางไม่ทัน (จากสถานะในตอน)",
};

const fmtDays = (d: number) => (d < 1 ? `${Math.round(d * 24)} ชั่วโมง` : `${Math.round(d * 10) / 10} วัน`);

export function checkWorldConsistency(input: ConsistencyInput): Finding[] {
    const out: Finding[] = [];
    const charName = new Map(input.characters.map((c) => [c.id, c.name]));
    const locName = new Map(input.locations.map((l) => [l.id, l.name]));
    const locs = (ids: string[]) => ids.map((id) => locName.get(id) ?? "?").join(", ");

    const byChar = new Map<string, CsAppearance[]>();
    for (const a of input.appearances) {
        if (!charName.has(a.characterId)) continue;
        byChar.set(a.characterId, [...(byChar.get(a.characterId) ?? []), a]);
    }

    for (const [cid, list] of byChar) {
        const who = charName.get(cid)!;
        const sorted = [...list].sort((a, b) => a.day - b.day);

        // ── อยู่สองที่ในวันเดียวกัน: สถานที่ไม่ทับกันเลยสักแห่ง ──
        const seen = new Set<string>();
        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length && sorted[j].day === sorted[i].day; j++) {
                const a = sorted[i], b = sorted[j];
                if (!a.locationIds.length || !b.locationIds.length) continue;
                if (a.locationIds.some((l) => b.locationIds.includes(l))) continue;
                const key = [a.ref.id, b.ref.id].sort().join("|");
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({
                    id: `two-places:${cid}:${key}`, rule: "two-places", severity: "error",
                    message: `${who} อยู่ที่ ${locs(a.locationIds)} และ ${locs(b.locationIds)} ในวันเดียวกัน`,
                    refs: [{ kind: "character", id: cid, title: who }, a.ref, b.ref],
                });
            }
        }

        // ── เดินทางเร็วเกิน: จุดติดกันที่ระบุสถานที่เดียว และมีเส้นเชื่อมบอกเวลาเดินทาง ──
        const single = sorted.filter((a) => a.locationIds.length === 1);
        for (let i = 1; i < single.length; i++) {
            const a = single[i - 1], b = single[i];
            const from = a.locationIds[0], to = b.locationIds[0];
            if (from === to || a.day === b.day) continue; // วันเดียวกันเป็นเรื่องของกฎ two-places
            const need = input.travelDays[`${from}|${to}`];
            if (need == null) continue; // ไม่รู้ระยะ = ไม่เดา
            const gap = b.day - a.day;
            if (gap >= need) continue;
            out.push({
                id: `travel:${cid}:${a.ref.id}:${b.ref.id}`, rule: "travel-too-fast", severity: "warning",
                message: `${who} ไปจาก ${locs([from])} ถึง ${locs([to])} ใน ${fmtDays(gap)} แต่ทางนี้ต้องใช้ ${fmtDays(need)}`,
                refs: [{ kind: "character", id: cid, title: who }, a.ref, b.ref],
            });
        }
    }

    // ── ฉากเล่าเหตุการณ์ที่เกิดทีหลังวันของฉาก ──
    for (const l of input.sceneLinks) {
        if (l.sceneDay == null || l.loreDay == null || l.loreDay <= l.sceneDay) continue;
        out.push({
            id: `future:${l.scene.id}:${l.lore.id}`, rule: "shown-before-happens", severity: "warning",
            message: `ฉาก "${l.scene.title}" เล่า "${l.lore.title}" ซึ่งเกิดทีหลังวันของฉาก ${l.loreDay - l.sceneDay} วัน (ถ้าเป็นคำทำนาย/ภาพนิมิตก็ไม่เป็นไร)`,
            refs: [l.scene, l.lore],
        });
    }

    // ── ยุคที่ผูกไว้ไม่ตรงกับปีที่ตั้ง ──
    for (const e of input.loreEras) {
        if (!e.setEra || !e.timeEra || e.setEra.id === e.timeEra.id) continue;
        out.push({
            id: `era:${e.lore.id}`, rule: "era-mismatch", severity: "warning",
            message: `"${e.lore.title}" ผูกไว้กับ${e.setEra.name} แต่ปีที่ตั้งอยู่ใน${e.timeEra.name}`,
            refs: [e.lore],
        });
    }

    const rank = (f: Finding) => (f.severity === "error" ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b) || a.rule.localeCompare(b.rule));
}

/** หน่วยเวลาเดินทางของ location_connections → วัน · หน่วยแปลกหรือไม่มีค่า = null (ไม่ใช้ตรวจ) */
export function travelToDays(time: number | null, unit: string | null): number | null {
    if (time == null || !Number.isFinite(time) || time < 0) return null;
    switch ((unit ?? "hours").toLowerCase()) {
        case "minutes": return time / 1440;
        case "hours": return time / 24;
        case "days": return time;
        case "weeks": return time * 7;
        case "months": return time * 30;
        default: return null;
    }
}
