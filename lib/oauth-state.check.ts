import assert from "node:assert/strict";
import { signState, verifyState } from "./oauth-state.ts";

const SECRET = "test-secret-min-32-characters-long-ok";
const OTHER = "another-secret-min-32-characters-long";

// เซ็นแล้วตรวจกลับได้
const state = signState({ userId: "u1" }, SECRET);
assert.equal(verifyState<{ userId: string }>(state, SECRET)?.userId, "u1");

// state ปลอมแบบเดิม (base64 เปล่าๆ ไม่มี signature) ต้องไม่ผ่าน — นี่คือช่องโหว่ที่ปิด
const forged = Buffer.from(JSON.stringify({ userId: "attacker" })).toString("base64url");
assert.equal(verifyState(forged, SECRET), null);

// เซ็นด้วย secret อื่นไม่ผ่าน
assert.equal(verifyState(signState({ userId: "u1" }, OTHER), SECRET), null);

// แก้ payload แล้ว signature เดิมใช้ไม่ได้
const [, mac] = state.split(".");
assert.equal(verifyState(`${forged}.${mac}`, SECRET), null);

// หมดอายุแล้วไม่ผ่าน (11 นาทีถัดไป)
assert.equal(verifyState(state, SECRET, Date.now() + 11 * 60 * 1000), null);

// input พังๆ ต้องคืน null ไม่ใช่ throw
for (const bad of ["", ".", "abc", "a.b.c"]) assert.equal(verifyState(bad, SECRET), null);

console.log("oauth-state: ok");
