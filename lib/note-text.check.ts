import { noteToPlain, isRichNote, noteIsEmpty, plainToDelta, legacyToDelta, noteTemplate, withTemplate, looksLikeDialogue } from "./note-text.ts";
import assert from "node:assert/strict";

const rich = JSON.stringify({
    ops: [
        { insert: { mention: { id: "c1", value: "พระเอก", denotationChar: "@" } } },
        { insert: " ถามว่าเขาทำอะไร" },
        { insert: "\n", attributes: { list: "bullet" } },
        { insert: "บรรทัดสอง\n" },
    ],
});

assert.equal(noteToPlain("โน้ตเก่า @พระเอก"), "โน้ตเก่า @พระเอก"); // plain ผ่านตรง ๆ
assert.equal(isRichNote("{ไม่ใช่ json"), false);
assert.equal(isRichNote(rich), true);
assert.equal(noteToPlain(rich), "• @พระเอก ถามว่าเขาทำอะไร\nบรรทัดสอง");
assert.equal(noteIsEmpty(JSON.stringify({ ops: [{ insert: "\n" }] })), true);
assert.equal(noteToPlain(JSON.stringify(plainToDelta("a\nb"))), "a\nb");
const names = [{ id: "a", name: "สมชาย" }, { id: "b", name: "สมชายใหญ่" }, { id: "c", name: "เสียงในหัว(ตัวตน)" }];
const conv = legacyToDelta("@สมชายใหญ่ เจอ @เสียงในหัว(ตัวตน) และ @ใครก็ไม่รู้", names);
const mentions = conv.ops.filter((o) => typeof o.insert !== "string") as any[];
assert.deepEqual(mentions.map((o) => o.insert.mention.id), ["b", "c"]); // ชื่อยาวชนะ, ชื่อมีวงเล็บได้, ชื่อไม่รู้จักไม่แปลง
assert.equal(noteToPlain(JSON.stringify(conv)), "@สมชายใหญ่ เจอ @เสียงในหัว(ตัวตน) และ @ใครก็ไม่รู้"); // แปลงไปกลับข้อความเดิม
assert.equal(noteTemplate(rich), "plain");
const dlg = withTemplate(rich, "dialogue", []);
assert.equal(noteTemplate(dlg), "dialogue");
assert.equal(noteToPlain(dlg), noteToPlain(rich)); // template ไม่กระทบข้อความที่ AI เห็น
assert.equal(noteTemplate(withTemplate(dlg, "plain", [])), "plain");
assert.equal(withTemplate("โน้ตเก่า", "plain", []), "โน้ตเก่า"); // เลือกทั่วไป + plain = ไม่แตะ
assert.equal(noteToPlain(withTemplate("@สมชาย พูด", "dialogue", names)), "@สมชาย พูด"); // plain → dialogue แล้วข้อความเดิม
const m = (id: string, value: string) => ({ insert: { mention: { id, value, denotationChar: "@" } } });
const two = JSON.stringify({ ops: [m("a", "ก"), { insert: " พูด\n" }, m("b", "ข"), { insert: " ตอบ\n" }] });
assert.equal(looksLikeDialogue(two), true); // 2 บรรทัดขึ้นต้นด้วยชิป
assert.equal(looksLikeDialogue(withTemplate(two, "dialogue", [])), false); // เลือกบทสนทนาแล้วไม่ต้องเสนอ
assert.equal(looksLikeDialogue(JSON.stringify({ ops: [m("a", "ก"), { insert: " พูด แล้วเจอ " }, m("b", "ข"), { insert: "\n" }] })), false); // ชิปกลางประโยคไม่นับ
assert.equal(looksLikeDialogue(JSON.stringify({ ops: [m("a", "ก"), { insert: " พูด\n" }] })), false); // บรรทัดเดียว
assert.equal(looksLikeDialogue("@ก พูด\n@ข ตอบ"), true); // โน้ตเก่า plain
assert.equal(looksLikeDialogue("ข้อความธรรมดา @ก"), false);
console.log("note-text.check ok");
