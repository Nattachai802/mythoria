"use server";

import { db } from "@/db/drizzle";
import { references, novels } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  resolveMany,
  type EntityRef,
  type EntityType,
} from "./registry/entity-registry";
import { buildDerivedReferences } from "./references-build";

/**
 * Context Fabric — L1 Universal Reference API
 * -------------------------------------------
 * ชั้นเชื่อมกลาง: แทน junction table 20+ ตัว ด้วย edge เดียว
 *   from --(relation)--> to
 * บันทึกทิศทาง → ถามได้ทั้ง outgoing และ backlink (incoming)
 *
 * docs/context-fabric-plan.md
 */

export type ReferenceRelation =
  // mention / authoring
  | "mentions"
  // presence / participation
  | "features"
  | "set_in"
  // affiliation
  | "member_of"
  // spatial
  | "inhabits"
  | "connects_to"
  | "located_in"
  // powers
  | "wields"
  | "combines_into"
  // relationships
  | "related_to"
  // narrative structure
  | "advances"
  | "grouped_in"
  // ideas
  | "linked_to"
  | "derived_from"
  // reserved (Promise Ledger / manual / AI — Phase 5+)
  | "foreshadows"
  | "pays_off"
  | "contradicts"
  | "depends_on";

export type ReferenceCreatedBy = "user" | "ai" | "migration";

interface EntityPointer {
  type: EntityType;
  id: string;
}

export interface AddReferenceInput {
  novelId: string;
  from: EntityPointer;
  to: EntityPointer;
  relation: ReferenceRelation;
  context?: string;
  sourceSpan?: { start: number; end: number } | null;
  meta?: Record<string, unknown> | null;
  createdBy?: ReferenceCreatedBy;
  confidence?: number | null; // 0-100 สำหรับ ai, null=manual
}

/**
 * เพิ่ม reference (idempotent) — upsert บน edge เดียวกัน (from,to,relation)
 * ถ้ามีอยู่แล้วจะอัปเดต context/meta แทนการสร้างซ้ำ
 */
export async function addReference(input: AddReferenceInput) {
  try {
    const [row] = await db
      .insert(references)
      .values({
        novelId: input.novelId,
        fromType: input.from.type,
        fromId: input.from.id,
        toType: input.to.type,
        toId: input.to.id,
        relation: input.relation,
        context: input.context,
        sourceSpan: input.sourceSpan ?? undefined,
        meta: input.meta ?? undefined,
        createdBy: input.createdBy ?? "user",
        confidence: input.confidence ?? undefined,
      })
      .onConflictDoUpdate({
        target: [
          references.fromType,
          references.fromId,
          references.toType,
          references.toId,
          references.relation,
        ],
        set: {
          context: input.context,
          sourceSpan: input.sourceSpan ?? undefined,
          meta: input.meta ?? undefined,
        },
      })
      .returning();
    return { success: true, data: row };
  } catch (error) {
    console.error("[references] addReference error:", error);
    return { success: false, error: "Failed to add reference" };
  }
}

/**
 * เพิ่มหลาย reference พร้อมกัน — ใช้โดย backfill / mention sync
 * ข้าม edge ซ้ำเงียบๆ (onConflictDoNothing)
 */
