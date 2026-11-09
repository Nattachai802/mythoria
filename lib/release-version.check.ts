import assert from "node:assert/strict";
import { parseVersion, bumpFor, applyBump, nextVersion, explainBump, semverOf, isLegacyBugfix } from "./release-version.ts";

assert.deepEqual(parseVersion("2.10.1"), [2, 10, 1, null]);                  // รุ่นเก่า 3 ส่วน
assert.deepEqual(parseVersion("2.11.3.4829105736"), [2, 11, 3, "4829105736"]); // Bugfix สุ่มรุ่นเก่า
assert.deepEqual(parseVersion("2.19.0.0"), [2, 19, 0, "0"]);
assert.deepEqual(parseVersion("2.19.0.12"), [2, 19, 0, "12"]);
assert.equal(parseVersion("next"), null);
assert.equal(parseVersion("2.10"), null);
assert.equal(parseVersion("2.10.1.12345678901"), null);                      // เกิน 10 หลัก

// กติกา: added = minor · changed/removed = function · มีแต่ fixed = bugfix
assert.equal(bumpFor([{ kind: "fixed" }, { kind: "fixed" }]), "bugfix");
assert.equal(bumpFor([{ kind: "fixed" }, { kind: "changed" }]), "function");
assert.equal(bumpFor([{ kind: "removed" }]), "function");
assert.equal(bumpFor([{ kind: "added" }, { kind: "changed" }]), "minor");
assert.equal(bumpFor([{ kind: "added" }], "function"), "function");          // override ชนะ
assert.equal(bumpFor([{ kind: "fixed" }], "patch"), "function");             // ชื่อเดิม
assert.equal(bumpFor([{ kind: "fixed" }], "major"), "major");

// Bugfix นับเรียง · รีเซ็ต 0 เมื่อส่วนหน้าขยับ · ต่อจากเลขสุ่มรุ่นเก่า = เริ่ม 1
assert.equal(applyBump("2.19.0.0", "bugfix"), "2.19.0.1");
assert.equal(applyBump("2.19.0.9", "bugfix"), "2.19.0.10");
assert.equal(applyBump("2.18.1.5594552342", "bugfix"), "2.18.1.1");
assert.equal(applyBump("2.14.0", "bugfix"), "2.14.0.1");
assert.equal(applyBump("2.19.0.4", "function"), "2.19.1.0");
assert.equal(applyBump("2.18.1.5594552342", "minor"), "2.19.0.0");          // Function รีเซ็ต
assert.equal(applyBump("2.14.3.7", "major"), "3.0.0.0");
assert.throws(() => applyBump("next", "bugfix"));

assert.equal(nextVersion("2.19.0.2", [{ kind: "fixed" }]), "2.19.0.3");
assert.equal(semverOf(nextVersion("2.14.0", [{ kind: "added" }])), "2.15.0");
assert.equal(semverOf("2.19.0.3"), "2.19.0");

assert.equal(isLegacyBugfix("5594552342"), true);
assert.equal(isLegacyBugfix("3"), false);
assert.equal(isLegacyBugfix(null), false);

assert.match(explainBump([{ kind: "fixed" }]), /bugfix/);
assert.match(explainBump([{ kind: "changed" }]), /function/);
assert.match(explainBump([{ kind: "added" }]), /minor/);
assert.match(explainBump([{ kind: "fixed" }], "minor"), /ตั้งเอง/);
console.log("release-version.check ok");
