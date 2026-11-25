'use server';

/**
 * คลังโน้ตไอเดีย (Idea Vault) — server actions
 * ------------------------------------------------
 * โน้ต = idea_vault · ลิงก์ไปของจริง = idea_vault_links (about / used_in)
 * ตาราง ideas เดิมไม่ถูกใช้เป็นคลังอีก — เหลือหน้าที่เก็บการ์ดฉากย่อยบนกระดานฉาก
 * วางโน้ตลงฉาก = คัดลอกเป็นการ์ดใหม่ใน ideas + ลิงก์ used_in (โน้ตไม่ถูกกิน)
 */

import { db } from "@/db/drizzle";
import { ideaVault, ideaVaultLinks, ideas, type IdeaVaultNote, type Idea } from "@/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-config";
import { requireNovelAccess } from "@/lib/authz";
import { resolveMany, search, type EntityType } from "./registry/entity-registry";
import { createTimelineEvent } from "./timeline";
import {
    cleanScopes, headlineOf, isVaultLinkTarget, SCOPE_OF_TARGET,
    type VaultLinkRelation, type VaultLinkTarget,
} from "@/lib/idea-scopes";

export interface VaultLinkView {
    id: string;
    targetType: VaultLinkTarget;
    targetId: string;
    relation: VaultLinkRelation;
    title: string;
    href: string | null;
}
export type VaultNoteView = IdeaVaultNote & { links: VaultLinkView[] };

type Result<T> = { success: true; data: T } | { success: false; error: string };

const MAX_BODY = 200_000; // ponytail: กันวางไฟล์ยักษ์ทั้งก้อน — เกินนี้ให้แบ่งวางหลายโน้ต

function touch(novelId: string) {
    revalidateTag(CACHE_TAGS.ideas(novelId), "default");
    revalidatePath(`/dashboard/project/${novelId}/idea`);
}

async function ownedNote(noteId: string) {
    const [note] = await db.select().from(ideaVault).where(eq(ideaVault.id, noteId)).limit(1);
    if (!note) return null;
    await requireNovelAccess(note.novelId);
    return note;
}

/** เติมชื่อ/ลิงก์ของ target — target ที่ถูกลบไปแล้วจะถูกกรองทิ้ง (ไม่ลบแถวลิงก์ให้อัตโนมัติ) */
async function withLinks(notes: IdeaVaultNote[]): Promise<VaultNoteView[]> {
    if (notes.length === 0) return [];
    const rows = await db.select().from(ideaVaultLinks).where(inArray(ideaVaultLinks.noteId, notes.map(n => n.id)));
    const refs = await resolveMany(rows.map(r => ({ type: r.targetType as EntityType, id: r.targetId })));
    const byNote = new Map<string, VaultLinkView[]>();
    for (const r of rows) {
        const ref = refs.get(`${r.targetType}:${r.targetId}`);
        if (!ref || !isVaultLinkTarget(r.targetType)) continue;
        const list = byNote.get(r.noteId) ?? [];
        list.push({
            id: r.id, targetType: r.targetType, targetId: r.targetId,
            relation: r.relation as VaultLinkRelation, title: ref.title, href: ref.href,
        });
        byNote.set(r.noteId, list);
    }
    return notes.map(n => ({ ...n, links: byNote.get(n.id) ?? [] }));
}

// ============================================
// READ
// ============================================

/** ทุกโน้ตของนิยาย (รวมกรุ + รออนุมัติ) ให้หน้าจอกรองเอง
 *  ponytail: โหลดทีเดียวทั้งหมด — ทำ pagination เมื่อเกิน ~2,000 โน้ตต่อนิยาย */
export async function getVault(novelId: string): Promise<Result<VaultNoteView[]>> {
    try {
        await requireNovelAccess(novelId);
        const notes = await db.select().from(ideaVault)
            .where(eq(ideaVault.novelId, novelId))
            .orderBy(desc(ideaVault.createdAt));
        return { success: true, data: await withLinks(notes) };
    } catch (error) {
        console.error("getVault:", error);
        return { success: false, error: "โหลดคลังไอเดียไม่สำเร็จ" };
    }
}

const _count = async (novelId: string) => {
    const rows = await db.select({ id: ideaVault.id }).from(ideaVault).where(and(
        eq(ideaVault.novelId, novelId), eq(ideaVault.isDetected, false), eq(ideaVault.isArchived, false),
    ));
    return rows.length;
};