export async function addReferences(inputs: AddReferenceInput[]) {
  if (inputs.length === 0) return { success: true, inserted: 0 };
  try {
    const rows = await db
      .insert(references)
      .values(
        inputs.map((input) => ({
          novelId: input.novelId,
          fromType: input.from.type,
          fromId: input.from.id,
          toType: input.to.type,
          toId: input.to.id,
          relation: input.relation,
          context: input.context,
          sourceSpan: input.sourceSpan ?? undefined,
          meta: input.meta ?? undefined,
          createdBy: input.createdBy ?? "user",
          confidence: input.confidence ?? undefined,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: references.id });
    return { success: true, inserted: rows.length };
  } catch (error) {
    console.error("[references] addReferences error:", error);
    return { success: false, error: "Failed to add references" };
  }
}

export async function removeReference(id: string) {
  try {
    await db.delete(references).where(eq(references.id, id));
    return { success: true };
  } catch (error) {
    console.error("[references] removeReference error:", error);
    return { success: false, error: "Failed to remove reference" };
  }
}

/**
 * ลบ reference เฉพาะของ edge หนึ่ง (ใช้ตอน junction เดิมถูกลบ — dual-write)
 */
export async function removeReferenceEdge(edge: {
  from: EntityPointer;
  to: EntityPointer;
  relation: ReferenceRelation;
}) {
  try {
    await db
      .delete(references)
      .where(
        and(
          eq(references.fromType, edge.from.type),
          eq(references.fromId, edge.from.id),
          eq(references.toType, edge.to.type),
          eq(references.toId, edge.to.id),
          eq(references.relation, edge.relation),
        ),
      );
    return { success: true };
  } catch (error) {
    console.error("[references] removeReferenceEdge error:", error);
    return { success: false, error: "Failed to remove reference edge" };
  }
}

/**
 * ลบ reference ทั้งหมดที่ออกจาก entity หนึ่ง (ใช้ตอน resync เนื้อหา note/chapter)
 */
export async function removeOutgoingReferences(
  from: EntityPointer,
  relation?: ReferenceRelation,
) {
  try {
    await db
      .delete(references)
      .where(
        and(
          eq(references.fromType, from.type),
          eq(references.fromId, from.id),
          relation ? eq(references.relation, relation) : undefined,
        ),
      );
    return { success: true };
  } catch (error) {
    console.error("[references] removeOutgoingReferences error:", error);
    return { success: false, error: "Failed to remove outgoing references" };
  }
}

export interface ResolvedReference {
  id: string;
  relation: string;
  createdBy: string;
  confidence: number | null;
  context: string | null;
  meta: Record<string, unknown> | null;
  entity: EntityRef | null; // อีกฝั่งของ edge (resolve ผ่าน registry)
}

// helper: แปลง reference rows → ResolvedReference[] โดย resolve entity อีกฝั่งทีเดียว
async function resolveSide(
  rows: (typeof references.$inferSelect)[],
  side: "from" | "to",
): Promise<ResolvedReference[]> {
  const pointers = rows.map((r) =>
    side === "to"
      ? { type: r.toType as EntityType, id: r.toId }
      : { type: r.fromType as EntityType, id: r.fromId },
  );
  const resolved = await resolveMany(pointers);
  return rows.map((r, i) => ({
    id: r.id,
    relation: r.relation,
    createdBy: r.createdBy,
    confidence: r.confidence,
    context: r.context,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    entity: resolved.get(`${pointers[i].type}:${pointers[i].id}`) ?? null,
  }));
}

/**
 * edge ที่ออกจาก entity นี้ (entity --(relation)--> ?)
 */
export async function getOutgoing(
  from: EntityPointer,
  relation?: ReferenceRelation,
): Promise<ResolvedReference[]> {
  const rows = await db
    .select()
    .from(references)
    .where(
      and(
        eq(references.fromType, from.type),
        eq(references.fromId, from.id),
        relation ? eq(references.relation, relation) : undefined,
      ),
    );
  return resolveSide(rows, "to");
}

/**
 * edge ที่ชี้เข้า entity นี้ (backlink: ? --(relation)--> entity)
 */
export async function getIncoming(
  to: EntityPointer,
  relation?: ReferenceRelation,
): Promise<ResolvedReference[]> {
  const rows = await db
    .select()
    .from(references)
    .where(
      and(
        eq(references.toType, to.type),
        eq(references.toId, to.id),
        relation ? eq(references.relation, relation) : undefined,
      ),
    );
  return resolveSide(rows, "from");
}

export interface ContextBundle {
  outgoing: Record<string, ResolvedReference[]>; // จัดกลุ่มตาม relation
  incoming: Record<string, ResolvedReference[]>;
}

function groupByRelation(refs: ResolvedReference[]): Record<string, ResolvedReference[]> {
  const out: Record<string, ResolvedReference[]> = {};
  for (const r of refs) {
    (out[r.relation] ??= []).push(r);
  }
  return out;
}

/**
 * รวม context ทั้งสองทิศของ entity จัดกลุ่มตาม relation
 * L4 (Context API / mention panel / AI) จะต่อยอดจากตัวนี้
 */
export async function getContextBundle(
  entity: EntityPointer,
): Promise<ContextBundle> {
  const [outgoing, incoming] = await Promise.all([
    getOutgoing(entity),
    getIncoming(entity),
  ]);
  return {
    outgoing: groupByRelation(outgoing),
    incoming: groupByRelation(incoming),
  };
}

/**
 * Rebuild ดัชนี references ของนิยาย (เรียกตอน Vector Sync)
 * delete-แล้ว-rebuild แบบ scoped: ลบเฉพาะ derived ('migration') ของเรื่องนี้
 * แล้วสร้างใหม่จาก junction → สะท้อนการลบ/เพิ่มล่าสุด (ไม่ใช่ snapshot ค้าง)
 * เก็บ edge ที่ผู้ใช้/AI สร้าง ('user'/'ai') ไว้ไม่แตะ
 */
export async function rebuildNovelReferences(novelId: string) {
  try {
    await db
      .delete(references)
      .where(and(eq(references.novelId, novelId), eq(references.createdBy, "migration")));

    const inputs = await buildDerivedReferences(novelId);

    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < inputs.length; i += BATCH) {
      const res = await addReferences(inputs.slice(i, i + BATCH));
      if (res.success) inserted += res.inserted ?? 0;
    }

    await db
      .update(novels)
      .set({ lastSyncedAt: new Date() })
      .where(eq(novels.id, novelId));

    return { success: true as const, count: inserted };
  } catch (error) {
    console.error("[references] rebuildNovelReferences error:", error);
    return { success: false as const, error: "Failed to rebuild references" };
  }
}

/**
 * สถิติ reference ของนิยาย (debug / dashboard)
 */
export async function getReferenceStats(novelId: string) {
  const rows = await db
    .select({
      relation: references.relation,
      createdBy: references.createdBy,
      count: sql<number>`count(*)::int`,
    })
    .from(references)
    .where(eq(references.novelId, novelId))
    .groupBy(references.relation, references.createdBy);
  return rows;
}
