/** ตรวจการอนุมานโครงชั้นของ children ในการ์ดไอเดีย — รันด้วย `npm run check` */
import assert from "node:assert";
import { resolveNesting, NEST_TOP } from "./participant-nest.ts";
import { canContainChild } from "./participant-types.ts";

const c = (id: string, type: string, referenceId?: string | null, parentChildId?: string | null) =>
    ({ id, type, referenceId: referenceId ?? null, parentChildId: parentChildId ?? null });

// ── ผูกเองชนะการอนุมานเสมอ ────────────────────────────────────────
{
    const kids = [
        c("k1", "character", "hero"),
        c("k2", "character", "villain"),
        c("k3", "item", "sword", "k2"), // ผู้ใช้ผูกไว้ใต้ตัวร้าย
    ];
    const world = { items: [{ id: "sword", currentOwnerId: "hero" }] };
    const r = resolveNesting(kids, world);
    assert.equal(r.get("k3")?.parentId, "k2", "ผูกเองต้องชนะเจ้าของในคลัง");
    assert.equal(r.get("k3")?.source, "bind");
}

// ── ของอยู่ใต้คนถือ ถ้าคนถืออยู่ในการ์ด ────────────────────────────
{
    const kids = [c("k1", "character", "hero"), c("k2", "item", "sword")];
    const r = resolveNesting(kids, { items: [{ id: "sword", currentOwnerId: "hero" }] });
    assert.equal(r.get("k2")?.parentId, "k1");
    assert.equal(r.get("k2")?.label, "ถือ");
}

// ── คนถือไม่อยู่ในการ์ด = อยู่ระดับบนสุด ไม่ใช่หายไป ────────────────
{
    const kids = [c("k2", "item", "sword")];
    const r = resolveNesting(kids, { items: [{ id: "sword", currentOwnerId: "hero" }] });
    assert.equal(r.get("k2"), undefined, "ไม่มีคนถือในการ์ด ต้องอยู่ระดับบนสุด");
}

// ── ไม่มีคนถือ แต่มีสถานที่ ─────────────────────────────────────────
{
    const kids = [c("k1", "location", "cave"), c("k2", "item", "sword")];
    const r = resolveNesting(kids, { items: [{ id: "sword", currentOwnerId: null, locationId: "cave" }] });
    assert.equal(r.get("k2")?.label, "วางอยู่ที่");
}

// ── ตัวละครสังกัดฝ่ายเดียว = ผูกให้ / หลายฝ่าย = ไม่เดา ──────────────
{
    const kids = [c("f", "faction", "kage"), c("h", "character", "hero")];
    const one = resolveNesting(kids, { charFactions: [{ characterId: "hero", factionId: "kage" }] });
    assert.equal(one.get("h")?.parentId, "f");
    assert.equal(one.get("h")?.label, "สังกัด");

    const many = resolveNesting(kids, {
        charFactions: [
            { characterId: "hero", factionId: "kage" },
            { characterId: "hero", factionId: "other" },
        ],
    });
    assert.equal(many.get("h"), undefined, "สังกัดหลายฝ่ายต้องไม่เดา");
}

// ── พลัง: unique ผูกใต้เจ้าของ / universal ไม่ผูก ────────────────────
{
    const kids = [c("h", "character", "hero"), c("p", "power", "flame")];
    const links = [{ characterId: "hero", powerId: "flame" }];
    const uniq = resolveNesting(kids, { charPowers: links, powers: [{ id: "flame", access: "unique" }] });
    assert.equal(uniq.get("p")?.parentId, "h");
    assert.equal(uniq.get("p")?.label, "ใช้");

    const univ = resolveNesting(kids, { charPowers: links, powers: [{ id: "flame", access: "universal" }] });
    assert.equal(univ.get("p"), undefined, "พลังที่ใครก็ใช้ได้ ต้องไม่ผูกใต้ใครคนเดียว");
}

// ── dummy อนุมานไม่ได้ แต่ผูกเองได้ ─────────────────────────────────
{
    const kids = [c("f", "faction", "kage"), c("d", "dummy_character", null)];
    assert.equal(resolveNesting(kids, {}).get("d"), undefined, "dummy ไม่มี referenceId จึงอนุมานไม่ได้");
    const bound = resolveNesting([kids[0], c("d", "dummy_character", null, "f")], {});
    assert.equal(bound.get("d")?.source, "bind");
}

// ── ผูกวนต้องถูกตัดทิ้ง ไม่ใช่วนจนแฮงก์ ─────────────────────────────
{
    const kids = [c("a", "character", "x", "b"), c("b", "character", "y", "a")];
    const r = resolveNesting(kids, {});
    assert.ok(!r.has("a") || !r.has("b"), "ผูกวนต้องถูกตัดอย่างน้อยหนึ่งเส้น");
}

// ── parent ที่ถูกลบไปแล้ว = ลูกกลับขึ้นระดับบนสุด ไม่หายจากจอ ────────
{
    const r = resolveNesting([c("k", "item", "sword", "ghost")], {});
    assert.equal(r.get("k"), undefined);
}

// ── สั่งอยู่ระดับบนสุด ต้องไม่ถูกอนุมานดึงกลับ ──────────────────────
{
    const kids = [c("k1", "character", "hero"), c("k2", "item", "sword", NEST_TOP)];
    const r = resolveNesting(kids, { items: [{ id: "sword", currentOwnerId: "hero" }] });
    assert.equal(r.get("k2"), undefined, "กด 'ไม่ผูก' แล้วต้องไม่โดนอนุมานผูกกลับ");
}

// ── กฎชนิด: ของกับพลังรับลูกไม่ได้ ──────────────────────────────────
assert.ok(canContainChild("faction", "character"), "ฝ่ายต้องรับตัวละครได้");
assert.ok(canContainChild("dummy_faction", "dummy_character"), "dummy ใช้กฎเดียวกับตัวจริง");
assert.ok(canContainChild("character", "item"), "ตัวละครต้องถือของได้");
assert.ok(!canContainChild("item", "character"), "สิ่งของต้องรับลูกไม่ได้");
assert.ok(!canContainChild("power", "item"), "พลังต้องรับลูกไม่ได้");

console.log("participant-nest.check.ts ผ่าน");
