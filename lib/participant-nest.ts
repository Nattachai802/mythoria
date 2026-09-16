/**
 * อนุมานโครงชั้นของ children ในการ์ดไอเดีย (P-nest รอบ 2)
 * --------------------------------------------------------
 * รอบแรกผูกได้ทางเดียวคือผู้ใช้กดผูกเองทีละอัน (children[].parentChildId)
 * ทั้งที่ตารางสร้างโลกรู้คำตอบอยู่แล้ว: ใครสังกัดฝ่ายไหน ใครถือของชิ้นไหน ใครใช้พลังอะไร
 * ที่นี่รวมสองแหล่งเข้าด้วยกัน โดย "ผูกเอง" ชนะ "อนุมาน" เสมอ
 *
 * ทำไมต้องชนะ: ตารางโลกเก็บความจริงระดับทั้งเรื่อง (ดาบเป็นของพระเอก)
 * แต่ฉากหนึ่ง ๆ อาจต่างออกไป (ฉากนี้ดาบถูกขโมย) ผู้ใช้ต้องเขียนทับได้
 *
 * pure data — ห้าม import อะไรเข้ามา ไม่งั้น `npm run check` โหลดไม่ได้ (ดู task.md 9e)
 */

export type NestSource = "bind" | "infer";

/**
 * ค่าพิเศษของ parentChildId = "ผู้ใช้สั่งให้อยู่ระดับบนสุด"
 * ต่างจาก null/undefined ที่แปลว่า "ยังไม่ได้ตั้ง ให้อนุมานเอา"
 * ถ้าไม่มีค่านี้ พอผู้ใช้กด "ไม่ผูก" การอนุมานจะดึงกลับไปที่เดิมทันที
 */
export const NEST_TOP = "__top__";

export interface NestChild {
    id: string;
    type: string;
    /** id ในตารางโลก — dummy เป็น null จึงอนุมานอะไรไม่ได้เลย */
    referenceId?: string | null;
    parentChildId?: string | null;
}

export interface NestWorld {
    charFactions?: { characterId: string; factionId: string }[];
    charPowers?: { characterId: string; powerId: string; currentLevel?: number | null }[];
    items?: { id: string; currentOwnerId?: string | null; locationId?: string | null }[];
    powers?: { id: string; access?: string | null }[];
}

export interface NestLink {
    /** null = อยู่ระดับบนสุด */
    parentId: string | null;
    source: NestSource;
    /** ป้ายบอกความสัมพันธ์ที่อนุมานมา — bind ไม่มี เพราะผู้ใช้ตั้งเอง */
    label?: string;
}

const CHARACTER_TYPES = ["character", "dummy_character"];
const FACTION_TYPES = ["faction", "dummy_faction"];

/** เก็บเฉพาะค่าที่โผล่ครั้งเดียว — กำกวมเมื่อไหร่ไม่เดา ปล่อยขึ้นระดับบนสุด */
function onlyOne<T>(values: T[]): T | null {
    const uniq = Array.from(new Set(values));
    return uniq.length === 1 ? uniq[0] : null;
}

/**
 * คืน map: childId → จะไปอยู่ใต้ใคร มาจากไหน
 * children ที่ไม่มีใน map = อยู่ระดับบนสุด
 */
export function resolveNesting(children: NestChild[], world: NestWorld = {}): Map<string, NestLink> {
    const out = new Map<string, NestLink>();
    const byId = new Map(children.map(c => [c.id, c]));

    /** หา child ในการ์ดนี้ที่อ้างถึง entity ตัวนั้น — ไม่อยู่ในการ์ด = ผูกไม่ได้ */
    const findByRef = (types: string[], refId: string | null | undefined) =>
        refId ? children.find(c => types.includes(c.type) && c.referenceId === refId) : undefined;

    for (const child of children) {
        // 1) ผูกเอง — ชนะเสมอ (parent ที่ถูกลบไปแล้วถือว่าไม่ผูก)
        if (child.parentChildId === NEST_TOP) continue; // ผู้ใช้สั่งให้อยู่ระดับบนสุด ห้ามอนุมานทับ
        if (child.parentChildId && byId.has(child.parentChildId) && child.parentChildId !== child.id) {
            out.set(child.id, { parentId: child.parentChildId, source: "bind" });
            continue;
        }
        if (!child.referenceId) continue; // dummy อนุมานไม่ได้

        // 2) อนุมานจากตารางโลก
        if (CHARACTER_TYPES.includes(child.type)) {
            // ponytail: สังกัดหลายฝ่าย (ย้ายฝ่ายกลางเรื่อง) = ไม่เดา
            // ถ้าวันไหนอยากเลือกตามช่วงบท ต้องส่ง chapter order เข้ามาแล้วกรอง start/endChapterId
            const factionIds = (world.charFactions ?? [])
                .filter(r => r.characterId === child.referenceId)
                .map(r => r.factionId);
            const factionId = onlyOne(factionIds);
            const parent = findByRef(FACTION_TYPES, factionId);
            if (parent) out.set(child.id, { parentId: parent.id, source: "infer", label: "สังกัด" });
            continue;
        }

        if (child.type === "item") {
            const row = (world.items ?? []).find(i => i.id === child.referenceId);
            const owner = findByRef(CHARACTER_TYPES, row?.currentOwnerId);
            if (owner) { out.set(child.id, { parentId: owner.id, source: "infer", label: "ถือ" }); continue; }
            const place = findByRef(["location"], row?.locationId);
            if (place) out.set(child.id, { parentId: place.id, source: "infer", label: "วางอยู่ที่" });
            continue;
        }

        if (child.type === "power") {
            const access = (world.powers ?? []).find(p => p.id === child.referenceId)?.access ?? "unique";
            // universal/learnable = ใครก็ใช้ได้ ผูกใต้คนใดคนหนึ่งจะโกหก
            if (access === "universal" || access === "learnable") continue;
            const ownerIds = (world.charPowers ?? [])
                .filter(r => r.powerId === child.referenceId)
                .map(r => r.characterId);
            const ownerId = onlyOne(ownerIds);
            const owner = findByRef(CHARACTER_TYPES, ownerId);
            if (owner) out.set(child.id, { parentId: owner.id, source: "infer", label: "ใช้" });
            continue;
        }
    }

    // 3) กันผูกวน — bind ที่ผู้ใช้ตั้งไว้ก่อนหน้าอาจวนได้ถ้าข้อมูลเก่าเพี้ยน
    for (const child of children) {
        const seen = new Set<string>([child.id]);
        let cur = out.get(child.id)?.parentId ?? null;
        while (cur) {
            if (seen.has(cur)) { out.delete(child.id); break; }
            seen.add(cur);
            cur = out.get(cur)?.parentId ?? null;
        }
    }

    return out;
}
