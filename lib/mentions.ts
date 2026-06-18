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
