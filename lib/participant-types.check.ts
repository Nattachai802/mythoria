/** ตรวจ registry ชนิดผู้ร่วมฉาก — รันด้วย `npm run check` */
import assert from "node:assert";
import {
    PARTICIPANT_KINDS, PARTICIPANT_KEYS, PARTICIPANT_TYPES, DUMMY_TYPES,
    kindOf, isDummyType, flattenSystemEntries, parseSystemEntryId, systemEntryId,
} from "./participant-types.ts";

// key เดิมห้ามหาย — ข้อมูลใน scene_element_details.element_type อ้างค่าพวกนี้อยู่
for (const k of ["character", "faction", "power", "item"]) {
    assert(PARTICIPANT_KEYS.includes(k as never), `key "${k}" หายไป จะทำให้ข้อมูลเก่าอ่านไม่ออก`);
}
assert(PARTICIPANT_KEYS.includes("entity" as never) && PARTICIPANT_KEYS.includes("system" as never), "ชนิดใหม่ต้องอยู่ใน registry");

// ทุกชนิดต้องกรอกครบ ไม่งั้น UI จะโชว์ค่าว่าง
for (const [key, k] of Object.entries(PARTICIPANT_KINDS)) {
    for (const f of ["label", "icon", "color", "actionLabel", "actionPlaceholder", "selectLabel", "pickPlaceholder", "quickPickLabel"]) {
        assert((k as any)[f]?.length > 0, `${key}.${f} ว่าง`);
    }
    assert(k.nameField === "name" || k.nameField === "title", `${key}.nameField ต้องเป็น name หรือ title`);
}

// dummy ต้องไม่ปนกับชนิดจริง แต่ต้องนับเป็นผู้ร่วมฉาก
assert(!PARTICIPANT_KEYS.some(k => isDummyType(k)), "ชนิดจริงต้องไม่มี dummy ปน");
assert(DUMMY_TYPES.every(d => PARTICIPANT_TYPES.includes(d)), "dummy ต้องนับเป็นผู้ร่วมฉาก");
assert(PARTICIPANT_TYPES.length === PARTICIPANT_KEYS.length + DUMMY_TYPES.length, "จำนวนรวมต้องตรง");

assert(kindOf("power")?.actionLabel === "ใช้ยังไงในซีนนี้", "พลังใช้คำว่า 'ใช้ยังไง' ไม่ใช่ 'ทำอะไร'");
assert(kindOf("character")?.actionLabel === "ทำอะไรในซีนนี้", "ตัวละครใช้คำว่า 'ทำอะไร'");
assert(kindOf("dummy_character") === null, "dummy ไม่มีแถวใน registry");

// ── ระบบโลก: ผูกระดับ ไม่ใช่ตัวระบบ ──
const flat = flattenSystemEntries([
    { id: "sys1", name: "ระบบยศนักล่า", entries: [{ label: "S" }, { label: "A" }] },
    { id: "sys2", name: "ระบบไร้ระดับ", entries: [] },
    { id: "sys3", name: "รูปแบบ string", entries: ["ต้น", "กลาง"] },
]);
assert.equal(flat.length, 4, "ระบบที่ไม่มี entry ต้องไม่โผล่ · รับ entry ทั้งรูป object และ string");
assert.equal(flat[0].name, "ระบบยศนักล่า › S", "ชื่อที่แสดงต้องบอกทั้งระบบและระดับ");

const round = parseSystemEntryId(systemEntryId("sys1", "A"));
assert(round?.systemId === "sys1" && round.label === "A", "แกะ id กลับเป็นระบบ+ระดับได้");

// ระดับที่มี : ในชื่อต้องไม่ทำให้แกะพลาด (แยกที่ตัวคั่นตัวแรกเท่านั้น)
const tricky = parseSystemEntryId(systemEntryId("sys1", "A::พิเศษ"));
assert(tricky?.systemId === "sys1" && tricky.label === "A::พิเศษ", "แยกที่ตัวคั่นแรก ไม่ใช่ split ทั้งหมด");

assert.equal(parseSystemEntryId("ไม่มีตัวคั่น"), null, "id ที่ไม่ใช่รูประบบต้องคืน null");

console.log(`✅ participant-types ผ่านทั้งหมด (${PARTICIPANT_KEYS.length} ชนิด + dummy ${DUMMY_TYPES.length})`);
