/**
 * ออกรุ่นใหม่ — รันด้วย `npm run release` (ดูผลก่อนด้วย `npm run release -- --dry`)
 *
 * วิธีใช้ (ข้อตกลง 2026-10-14): ระหว่างทำงานสะสมรายการไว้ในรุ่น `version: "next"` บนสุดของ lib/changelog.ts
 * push ได้เรื่อย ๆ โดยยังไม่ออกรุ่น — รันคำสั่งนี้เฉพาะตอนผู้ใช้สั่ง "ออกรุ่น" ไม่ต้องเลือกเลขเอง:
 *   1. คำนวณเลข Major.Minor.Function.Bugfix จากชนิดรายการ (lib/release-version.ts: added = Minor,
 *      changed/removed = Function, มีแต่ fixed = Bugfix สุ่ม · major ต้องเขียน `bump: "major"` ตามที่ผู้ใช้สั่ง)
 *   2. เขียนเลขลง lib/changelog.ts, README.md และ package.json (เฉพาะ Major.Minor.Function — npm รับแค่ 3 ส่วน)
 *   3. generate CHANGELOG.md ใหม่
 * เลขที่ผ่านคำสั่งนี้จะผ่าน `npm run check` (lib/changelog.check.ts) เสมอ
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CHANGELOG } from "../lib/changelog.ts";
import { nextVersion, explainBump, semverOf } from "../lib/release-version.ts";

const dry = process.argv.includes("--dry");
const rootUrl = new URL("..", import.meta.url);
const path = (name: string) => fileURLToPath(new URL(name, rootUrl));

const pending = CHANGELOG.filter((r) => r.version === "next");
if (pending.length === 0) {
    console.log('ไม่มีรุ่นที่รอออก — เพิ่มรุ่นไว้บนสุดของ lib/changelog.ts ด้วย version: "next" ก่อน');
    process.exit(0);
}
if (pending.length > 1 || CHANGELOG[0].version !== "next") {
    console.error('มีรุ่น "next" ได้รุ่นเดียว และต้องอยู่บนสุดของ CHANGELOG');
    process.exit(1);
}
if (CHANGELOG.length < 2) {
    console.error("ไม่มีรุ่นก่อนหน้าให้ใช้เป็นฐานคำนวณเลข");
    process.exit(1);
}

const release = CHANGELOG[0];
const prev = CHANGELOG[1].version;
const version = nextVersion(prev, release.entries, release.bump);
console.log(`${prev} → ${version}  ·  ${explainBump(release.entries, release.bump)}  ·  "${release.title}"`);
if (dry) {
    console.log("(--dry: ยังไม่ได้เขียนอะไร)");
    process.exit(0);
}

// 1) lib/changelog.ts — แทนที่เฉพาะรุ่น "next" บนสุด (+ date: "today" ของรุ่นเดียวกัน)
const changelogPath = path("lib/changelog.ts");
let src = readFileSync(changelogPath, "utf8");
// ต้องเป็นบรรทัดข้อมูลจริง (ขึ้นต้นด้วยช่องไฟแล้ว version:) ไม่ใช่ข้อความ `version: "next"` ในคอมเมนต์หัวไฟล์
const versionRe = /^(\s+)version: "next"/m;
const m = versionRe.exec(src);
if (!m) throw new Error('หา version: "next" ใน lib/changelog.ts ไม่เจอ');
const at = m.index;
src = src.slice(0, at) + `${m[1]}version: "${version}"` + src.slice(at + m[0].length);
const dateAt = src.indexOf('date: "today"', at);
if (dateAt >= 0 && dateAt - at < 300) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
    src = src.slice(0, dateAt) + `date: "${today}"` + src.slice(dateAt + 'date: "today"'.length);
}
writeFileSync(changelogPath, src, "utf8");

// 2) package.json — เฉพาะบรรทัด version แรก (ไม่ parse/serialize ใหม่ ไม่ให้รูปแบบไฟล์เพี้ยน)
const pkgPath = path("package.json");
const pkg = readFileSync(pkgPath, "utf8");
if (!/"version":\s*"[^"]*"/.test(pkg)) throw new Error('หา "version" ใน package.json ไม่เจอ');
writeFileSync(pkgPath, pkg.replace(/"version":\s*"[^"]*"/, `"version": "${semverOf(version)}"`), "utf8");

// 3) README.md — บรรทัด Current Version + พาดหัวรุ่น
const readmePath = path("README.md");
const readme = readFileSync(readmePath, "utf8");
const readmeRe = /(Current Version:\s*`v)[\d.]+(`\*\*\s*—\s*)[^\n]*/;
if (!readmeRe.test(readme)) throw new Error("หาบรรทัด Current Version ใน README.md ไม่เจอ");
writeFileSync(readmePath, readme.replace(readmeRe, `$1${version}$2${release.title}`), "utf8");

// 4) CHANGELOG.md
execFileSync(process.execPath, ["--experimental-strip-types", "scripts/gen-changelog.ts"], {
    cwd: fileURLToPath(rootUrl),
    stdio: "inherit",
});
console.log(`✅ ออกรุ่น v${version} แล้ว (lib/changelog.ts, package.json, README.md, CHANGELOG.md)`);
