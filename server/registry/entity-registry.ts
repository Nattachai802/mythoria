import { db } from "@/db/drizzle";
import {
  characters,
  locations,
  factions,
  powers,
  loreEntries,
  ideas,
  notes,
  chapters,
  entities,
  items,
  eras,
  timelineEvents,
  plotThreads,
} from "@/db/schema";
import { and, eq, ilike, inArray } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

/**
 * Context Fabric — L0 Entity Registry
 * ------------------------------------
 * "สมุดรายชื่อกลาง" ของทุกอย่างที่อ้างถึงได้ในนิยาย
 * แปลงทุกตารางให้พูดภาษาเดียวกัน (EntityRef) เพื่อให้ reference layer (L1),
 * mention UI, graph และ RAG ไม่ต้องรู้จักตารางต้นทาง
 *
 * docs/context-fabric-plan.md
 */

export type EntityType =
  | "character"
  | "location"
  | "lore"
  | "power"
  | "faction"
  | "item"
  | "era"
  | "plotThread"
  | "note"
  | "chapter"
  | "entity"
  | "timelineEvent"
  | "idea";

export interface EntityRef {
  type: EntityType;
  id: string;
  novelId: string;
  title: string; // ชื่อที่แสดง
  subtitle?: string; // role / คำอธิบายสั้นสำหรับ dropdown
  icon?: string;
  href: string; // ลิงก์ไปหน้าของมัน
}

type DisplayCol = "name" | "title";

interface EntityAdapter {
  // ใช้ any เพราะแต่ละตารางมี shape ต่างกัน แต่ทุกตัวมี id/novelId + (name|title)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTableWithColumns<any>;
  displayCol: DisplayCol;
  icon: string;
  // สร้าง href จาก novelId + entity id
  href: (novelId: string, id: string) => string;
  // คอลัมน์ text ที่ใช้ประกอบเนื้อหาสำหรับ embedding (RAG). เว้นว่าง = ไม่ index
  // หมายเหตุ: note/chapter เนื้อหาเป็น tiptap json ยาว — ฝั่ง python จัดการเอง
  contentCols?: string[];
}

const base = (novelId: string) => `/dashboard/project/${novelId}`;

/**
 * ทะเบียน adapter ต่อ EntityType
 * - ตารางที่มี detail route ใช้ route นั้น
 * - ตารางที่อยู่หน้ารวม (worldbuilding) ลิงก์ไปหน้านั้นพร้อม anchor #id
 */
const REGISTRY: Record<EntityType, EntityAdapter> = {
  character: {
    table: characters,
    displayCol: "name",
    icon: "user",
    href: (n, id) => `${base(n)}/characters/${id}`,
    contentCols: ["name", "role", "description", "personality", "backstory"],
  },
  location: {
    table: locations,
    displayCol: "name",
    icon: "map-pin",
    href: (n, id) => `${base(n)}/locations/${id}`,
    contentCols: ["name", "type", "description", "atmosphere", "history"],
  },
  power: {
    table: powers,
    displayCol: "name",
    icon: "zap",
    href: (n, id) => `${base(n)}/powers/${id}`,
    contentCols: ["name", "type", "description"],
  },
  note: {
    table: notes,
    displayCol: "title",
    icon: "file-text",
    href: (n, id) => `${base(n)}/note/${id}`,
  },
  chapter: {
    table: chapters,
    displayCol: "title",
    icon: "book-open",
    href: (n, id) => `${base(n)}/chapter/${id}/overview`,
  },
  timelineEvent: {
    table: timelineEvents,
    displayCol: "title",
    icon: "clapperboard",
    href: (n, id) => `${base(n)}/plot/${id}`,
    contentCols: ["title", "description", "sceneGoal", "sceneConflict", "sceneOutcome"],
  },
  idea: {
    table: ideas,
    displayCol: "title",
    icon: "lightbulb",
    href: (n, id) => `${base(n)}/idea#${id}`,
    contentCols: ["title", "category", "summary", "content"],
  },
  plotThread: {
    table: plotThreads,
    displayCol: "title",
    icon: "git-branch",
    href: (n, id) => `${base(n)}/plot#${id}`,
    contentCols: ["title", "type", "note"],
  },
  faction: {
    table: factions,
    displayCol: "name",
    icon: "flag",
    href: (n, id) => `${base(n)}/worldbuilding#faction-${id}`,
    contentCols: ["name", "type", "description"],
  },
  lore: {
    table: loreEntries,
    displayCol: "title",
    icon: "scroll",
    href: (n, id) => `${base(n)}/worldbuilding#lore-${id}`,
    contentCols: ["title", "type", "content"],
  },
  entity: {
    table: entities,
    displayCol: "name",
    icon: "skull",
    href: (n, id) => `${base(n)}/worldbuilding#entity-${id}`,
    contentCols: ["name", "type", "description", "appearance", "habitat"],
  },
  item: {
    table: items,
    displayCol: "name",
    icon: "package",
    href: (n, id) => `${base(n)}/worldbuilding#item-${id}`,
    contentCols: ["name", "type", "description", "lore"],
  },
  era: {
    table: eras,
    displayCol: "name",
    icon: "hourglass",
    href: (n, id) => `${base(n)}/worldbuilding#era-${id}`,
    contentCols: ["name", "description"],
  },
};