/** ตัวนับบนหน้า project — cache 60s เหมือน getIdeasCount เดิม · เช็คสิทธิ์นอก cache */
export async function getVaultCount(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const count = await unstable_cache(() => _count(novelId), [`idea-vault-count-${novelId}`], {
            revalidate: 60, tags: [CACHE_TAGS.ideas(novelId)],
        })();
        return { success: true as const, count };
    } catch {
        return { success: false as const, count: 0 };
    }
}

/** แท็บไอเดียในหน้า entity: โน้ตที่ผูกกับตัวนี้ + โน้ตที่ติด scope ชนิดนี้แต่ยังไม่ผูกกับตัวไหนเลย */
export async function getVaultNotesForTarget(
    novelId: string, targetType: VaultLinkTarget, targetId: string,
): Promise<Result<{ linked: VaultNoteView[]; suggested: VaultNoteView[] }>> {
    try {
        await requireNovelAccess(novelId);
        const all = (await getVault(novelId));
        if (!all.success) return all;
        const live = all.data.filter(n => !n.isArchived && !n.isDetected);
        const linked = live.filter(n => n.links.some(l => l.relation === "about" && l.targetType === targetType && l.targetId === targetId));
        const scope = SCOPE_OF_TARGET[targetType];
        const suggested = scope
            ? live.filter(n => cleanScopes(n.scopes).includes(scope)
                && !n.links.some(l => l.relation === "about" && l.targetType === targetType))
            : [];
        return { success: true, data: { linked, suggested } };
    } catch (error) {
        console.error("getVaultNotesForTarget:", error);
        return { success: false, error: "โหลดไอเดียไม่สำเร็จ" };
    }
}

/** ตัวเลือกให้ผูก — ตัวละคร/ฝ่าย/สถานที่/พลัง/lore (ฉากผูกผ่าน used_in ตอนวางเท่านั้น) */
export async function searchVaultTargets(novelId: string, query: string) {
    try {
        await requireNovelAccess(novelId);
        const refs = await search(novelId, query.trim(), {
            types: ["character", "faction", "location", "power", "lore"], limitPerType: 6,
        });
        return refs.map(r => ({ type: r.type as VaultLinkTarget, id: r.id, title: r.title, subtitle: r.subtitle ?? null, href: r.href }));
    } catch (error) {
        console.error("searchVaultTargets:", error);
        return [];
    }
}

// ============================================
// WRITE — โน้ต
// ============================================

export async function createVaultNote(input: {
    novelId: string;
    text?: string;
    body?: string | null;
    summary?: string | null;
    source?: string | null;
    scopes?: string[];
    isDetected?: boolean;
    /** ผูก about ทันที (เช่น จดจากหน้าตัวละคร) */
    links?: { targetType: VaultLinkTarget; targetId: string }[];
}): Promise<Result<VaultNoteView> & { isDuplicate?: boolean }> {
    try {
        await requireNovelAccess(input.novelId);
        const body = input.body?.trim() || null;
        if (body && body.length > MAX_BODY) return { success: false, error: `ข้อความยาวเกิน ${MAX_BODY.toLocaleString()} ตัวอักษร` };
        const text = (input.text?.trim() || (body ? headlineOf(body) : "")).slice(0, 500);
        if (!text) return { success: false, error: "พิมพ์ไอเดียก่อน" };

        // กันกดซ้ำ: โน้ตสั้นข้อความเดียวกันที่ยังไม่เข้ากรุ = คืนอันเดิม (เอกสารยาวไม่กัน)
        if (!body) {
            const [dup] = await db.select().from(ideaVault).where(and(
                eq(ideaVault.novelId, input.novelId), eq(ideaVault.text, text), eq(ideaVault.isArchived, false),
            )).limit(1);
            if (dup && !dup.body) {
                const [view] = await withLinks([dup]);
                return { success: true, data: view, isDuplicate: true };
            }
        }

        const [note] = await db.insert(ideaVault).values({
            novelId: input.novelId,
            text,
            body,
            summary: input.summary?.trim() || null,
            summarySource: input.summary?.trim() ? "user" : null,
            source: input.source?.trim() || null,
            scopes: cleanScopes(input.scopes),
            isDetected: input.isDetected ?? false,
        }).returning();

        for (const l of input.links ?? []) {
            await linkInternal(note, l.targetType, l.targetId, "about");
        }
        touch(input.novelId);
        const [view] = await withLinks([note]);
        return { success: true, data: view };
    } catch (error) {
        console.error("createVaultNote:", error);
        return { success: false, error: "จดไอเดียไม่สำเร็จ" };
    }
}

