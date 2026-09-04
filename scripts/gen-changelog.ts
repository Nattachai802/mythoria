/**
 * สร้าง CHANGELOG.md จาก lib/changelog.ts — รันด้วย `npm run changelog`
 *
 * ไฟล์ .md เป็นผลลัพธ์ ไม่ใช่ต้นทาง ห้ามแก้มือ (แก้แล้วรอบหน้าโดนเขียนทับ)
 * แก้ที่ lib/changelog.ts แล้วรันคำสั่งนี้ · `npm run check` จะเตือนถ้าลืมรัน
 */
import { writeFileSync } from "node:fs";
import { CHANGELOG, CHANGE_KINDS, CHANGE_KIND_LABEL, type ChangeKind } from "../lib/changelog.ts";

const lines: string[] = [
    "# Changelog",
    "",
    "> ไฟล์นี้ generate จาก `lib/changelog.ts` ด้วย `npm run changelog` — **ห้ามแก้มือ**",
    "",
];

for (const release of CHANGELOG) {
    lines.push(`## [${release.version}] — ${release.date}`, "", `**${release.title}**`, "");

    for (const kind of CHANGE_KINDS) {
        const items = release.entries.filter(e => e.kind === kind);
        if (items.length === 0) continue;
        lines.push(`### ${CHANGE_KIND_LABEL[kind as ChangeKind]}`, "");
        for (const item of items) {
            lines.push(`- ${item.text}`);
            if (item.detail) lines.push(`  - ${item.detail}`);
        }
        lines.push("");
    }
}

const out = new URL("../CHANGELOG.md", import.meta.url);
writeFileSync(out, lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n", "utf8");
console.log(`เขียน CHANGELOG.md แล้ว — ${CHANGELOG.length} รุ่น ล่าสุด v${CHANGELOG[0].version}`);
