import assert from "node:assert/strict";
import { parseVersion, bumpFor, applyBump, nextVersion, explainBump, semverOf, randomBugfix } from "./release-version.ts";

assert.deepEqual(parseVersion("2.10.1"), [2, 10, 1, null]);                  // รุ่นเก่า 3 ส่วน
assert.deepEqual(parseVersion("2.11.3.4829105736"), [2, 11, 3, "4829105736"]);
assert.equal(parseVersion("next"), null);
assert.equal(parseVersion("2.10"), null);
assert.equal(parseVersion("2.10.1.123"), null);                               // Bugfix ต้อง 10 หลัก

// กติกา: added = minor · changed/removed = function · มีแต่ fixed = bugfix
assert.equal(bumpFor([{ kind: "fixed" }, { kind: "fixed" }]), "bugfix");
assert.equal(bumpFor([{ kind: "fixed" }, { kind: "changed" }]), "function");
assert.equal(bumpFor([{ kind: "removed" }]), "function");
assert.equal(bumpFor([{ kind: "added" }, { kind: "changed" }]), "minor");
assert.equal(bumpFor([{ kind: "added" }], "function"), "function");          // override ชนะ
assert.equal(bumpFor([{ kind: "fixed" }], "patch"), "function");             // ชื่อเดิม
assert.equal(bumpFor([{ kind: "fixed" }], "major"), "major");

const B = "4829105736";
assert.equal(applyBump("2.14.0", "bugfix", B), `2.14.0.${B}`);
assert.equal(applyBump("2.14.0", "function", B), `2.14.1.${B}`);
assert.equal(applyBump("2.14.3.1111111111", "minor", B), `2.15.0.${B}`);    // Function รีเซ็ต
assert.equal(applyBump("2.14.3.1111111111", "major", B), `3.0.0.${B}`);
assert.notEqual(applyBump(`2.14.0.${B}`, "bugfix", B), `2.14.0.${B}`);      // Bugfix ต้องเปลี่ยนเสมอ
assert.throws(() => applyBump("next", "bugfix"));

assert.equal(semverOf(nextVersion("2.14.0", [{ kind: "added" }])), "2.15.0");
assert.equal(semverOf(nextVersion("2.14.0", [{ kind: "changed" }, { kind: "fixed" }])), "2.14.1");
assert.equal(semverOf(nextVersion("2.14.1.1234567890", [{ kind: "fixed" }])), "2.14.1");
assert.match(randomBugfix(), /^[1-9]\d{9}$/);

assert.match(explainBump([{ kind: "fixed" }]), /bugfix/);
assert.match(explainBump([{ kind: "changed" }]), /function/);
assert.match(explainBump([{ kind: "added" }]), /minor/);
assert.match(explainBump([{ kind: "fixed" }], "minor"), /ตั้งเอง/);
console.log("release-version.check ok");