export async function updateVaultNote(noteId: string, patch: Partial<{
    text: string;
    body: string | null;
    summary: string | null;
    source: string | null;
    scopes: string[];
    isArchived: boolean;
    isDetected: boolean;
}>): Promise<Result<IdeaVaultNote>> {
    try {
        const note = await ownedNote(noteId);
        if (!note) return { success: false, error: "ไม่พบโน้ต" };

        const set: Partial<typeof ideaVault.$inferInsert> = { updatedAt: new Date() };
        if (patch.text !== undefined) {
            const t = patch.text.trim().slice(0, 500);
            if (!t) return { success: false, error: "ข้อความโน้ตว่างไม่ได้" };
            set.text = t;
        }
        if (patch.body !== undefined) {
            const b = patch.body?.trim() || null;
            if (b && b.length > MAX_BODY) return { success: false, error: "ข้อความยาวเกินไป" };
            set.body = b;
        }
        if (patch.summary !== undefined) {
            set.summary = patch.summary?.trim() || null;
            set.summarySource = set.summary ? "user" : null; // แก้เอง = ห้าม AI เขียนทับภายหลัง
        }
        if (patch.source !== undefined) set.source = patch.source?.trim() || null;
        if (patch.scopes !== undefined) set.scopes = cleanScopes(patch.scopes);
        if (patch.isArchived !== undefined) set.isArchived = patch.isArchived;
        if (patch.isDetected !== undefined) set.isDetected = patch.isDetected;

        const [updated] = await db.update(ideaVault).set(set).where(eq(ideaVault.id, noteId)).returning();
        touch(note.novelId);
        return { success: true, data: updated };
    } catch (error) {
        console.error("updateVaultNote:", error);
        return { success: false, error: "บันทึกไม่สำเร็จ" };
    }
}

/** ลบถาวร (ลิงก์หายตาม cascade) — การ์ดในฉากที่เคยคัดลอกไปไม่กระทบ เพราะเป็นแถวใน ideas คนละแถว */
export async function deleteVaultNotes(novelId: string, noteIds: string[]): Promise<Result<number>> {
    try {
        await requireNovelAccess(novelId);
        if (noteIds.length === 0) return { success: true, data: 0 };
        const rows = await db.delete(ideaVault)
            .where(and(eq(ideaVault.novelId, novelId), inArray(ideaVault.id, noteIds)))
            .returning({ id: ideaVault.id });
        touch(novelId);
        return { success: true, data: rows.length };
    } catch (error) {
        console.error("deleteVaultNotes:", error);
        return { success: false, error: "ลบไม่สำเร็จ" };
    }
}

/** อนุมัติโน้ตที่ AI สกัดได้ → เข้าคลังปกติ */
export async function acceptDetectedNotes(novelId: string, noteIds: string[]): Promise<Result<number>> {
    try {
        await requireNovelAccess(novelId);
        if (noteIds.length === 0) return { success: true, data: 0 };
        const rows = await db.update(ideaVault)
            .set({ isDetected: false, updatedAt: new Date() })
            .where(and(eq(ideaVault.novelId, novelId), inArray(ideaVault.id, noteIds)))
            .returning({ id: ideaVault.id });
        touch(novelId);
        return { success: true, data: rows.length };
    } catch (error) {
        console.error("acceptDetectedNotes:", error);
        return { success: false, error: "อนุมัติไม่สำเร็จ" };
    }
}

// ============================================
// WRITE — ลิงก์
// ============================================

/** ตรวจว่า target มีจริงและอยู่นิยายเดียวกับโน้ต (trust boundary — id มาจาก client) */
async function linkInternal(note: IdeaVaultNote, targetType: VaultLinkTarget, targetId: string, relation: VaultLinkRelation) {
    if (!isVaultLinkTarget(targetType)) throw new Error(`bad target type: ${targetType}`);
    const refs = await resolveMany([{ type: targetType, id: targetId }]);
    const ref = refs.get(`${targetType}:${targetId}`);
    if (!ref || ref.novelId !== note.novelId) throw new Error("target not in this novel");
    await db.insert(ideaVaultLinks)
        .values({ novelId: note.novelId, noteId: note.id, targetType, targetId, relation })
        .onConflictDoNothing();
}

