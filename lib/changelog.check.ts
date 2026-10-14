/**
 * บังคับว่าเลขเวอร์ชันสามที่ต้องตรงกัน — รันด้วย `npm run check`
 *
 * มีไฟล์นี้เพราะเคยหลุดมาแล้วจริง: package.json เดินสเกล 0.5.x ขณะที่ README บอก v2.3.1
 * ไม่มีอะไรเตือน กว่าจะรู้ก็ตอนคนมาอ่านเจอเอง
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { CHANGELOG, RELEASED, CHANGE_KINDS, CURRENT_VERSION } from "./changelog.ts";
import { nextVersion, explainBump, parseVersion, semverOf } from "./release-version.ts";

const root = new URL("..", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

// ── โครงสร้างข้อมูล ──
assert(CHANGELOG.length > 0, "CHANGELOG ต้องมีอย่างน้อยหนึ่งรุ่น");

const seen = new Set<string>();
// รุ่น "next" = รายการที่สะสมรอออกรุ่น — push ได้ (ข้อตกลง 2026-10-14) แต่มีได้รุ่นเดียวและต้องอยู่บนสุด
assert(CHANGELOG.filter((r) => r.version === "next").length <= 1, 'มีรุ่น "next" ได้รุ่นเดียว');
assert(CHANGELOG.findIndex((r) => r.version === "next") <= 0, 'รุ่น "next" ต้องอยู่บนสุดของ CHANGELOG');
assert(RELEASED.length > 0, "ต้องมีรุ่นที่ออกแล้วอย่างน้อยหนึ่งรุ่น");

for (const r of CHANGELOG) {
    if (r.version !== "next") {
        assert(parseVersion(r.version), `version "${r.version}" ต้องเป็นรูป Major.Minor.Function.Bugfix (รุ่นเก่า x.y.z)`);
    }
    assert(!seen.has(r.version), `version "${r.version}" ซ้ำ`);
    seen.add(r.version);
    assert(r.version === "next" ? /^(today|\d{4}-\d{2}-\d{2})$/.test(r.date) : /^\d{4}-\d{2}-\d{2}$/.test(r.date),
        `date ของ ${r.version} ต้องเป็น YYYY-MM-DD`);
    assert(r.title.trim().length > 0, `${r.version} ต้องมี title`);
    assert(r.entries.length > 0, `${r.version} ต้องมีรายการเปลี่ยนแปลงอย่างน้อยหนึ่งข้อ`);
    for (const e of r.entries) {
        assert(CHANGE_KINDS.includes(e.kind), `${r.version}: kind "${e.kind}" ไม่รู้จัก`);
        assert(e.text.trim().length > 0, `${r.version}: มีรายการที่ text ว่าง`);
    }
}

// ใหม่สุดต้องอยู่บนสุด — CURRENT_VERSION กับหน้าในแอปยึด RELEASED[0]
// เทียบแค่ Major.Minor.Function (Bugfix สุ่ม) · เท่ากัน = รุ่นแก้บั๊กต่อกัน ดูวันที่แทน
for (let i = 1; i < RELEASED.length; i++) {
    const a = parseVersion(RELEASED[i - 1].version)!, b = parseVersion(RELEASED[i].version)!;
    const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    assert(cmp > 0 || (cmp === 0 && RELEASED[i - 1].date >= RELEASED[i].date),
        `CHANGELOG ต้องเรียงใหม่→เก่า แต่ ${RELEASED[i - 1].version} ไม่ได้ใหม่กว่า ${RELEASED[i].version}`);
}

// ── เลขของรุ่นล่าสุดต้องตรงกติกา (กันเลขวิ่งเกินจริงตอนทำแค่แก้บั๊ก) ──
// ตรวจเฉพาะรุ่นบนสุดเทียบกับรุ่นก่อนหน้า (รุ่นเก่ากว่านั้นออกก่อนมีกติกา) · อยากได้เลขต่างจากกติกาให้ใส่ bump ในรุ่นนั้นชัด ๆ
// เทียบแค่ Major.Minor.Function — Bugfix สุ่มทุกรุ่น · รุ่นรูป x.y.z ออกก่อนกติกา 4 ส่วน (ก่อน 2026-10-14) ไม่ตรวจ
if (RELEASED.length >= 2 && parseVersion(RELEASED[0].version)![3] !== null) {
    const top = RELEASED[0];
    const expected = semverOf(nextVersion(RELEASED[1].version, top.entries, top.bump));
    assert(
        semverOf(top.version) === expected,
        `รุ่น ${top.version} ควรเป็น ${expected} ตามกติกา [${explainBump(top.entries, top.bump)}] เทียบกับ ${CHANGELOG[1].version} — ` +
            `ใช้ \`npm run release\` ให้คำนวณ หรือถ้าผู้ใช้สั่งให้ต่างจากกติกาใส่ bump: "major"|"minor"|"function"|"bugfix" ในรุ่นนั้น`,
    );
}

// ── เลขต้องตรงกันสามที่ ──
const pkg = JSON.parse(read("package.json")) as { version: string };
assert(
    pkg.version === semverOf(CURRENT_VERSION), // npm รับ semver 3 ส่วนเท่านั้น จึงไม่มี Bugfix
    `package.json version = "${pkg.version}" แต่ CHANGELOG ล่าสุด = "${CURRENT_VERSION}" (ต้องเป็น ${semverOf(CURRENT_VERSION)}) — แก้ให้ตรงกัน`,
);

const readme = read("README.md");
const readmeVersion = readme.match(/Current Version:\s*`?v?([\d.]+)`?/)?.[1];
assert(readmeVersion, "หาบรรทัด Current Version ใน README.md ไม่เจอ");
assert(
    readmeVersion === CURRENT_VERSION,
    `README Current Version = "${readmeVersion}" แต่ CHANGELOG ล่าสุด = "${CURRENT_VERSION}" — แก้ให้ตรงกัน`,
);

// ── CHANGELOG.md ต้องไม่ค้างของเก่า ──
// ไฟล์ .md เป็นของที่ generate ออกมา ไม่ใช่ที่เขียนเอง ลืม `npm run changelog` แล้วมันจะเพี้ยนเงียบ ๆ
let generated: string | null = null;
try {
    generated = read("CHANGELOG.md");
} catch {
    generated = null;
}
assert(generated !== null, "ยังไม่มี CHANGELOG.md — รัน `npm run changelog`");
assert(
    generated.includes(`## [${CURRENT_VERSION}]`),
    `CHANGELOG.md ยังไม่มีรุ่น ${CURRENT_VERSION} — รัน \`npm run changelog\``,
);

const pending = CHANGELOG[0].version === "next" ? ` · รอออกรุ่น ${CHANGELOG[0].entries.length} รายการ` : "";
console.log(`✅ changelog ผ่านทั้งหมด (v${CURRENT_VERSION}, ${RELEASED.length} รุ่น${pending})`);
