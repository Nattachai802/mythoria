"use server";

import { search } from "./registry/entity-registry";
import { addReferences, removeOutgoingReferences, type AddReferenceInput } from "./references";
import { parseMentions } from "@/lib/mentions";

/**
 * Context Fabric — @-mention (Phase 5 Track B)
 * ฝั่ง server: ป้อน dropdown + แปลง mention ในเนื้อหา → references (createdBy=user)
 */

// quill-mention dropdown source — ค้นทุก entity type ในนิยาย
export async function searchEntities(novelId: string, query: string) {
    const refs = await search(novelId, query, { limitPerType: 4 });
    // รูปแบบที่ quill-mention ใช้: ต้องมี id + value, ที่เหลือเก็บเป็น data-attribute
    return refs.map((r) => ({
        id: r.id,
        value: r.title,
        type: r.type,
        link: r.href,
        icon: r.icon ?? "",
    }));
}

/**
 * sync mentions ของ note หนึ่งให้ตรงกับเนื้อหา (resync: ลบเก่า เขียนใหม่)
 * เรียกหลัง save note
 */
export async function syncNoteMentions(noteId: string, novelId: string, html: string) {
    const mentions = parseMentions(html);
    await removeOutgoingReferences({ type: "note", id: noteId }, "mentions");
    if (mentions.length === 0) return { success: true, count: 0 };

    const refs: AddReferenceInput[] = mentions.map((m) => ({
        novelId,
        from: { type: "note", id: noteId },
        to: { type: m.type, id: m.id },
        relation: "mentions",
        createdBy: "user",
    }));
    await addReferences(refs);
    return { success: true, count: refs.length };
}