export async function addVaultLink(
    noteId: string, targetType: VaultLinkTarget, targetId: string, relation: VaultLinkRelation = "about",
): Promise<Result<true>> {
    try {
        const note = await ownedNote(noteId);
        if (!note) return { success: false, error: "ไม่พบโน้ต" };
        await linkInternal(note, targetType, targetId, relation);
        touch(note.novelId);
        return { success: true, data: true };
    } catch (error) {
        console.error("addVaultLink:", error);
        return { success: false, error: "ผูกไม่สำเร็จ" };
    }
}

export async function removeVaultLink(
    noteId: string, targetType: VaultLinkTarget, targetId: string, relation: VaultLinkRelation = "about",
): Promise<Result<true>> {
    try {
        const note = await ownedNote(noteId);
        if (!note) return { success: false, error: "ไม่พบโน้ต" };
        await db.delete(ideaVaultLinks).where(and(
            eq(ideaVaultLinks.noteId, noteId), eq(ideaVaultLinks.targetType, targetType),
            eq(ideaVaultLinks.targetId, targetId), eq(ideaVaultLinks.relation, relation),
        ));
        touch(note.novelId);
        return { success: true, data: true };
    } catch (error) {
        console.error("removeVaultLink:", error);
        return { success: false, error: "ถอดไม่สำเร็จ" };
    }
}

// ============================================
// ใช้โน้ต — คัดลอกเป็นการ์ดฉากย่อย
// ============================================

/** คัดลอกโน้ตเป็นการ์ดใหม่ในตาราง ideas (ข้าม dedupe ชื่อของ createIdea — การ์ดกับโน้ตเป็นคนละโลก)
 *  ส่ง eventId มา = ผูก used_in ให้ด้วย (กรณีวางลงกระดานฉากที่รู้ฉากอยู่แล้ว) */
export async function createBeatFromNote(noteId: string, eventId?: string): Promise<Result<Idea>> {
    try {
        const note = await ownedNote(noteId);
        if (!note) return { success: false, error: "ไม่พบโน้ต" };
        const [beat] = await db.insert(ideas).values({
            novelId: note.novelId,
            title: note.text,
            // การ์ดเก็บแค่สรุป/500 ตัวแรก — ตัวเต็มอยู่ในคลัง (โยงกลับด้วย used_in) ไม่ต้องซ้ำไป ideas + canvas_data
            content: note.summary ?? (note.body ? note.body.slice(0, 500) : null),
            summary: note.summary,
            category: "general",
            isUsed: true,
        }).returning();
        if (eventId) {
            await linkInternal(note, "timelineEvent", eventId, "used_in");
            touch(note.novelId);
        }
        return { success: true, data: beat };
    } catch (error) {
        console.error("createBeatFromNote:", error);
        return { success: false, error: "ใช้โน้ตไม่สำเร็จ" };
    }
}

/** ถาดบนกระดานพล็อต: วางโน้ตลงบท = สร้างฉากใหม่ท้ายบท มีการ์ด (สำเนา) ใบแรก + ผูก used_in */
export async function placeNoteInChapter(noteId: string, chapterId: string) {
    const beatRes = await createBeatFromNote(noteId);
    if (!beatRes.success) return beatRes;
    const beat = beatRes.data;
    const res = await createTimelineEvent({
        novelId: beat.novelId,
        title: beat.title,
        description: beat.content?.slice(0, 500) || null,
        relatedChapterId: chapterId,
        eventType: "scene",
        orderIndex: 0, // createTimelineEvent คำนวณต่อท้ายบทเอง
        canvasData: [{ id: crypto.randomUUID(), type: "idea", referenceId: beat.id, title: beat.title, content: beat.content ?? "", children: [], links: [] }],
    });
    if (!res.success || !res.event) {
        // ลบเฉพาะการ์ดสำเนาที่เพิ่งสร้างในคอลนี้ (ยังไม่มีอะไรอ้าง) — โน้ตต้นทางไม่ถูกแตะ
        await db.delete(ideas).where(eq(ideas.id, beat.id));
        return { success: false as const, error: "สร้างฉากไม่สำเร็จ" };
    }
    const note = await ownedNote(noteId);
    if (note) {
        await linkInternal(note, "timelineEvent", res.event.id, "used_in");
        touch(note.novelId);
    }
    return { success: true as const, data: { event: res.event, beat } };
}
