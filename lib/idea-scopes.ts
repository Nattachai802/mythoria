/**
 * คลังโน้ตไอเดีย — คำศัพท์กลางที่ทั้ง server และหน้าจอใช้ร่วมกัน (pure module, client-safe)
 */

/** "จะใช้ที่ไหน" ของโน้ต — เก็บใน idea_vault.scopes */
export const IDEA_SCOPES = ["character", "faction", "location", "power", "worldbuilding", "plot", "scene"] as const;
export type IdeaScope = (typeof IDEA_SCOPES)[number];

export const IDEA_SCOPE_LABEL: Record<IdeaScope, string> = {
    character: "ตัวละคร",
    faction: "ฝ่าย",
    location: "สถานที่",
    power: "พลัง",
    worldbuilding: "โลก",
    plot: "พล็อต",
    scene: "ฉาก",
};

export const isIdeaScope = (v: unknown): v is IdeaScope =>
    typeof v === "string" && (IDEA_SCOPES as readonly string[]).includes(v);

/** กรองค่าที่ไม่อยู่ในชุด + ตัดซ้ำ — ใช้ทุกครั้งก่อนเขียน scopes ลง DB */
export const cleanScopes = (v: unknown): IdeaScope[] =>
    Array.isArray(v) ? [...new Set(v.filter(isIdeaScope))] : [];

/** category เดิมของตาราง ideas → scopes (general / ค่าอื่น = ยังไม่ระบุ) */
export const scopesFromCategory = (category: string | null | undefined): IdeaScope[] =>
    category === "plot" || category === "character" || category === "worldbuilding" ? [category] : [];

/** ชนิดของจริงที่โน้ตผูกได้ — ชื่อตรงกับ EntityType ใน server/registry */
export const VAULT_LINK_TARGETS = ["character", "faction", "location", "power", "lore", "timelineEvent"] as const;
export type VaultLinkTarget = (typeof VAULT_LINK_TARGETS)[number];
export const isVaultLinkTarget = (v: unknown): v is VaultLinkTarget =>
    typeof v === "string" && (VAULT_LINK_TARGETS as readonly string[]).includes(v);

export type VaultLinkRelation = "about" | "used_in";

/** ผูกกับ entity ชนิดนี้ = ถือว่ามี scope นี้ตอนแสดง (คำนวณตอนอ่าน ไม่เก็บซ้ำ) */
export const SCOPE_OF_TARGET: Partial<Record<VaultLinkTarget, IdeaScope>> = {
    character: "character",
    faction: "faction",
    location: "location",
    power: "power",
    lore: "worldbuilding",
    timelineEvent: "scene",
};

/** ข้อความยาวเกินนี้ หรือมีขึ้นบรรทัด = โหมดเอกสาร */
export const VAULT_DOC_THRESHOLD = 300;
export const isDocText = (v: string) => v.length > VAULT_DOC_THRESHOLD || v.includes("\n");

/** หัวเรื่องจากเอกสารที่วาง = บรรทัดแรกที่ไม่ว่าง ตัดที่ 120 ตัวอักษร */
export const headlineOf = (v: string) => (v.split("\n").find(l => l.trim())?.trim() ?? "").slice(0, 120);
