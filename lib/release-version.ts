// ตัวคำนวณเลขเวอร์ชันรุ่นถัดไปจากรายการเปลี่ยนแปลง — ใช้โดย scripts/release.ts และ lib/changelog.check.ts
//
// รูปเลข: Major.Minor.Function.Bugfix (ตาม .claude/CLAUDE.md หัวข้อ Version Numbering)
//   มี "added"                     → Minor +1, Function รีเซ็ตเป็น 0
//   มี "changed"/"removed" (ไม่มี added) → Function +1
//   มีแต่ "fixed"                  → เปลี่ยนแค่ Bugfix
//   Bugfix = เลขสุ่ม 10 หลัก สุ่มใหม่ทุกรุ่น ไม่เรียง ไม่นับ — ลำดับรุ่นดูจากตำแหน่งใน CHANGELOG + วันที่
//   major ไม่เคยขึ้นเอง — ต้องเขียน `bump: "major"` ในรุ่นนั้น (ผู้ใช้สั่ง)
// package.json เก็บได้แค่ semver 3 ส่วน (npm) จึงใส่แค่ Major.Minor.Function — ดู semverOf
// รุ่นเก่ากว่า 2.15 เป็นรูป x.y.z (3 ส่วน) อ่านเป็น Major.Minor.Function ที่ไม่มี Bugfix
//
// pure data/logic — ห้าม import (ตัวรันเทสต์ resolve relative import แบบไม่ใส่นามสกุลไม่ได้)

/** "patch" = ชื่อเดิมก่อนเปลี่ยนเป็น 4 ส่วน (เท่ากับ "function") คงไว้ให้รุ่นเก่าที่เขียนไว้แล้วยังอ่านได้ */
export type Bump = "major" | "minor" | "function" | "bugfix" | "patch";

export type Version = [major: number, minor: number, fn: number, bugfix: string | null];

export function parseVersion(v: string): Version | null {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:\.(\d{10}))?$/.exec(v);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ?? null] : null;
}

/** เลขสุ่ม 10 หลัก (ไม่ขึ้นต้นด้วย 0) */
export function randomBugfix(): string {
    return String(1_000_000_000 + Math.floor(Math.random() * 9_000_000_000));
}

/** เลขที่ต้องขึ้นตามรายการ — override (bump ที่เขียนในรุ่น) ชนะกติกา */
export function bumpFor(entries: Array<{ kind: string }>, override?: Bump): Bump {
    if (override) return override === "patch" ? "function" : override;
    if (entries.some((e) => e.kind === "added")) return "minor";
    if (entries.some((e) => e.kind === "changed" || e.kind === "removed")) return "function";
    return "bugfix";
}

export function applyBump(prev: string, bump: Bump, bugfix: string = randomBugfix()): string {
    const p = parseVersion(prev);
    if (!p) throw new Error(`เลขเวอร์ชันก่อนหน้า "${prev}" ไม่ใช่รูป Major.Minor.Function(.Bugfix)`);
    const [maj, min, fn, prevBug] = p;
    if (bugfix === prevBug) bugfix = randomBugfix(); // ซ้ำรุ่นก่อน (โอกาสน้อยมาก) สุ่มใหม่
    const b = bump === "patch" ? "function" : bump;
    const [M, m, f] = b === "major" ? [maj + 1, 0, 0] : b === "minor" ? [maj, min + 1, 0] : b === "function" ? [maj, min, fn + 1] : [maj, min, fn];
    return `${M}.${m}.${f}.${bugfix}`;
}

export function nextVersion(prev: string, entries: Array<{ kind: string }>, override?: Bump, bugfix?: string): string {
    return applyBump(prev, bumpFor(entries, override), bugfix);
}

/** Major.Minor.Function — ส่วนที่ใช้เทียบกติกาและใส่ package.json (Bugfix สุ่มจึงเทียบไม่ได้) */
export function semverOf(v: string): string {
    const p = parseVersion(v);
    if (!p) throw new Error(`"${v}" ไม่ใช่เลขเวอร์ชัน`);
    return `${p[0]}.${p[1]}.${p[2]}`;
}

/** อธิบายสั้น ๆ ว่าทำไมได้เลขนี้ — ไว้พิมพ์ตอนรัน npm run release */
export function explainBump(entries: Array<{ kind: string }>, override?: Bump): string {
    if (override) return `${override === "patch" ? "function" : override} (ตั้งเองด้วย bump: "${override}")`;
    const b = bumpFor(entries);
    return b === "minor" ? "minor (มี added)" : b === "function" ? "function (มี changed/removed)" : "bugfix (มีแต่ fixed)";
}
