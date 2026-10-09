// ตัวคำนวณเลขเวอร์ชันรุ่นถัดไปจากรายการเปลี่ยนแปลง — ใช้โดย scripts/release.ts และ lib/changelog.check.ts
// กติกา (เลขไม่ได้มาจากความรู้สึกคนเขียน ไม่งั้นเลขวิ่งเกินจริงเวลาทำแค่แก้บั๊ก):
//   มีแต่ "fixed"                      → patch  (x.y.Z+1)
//   มี "added" / "changed" / "removed" → minor  (x.Y+1.0)
//   major ไม่เคยขึ้นเอง — ต้องเขียน `bump: "major"` ในรุ่นนั้นเอง
// อยากให้รุ่นที่มี changed/added เป็น patch (ปรับเล็กน้อย) หรือแตกต่างจากกติกา → ใส่ `bump` ชัด ๆ ในรุ่นนั้น (เห็นในรีวิว)
// pure data/logic — ห้าม import (ตัวรันเทสต์ resolve relative import แบบไม่ใส่นามสกุลไม่ได้)

export type Bump = "major" | "minor" | "patch";

export function parseVersion(v: string): [number, number, number] | null {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** เลขเวอร์ชันที่ต้องขึ้นตามรายการ — override (bump ที่เขียนในรุ่น) ชนะกติกา */
export function bumpFor(entries: Array<{ kind: string }>, override?: Bump): Bump {
    if (override) return override;
    return entries.some((e) => e.kind !== "fixed") ? "minor" : "patch";
}

export function applyBump(prev: string, bump: Bump): string {
    const p = parseVersion(prev);
    if (!p) throw new Error(`เลขเวอร์ชันก่อนหน้า "${prev}" ไม่ใช่รูป x.y.z`);
    const [maj, min, pat] = p;
    return bump === "major" ? `${maj + 1}.0.0` : bump === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
}

export function nextVersion(prev: string, entries: Array<{ kind: string }>, override?: Bump): string {
    return applyBump(prev, bumpFor(entries, override));
}

/** อธิบายสั้น ๆ ว่าทำไมได้เลขนี้ — ไว้พิมพ์ตอนรัน npm run release */
export function explainBump(entries: Array<{ kind: string }>, override?: Bump): string {
    if (override) return `${override} (ตั้งเองด้วย bump: "${override}")`;
    const kinds = [...new Set(entries.map((e) => e.kind))];
    return entries.some((e) => e.kind !== "fixed")
        ? `minor (มี ${kinds.filter((k) => k !== "fixed").join("/")})`
        : "patch (มีแต่ fixed)";
}
