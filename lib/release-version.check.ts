import assert from "node:assert/strict";
import { parseVersion, bumpFor, applyBump, nextVersion, explainBump } from "./release-version.ts";

assert.deepEqual(parseVersion("2.10.1"), [2, 10, 1]);
assert.equal(parseVersion("next"), null);
assert.equal(parseVersion("2.10"), null);

// กติกา: มีแต่ fixed = patch · มีอย่างอื่นปนแม้ข้อเดียว = minor
assert.equal(bumpFor([{ kind: "fixed" }, { kind: "fixed" }]), "patch");
assert.equal(bumpFor([{ kind: "fixed" }, { kind: "changed" }]), "minor");
assert.equal(bumpFor([{ kind: "added" }]), "minor");
assert.equal(bumpFor([{ kind: "removed" }, { kind: "fixed" }]), "minor");
assert.equal(bumpFor([{ kind: "fixed" }], "minor"), "minor"); // override ชนะ
assert.equal(bumpFor([{ kind: "added" }], "patch"), "patch");
assert.equal(bumpFor([{ kind: "fixed" }], "major"), "major");

// applyBump: ขึ้นแล้วเลขหลังต้องรีเซ็ต
assert.equal(applyBump("2.10.1", "patch"), "2.10.2");
assert.equal(applyBump("2.10.1", "minor"), "2.11.0");
assert.equal(applyBump("2.10.1", "major"), "3.0.0");
assert.equal(applyBump("0.9.9", "patch"), "0.9.10"); // ไม่ใช่เลขหลักเดียว
assert.throws(() => applyBump("next", "patch"));

assert.equal(nextVersion("2.9.1", [{ kind: "fixed" }]), "2.9.2");
assert.equal(nextVersion("2.9.1", [{ kind: "added" }, { kind: "fixed" }]), "2.10.0");

assert.match(explainBump([{ kind: "fixed" }]), /patch/);
assert.match(explainBump([{ kind: "added" }, { kind: "changed" }]), /minor.*added\/changed/);
assert.match(explainBump([{ kind: "fixed" }], "minor"), /ตั้งเอง/);
console.log("release-version.check ok");