export const ENTITY_TYPES = Object.keys(REGISTRY) as EntityType[];

export function isEntityType(value: string): value is EntityType {
  return value in REGISTRY;
}

// แปลง row ดิบ → EntityRef
function toRef(type: EntityType, row: Record<string, unknown>): EntityRef {
  const adapter = REGISTRY[type];
  const title = (row[adapter.displayCol] as string) ?? "(ไม่มีชื่อ)";
  const novelId = row.novelId as string;
  const id = row.id as string;
  return {
    type,
    id,
    novelId,
    title,
    icon: adapter.icon,
    href: adapter.href(novelId, id),
  };
}

/**
 * แปลง entity ตัวเดียวให้เป็น EntityRef (คืน null ถ้าไม่พบ — เช่นถูกลบไปแล้ว)
 */
export async function resolve(
  type: EntityType,
  id: string,
): Promise<EntityRef | null> {
  const adapter = REGISTRY[type];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = await db.select().from(adapter.table as any).where(eq((adapter.table as any).id, id)).limit(1);
  return row ? toRef(type, row as Record<string, unknown>) : null;
}

/**
 * resolve หลายตัวพร้อมกัน จัดกลุ่มตาม type เพื่อยิง query น้อยที่สุด
 * คืน Map<`${type}:${id}`, EntityRef>
 */
export async function resolveMany(
  refs: { type: EntityType; id: string }[],
): Promise<Map<string, EntityRef>> {
  const byType = new Map<EntityType, string[]>();
  for (const r of refs) {
    if (!isEntityType(r.type)) continue;
    const arr = byType.get(r.type) ?? [];
    arr.push(r.id);
    byType.set(r.type, arr);
  }

  const result = new Map<string, EntityRef>();
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const adapter = REGISTRY[type];
      const rows = await db
        .select()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(adapter.table as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(inArray((adapter.table as any).id, ids));
      for (const row of rows as Record<string, unknown>[]) {
        const ref = toRef(type, row);
        result.set(`${type}:${ref.id}`, ref);
      }
    }),
  );
  return result;
}

/**
 * ค้นหา entity ในนิยายตามคำค้น — ใช้โดย mention dropdown (L4/Phase 5)
 * types: จำกัดชนิดที่ค้น (ไม่ระบุ = ทุกชนิด)
 */
export async function search(
  novelId: string,
  query: string,
  options?: { types?: EntityType[]; limitPerType?: number },
): Promise<EntityRef[]> {
  const types = options?.types ?? ENTITY_TYPES;
  const limit = options?.limitPerType ?? 5;
  const pattern = `%${query}%`;

  const groups = await Promise.all(
    types.map(async (type) => {
      const adapter = REGISTRY[type];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = adapter.table as any;
      const rows = await db
        .select()
        .from(t)
        .where(
          and(
            eq(t.novelId, novelId),
            query ? ilike(t[adapter.displayCol], pattern) : undefined,
          ),
        )
        .limit(limit);
      return (rows as Record<string, unknown>[]).map((row) => toRef(type, row));
    }),
  );

  return groups.flat();
}

export interface EmbeddableRecord {
  type: EntityType;
  id: string;
  novelId: string;
  title: string;
  text: string; // เนื้อหารวมสำหรับ embed
}

/**
 * เนื้อหาทุก entity ของนิยายในรูปแบบเดียว สำหรับ RAG embedding (Track C)
 * เฉพาะ type ที่มี contentCols — note/chapter (tiptap ยาว) ฝั่ง python จัดการเอง
 * identity (type+id) ตรงกับ references → search hit resolve กลับ graph ได้
 */
export async function getEmbeddableContent(
  novelId: string,
  types?: EntityType[],
): Promise<EmbeddableRecord[]> {
  const picked = (types ?? ENTITY_TYPES).filter((t) => REGISTRY[t].contentCols);

  const groups = await Promise.all(
    picked.map(async (type) => {
      const adapter = REGISTRY[type];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = adapter.table as any;
      const rows = (await db
        .select()
        .from(t)
        .where(eq(t.novelId, novelId))) as Record<string, unknown>[];

      return rows
        .map((row) => {
          const text = adapter
            .contentCols!.map((c) => row[c])
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .join(". ");
          return {
            type,
            id: row.id as string,
            novelId,
            title: (row[adapter.displayCol] as string) ?? "",
            text,
          };
        })
        .filter((r) => r.text.trim().length >= 3); // ponytail: ข้าม entity ว่างเปล่า
    }),
  );

  return groups.flat();
}
