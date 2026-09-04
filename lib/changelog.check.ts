/**
 * บังคับว่าเลขเวอร์ชันสามที่ต้องตรงกัน — รันด้วย `npm run check`
 *
 * มีไฟล์นี้เพราะเคยหลุดมาแล้วจริง: package.json เดินสเกล 0.5.x ขณะที่ README บอก v2.3.1
 * ไม่มีอะไรเตือน กว่าจะรู้ก็ตอนคนมาอ่านเจอเอง
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { CHANGELOG, CHANGE_KINDS, CURRENT_VERSION } from "./changelog.ts";

const root = new URL("..", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

// ── โครงสร้างข้อมูล ──
assert(CHANGELOG.length > 0, "CHANGELOG ต้องมีอย่างน้อยหนึ่งรุ่น");

const seen = new Set<string>();
for (const r of CHANGELOG) {
    assert(/^\d+\.\d+\.\d+$/.test(r.version), `version "${r.version}" ต้องเป็นรูป x.y.z`);
    assert(!seen.has(r.version), `version "${r.version}" ซ้ำ`);
    seen.add(r.version);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(r.date), `date ของ ${r.version} ต้องเป็น YYYY-MM-DD`);
    assert(r.title.trim().length > 0, `${r.version} ต้องมี title`);
    assert(r.entries.length > 0, `${r.version} ต้องมีรายการเปลี่ยนแปลงอย่างน้อยหนึ่งข้อ`);
    for (const e of r.entries) {
        assert(CHANGE_KINDS.includes(e.kind), `${r.version}: kind "${e.kind}" ไม่รู้จัก`);
        assert(e.text.trim().length > 0, `${r.version}: มีรายการที่ text ว่าง`);
    }
}

// ใหม่สุดต้องอยู่บนสุด — CURRENT_VERSION กับหน้าในแอปยึด CHANGELOG[0]
const num = (v: string) => v.split(".").map(Number);
for (let i = 1; i < CHANGELOG.length; i++) {
    const [aM, am, ap] = num(CHANGELOG[i - 1].version);
    const [bM, bm, bp] = num(CHANGELOG[i].version);
    const newer = aM !== bM ? aM > bM : am !== bm ? am > bm : ap > bp;
    assert(newer, `CHANGELOG ต้องเรียงใหม่→เก่า แต่ ${CHANGELOG[i - 1].version} ไม่ได้ใหม่กว่า ${CHANGELOG[i].version}`);
}

// ── เลขต้องตรงกันสามที่ ──
const pkg = JSON.parse(read("package.json")) as { version: string };
assert(
    pkg.version === CURRENT_VERSION,
    `package.json version = "${pkg.version}" แต่ CHANGELOG ล่าสุด = "${CURRENT_VERSION}" — แก้ให้ตรงกัน`,
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

console.log(`✅ changelog ผ่านทั้งหมด (v${CURRENT_VERSION}, ${CHANGELOG.length} รุ่น)`);
