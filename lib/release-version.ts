// ตัวคำนวณเลขเวอร์ชันรุ่นถัดไปจากรายการเปลี่ยนแปลง — ใช้โดย scripts/release.ts และ lib/changelog.check.ts
//
// รูปเลข: Major.Minor.Function.Bugfix (ตาม .claude/CLAUDE.md หัวข้อ Version Numbering)
//   มี "added"                     → Minor +1, Function รีเซ็ตเป็น 0
//   มี "changed"/"removed" (ไม่มี added) → Function +1
//   มีแต่ "fixed"                  → Bugfix +1
//   Bugfix = ตัวนับเรียง รีเซ็ตเป็น 0 เมื่อ Major/Minor/Function ขยับ (ข้อตกลง 2026-11-10)
//   รุ่นก่อนข้อตกลงนี้มี Bugfix เป็นเลขสุ่ม 10 หลัก (legacy) — อ่านได้ ถ้ารุ่นถัดไปมีแต่ fixed จะเริ่มนับที่ 1
//   major ไม่เคยขึ้นเอง — ต้องเขียน `bump: "major"` ในรุ่นนั้น (ผู้ใช้สั่ง)
// package.json เก็บได้แค่ semver 3 ส่วน (npm) จึงใส่แค่ Major.Minor.Function — ดู semverOf
// รุ่นเก่ากว่า 2.15 เป็นรูป x.y.z (3 ส่วน) อ่านเป็น Major.Minor.Function ที่ไม่มี Bugfix
//
// pure data/logic — ห้าม import (ตัวรันเทสต์ resolve relative import แบบไม่ใส่นามสกุลไม่ได้)

/** "patch" = ชื่อเดิมก่อนเปลี่ยนเป็น 4 ส่วน (เท่ากับ "function") คงไว้ให้รุ่นเก่าที่เขียนไว้แล้วยังอ่านได้ */
export type Bump = "major" | "minor" | "function" | "bugfix" | "patch";

export type Version = [major: number, minor: number, fn: number, bugfix: string | null];

export function parseVersion(v: string): Version | null {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:\.(\d{1,10}))?$/.exec(v);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ?? null] : null;
}

/** Bugfix เลขสุ่ม 10 หลักจากกติกาเก่า — ไม่ใช่ตัวนับ เทียบลำดับไม่ได้ */
export const isLegacyBugfix = (b: string | null) => b !== null && b.length === 10;

/** เลขที่ต้องขึ้นตามรายการ — override (bump ที่เขียนในรุ่น) ชนะกติกา */
export function bumpFor(entries: Array<{ kind: string }>, override?: Bump): Bump {
    if (override) return override === "patch" ? "function" : override;
    if (entries.some((e) => e.kind === "added")) return "minor";
    if (entries.some((e) => e.kind === "changed" || e.kind === "removed")) return "function";
    return "bugfix";
}

export function applyBump(prev: string, bump: Bump): string {
    const p = parseVersion(prev);
    if (!p) throw new Error(`เลขเวอร์ชันก่อนหน้า "${prev}" ไม่ใช่รูป Major.Minor.Function(.Bugfix)`);
    const [maj, min, fn, prevBug] = p;
    const b = bump === "patch" ? "function" : bump;
    if (b === "bugfix") {
        const n = prevBug === null || isLegacyBugfix(prevBug) ? 1 : Number(prevBug) + 1;
        return `${maj}.${min}.${fn}.${n}`;
    }
    const [M, m, f] = b === "major" ? [maj + 1, 0, 0] : b === "minor" ? [maj, min + 1, 0] : [maj, min, fn + 1];
    return `${M}.${m}.${f}.0`;
}

export function nextVersion(prev: string, entries: Array<{ kind: string }>, override?: Bump): string {
    return applyBump(prev, bumpFor(entries, override));
}

/** Major.Minor.Function — ส่วนที่ใส่ package.json (npm รับ semver 3 ส่วน) */
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
