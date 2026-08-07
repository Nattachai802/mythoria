import type { EntityType } from "@/server/registry/entity-registry";

/**
 * ดึง {type,id} จาก mention span ในเนื้อหา Quill (HTML)
 * span รูปแบบ quill-mention: <span class="mention" ... data-id="..." data-type="character" ...>
 * pure + sync → unit-testable (ดู lib/mentions.test.ts)
 */
export function parseMentions(html: string): { type: EntityType; id: string }[] {
    if (!html) return [];
    const out: { type: EntityType; id: string }[] = [];
    const seen = new Set<string>();
    const spanRe = /<span[^>]*class="[^"]*mention[^"]*"[^>]*>/g;
    for (const span of html.match(spanRe) ?? []) {
        const id = span.match(/data-id="([^"]+)"/)?.[1];
        const type = span.match(/data-type="([^"]+)"/)?.[1] as EntityType | undefined;
        if (!id || !type) continue;
        const key = `${type}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ type, id });
    }
    return out;
}

/**
 * ช่วง [start,end) ของ @mention ที่ติดกับ caret ใน textarea — ให้ Backspace/Delete ลบทั้งแท็กในทีเดียว
 * แทนที่จะกินทีละตัวอักษร (ชื่อไทยยาว ๆ ต้องกด 10 กว่าครั้ง)
 * dir "back" = Backspace (มองข้างหลัง caret), "forward" = Delete (มองข้างหน้า)
 * เรียงชื่อยาวก่อน กัน "@สมชาย" ไปแมตช์ทับ "@สมชายใหญ่" — เหมือน renderNoteMentions
 * pure + sync → ดู lib/mentions.test.ts
 */
export function mentionRangeAtCaret(
    text: string,
    caret: number,
    names: string[],
    dir: "back" | "forward",
): [number, number] | null {
    const esc = names
        .filter(Boolean)
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!esc.length) return null;
    // " ?" = กินช่องว่างที่ insertQm เติมท้ายไปด้วย ไม่งั้นลบแท็กแล้วเหลือช่องว่างลอย
    const alt = `@(?:${esc.join("|")}) ?`;
    if (dir === "back") {
        const m = text.slice(0, caret).match(new RegExp(`${alt}$`));
        return m ? [caret - m[0].length, caret] : null;
    }
    const m = text.slice(caret).match(new RegExp(`^${alt}`));
    return m ? [caret, caret + m[0].length] : null;
}
