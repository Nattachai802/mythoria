import { pgTable, text, timestamp, boolean, integer, jsonb, index, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================
// AUTHENTICATION TABLES
// ============================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// รหัสเชิญ — Mythoria เป็นระบบปิด ต้องมีรหัสที่ยังใช้ได้จึงจะสร้างบัญชีได้
// ด่านตรวจอยู่ที่ databaseHooks.user.create.before ใน lib/auth.ts จุดเดียว
// ครอบทั้งการสมัครด้วยอีเมลและด้วย Google
export const invitations = pgTable("invitations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  note: text("note"),                                        // จดไว้ว่าแจกให้ใคร
  maxUses: integer("max_uses").notNull().default(1),          // 1 = ใช้ได้ครั้งเดียว
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),                         // null = ไม่มีวันหมดอายุ
  revokedAt: timestamp("revoked_at"),                         // ใส่วันที่เพื่อเพิกถอนทันที
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// NOVEL WRITING TABLES
// ============================================

export const novels = pgTable("novels", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  coverImage: text("cover_image"),
  genre: text("genre").notNull(), // fantasy, romance, sci-fi, mystery, thriller, horror, etc.
  status: text("status").notNull().default("draft"), // draft, in_progress, completed, published, archived
  visibility: text("visibility").notNull().default("private"), // private, public, unlisted
  wordCount: integer("word_count").notNull().default(0),
  targetWordCount: integer("target_word_count"),
  // Writing Goal & Deadline Tracker
  targetDeadline: timestamp("target_deadline"),            // วันสิ้นสุดเป้าหมาย
  timelineEpoch: timestamp("timeline_epoch"),               // วันที่จริงของ "Day 1" บนเส้นเวลาในเรื่อง (P3 Phase A) — null = ยังไม่ตั้ง แสดงเป็น Day N แทน
  dailyTargetMode: text("daily_target_mode").default("dynamic"), // dynamic | static
  dailyTargetWordCount: integer("daily_target_word_count").default(1000), // เป้าหมายคำ/วัน (โหมด static)
  lastSyncedAt: timestamp("last_synced_at"),                // ซิงค์ฐานข้อมูล AI ล่าสุด (cross-device)
  deletedAt: timestamp("deleted_at"),                       // ถังขยะ: null = ปกติ, มีค่า = ลบแล้ว รอกู้คืนได้ 7 วัน
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const chapters = pgTable("chapters", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary"),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(), // ลำดับบท - สำคัญมาก!
  content: jsonb("content").notNull(), // rich text editor content (Tiptap, Slate, etc.)
  plainText: text("plain_text"), // สำหรับการค้นหา
  wordCount: integer("word_count").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft, published
  publishedAt: timestamp("published_at"),
  deletedAt: timestamp("deleted_at"),                // ถังขยะ — ดู novels.deletedAt
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("chapters_novel_id_idx").on(table.novelId),
}));

export const characters = pgTable("characters", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role").notNull(), // protagonist, antagonist, supporting, minor
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  description: text("description"),
  appearance: text("appearance"),
  personality: text("personality"),
  backstory: text("backstory"),
  image: text("image"),
  age: text("age"),
  gender: text("gender"),
  species: text("species"),
  // Character Depth
  goals: text("goals"),
  motivation: text("motivation"),
  conflict: text("conflict"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  aliases: jsonb("aliases"), // Thai names and nicknames
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("characters_novel_id_idx").on(table.novelId),
}));

export const characterRelationships = pgTable("character_relationships", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  sourceCharacterId: text("source_character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  targetCharacterId: text("target_character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // e.g., "friend", "enemy", "family", "lover", "mentor", "student"
  description: text("description"),
  // Social Dynamics fields
  opinionLevel: integer("opinion_level").default(50), // 0=ศัตรู, 50=กลาง, 100=สนิทมาก
  sentiment: text("sentiment").default("neutral"), // "positive", "negative", "neutral", "mixed"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("relationships_novel_id_idx").on(table.novelId),
  sourceCharIdx: index("relationships_source_char_idx").on(table.sourceCharacterId),
  targetCharIdx: index("relationships_target_char_idx").on(table.targetCharacterId),
}));

// Relationship History - ติดตามการเปลี่ยนแปลงความสัมพันธ์ตาม chapter
export const relationshipHistory = pgTable("relationship_history", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  relationshipId: text("relationship_id")
    .notNull()
    .references(() => characterRelationships.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .references(() => chapters.id, { onDelete: "set null" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  opinionLevel: integer("opinion_level").notNull(),
  sentiment: text("sentiment"),
  reason: text("reason"), // เหตุผลที่เปลี่ยน เช่น "ช่วยชีวิต", "ทรยศ"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("relationship_history_novel_id_idx").on(table.novelId),
}));

// Character Life Events - เหตุการณ์สำคัญในชีวิตตัวละคร
export const characterLifeEvents = pgTable("character_life_events", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .references(() => chapters.id, { onDelete: "set null" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Event Details
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull().default("other"), // "trauma", "achievement", "loss", "discovery", "transformation", "relationship", "power", "other"
  impact: text("impact").default("neutral"), // "positive", "negative", "neutral"
  importance: integer("importance").default(5), // 1-10 scale

  // What changed (optional - for detailed tracking)
  changedTraits: jsonb("changed_traits"), // ["personality", "goals", "motivation"]

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("life_events_novel_id_idx").on(table.novelId),
  characterIdIdx: index("life_events_character_id_idx").on(table.characterId),
}));


export const locations = pgTable("locations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type"), // city, country, building, forest, mountain, etc.
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  description: text("description"),
  image: text("image"),
  parentLocationId: text("parent_location_id").references((): any => locations.id, { onDelete: "set null" }), // Self-reference for hierarchy (max 3 levels)
  // Immersive fields
  highlights: jsonb("highlights"), // จุดเด่น ["ต้นไม้ยักษ์", "น้ำตกเรืองแสง"]
  atmosphere: text("atmosphere"), // บรรยากาศ "เงียบสงบ มีหมอกบางๆ ตลอดเวลา"
  climate: text("climate"), // สภาพอากาศ "หนาวเย็น หิมะตกตลอดปี"
  landmarks: jsonb("landmarks"), // จุดสังเกต ["หอคอยโบราณ", "ซากปราสาท"]
  dangers: jsonb("dangers"), // อันตราย ["มอนสเตอร์เร่ร่อน", "หลุมพรางธรรมชาติ"]
  inhabitants: text("inhabitants"), // ผู้อาศัย "ชนเผ่าเอลฟ์และคนแคระ"
  resources: jsonb("resources"), // ทรัพยากร ["แร่หายาก", "สมุนไพร"]
  secrets: text("secrets"), // ความลับ "มีทางลับสู่โลกใต้ดิน"
  history: text("history"), // ประวัติสถานที่
  mapPosition: jsonb("map_position"), // { x: number, y: number } for map view
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("locations_novel_id_idx").on(table.novelId),
}));

// Location connections for map visualization
export const locationConnections = pgTable("location_connections", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceLocationId: text("source_location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  targetLocationId: text("target_location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  connectionType: text("connection_type").default("adjacent"), // adjacent, shortcut, path, custom
  customLabel: text("custom_label"), // user-defined label
  isBidirectional: boolean("is_bidirectional").default(true), // true = 2-way, false = 1-way
  // Travel time (user-defined)
  travelTime: integer("travel_time"), // เวลาที่ใช้เดินทาง
  travelTimeUnit: text("travel_time_unit").default("hours"), // hours, days, weeks
  travelMethod: text("travel_method").default("walk"), // walk, horse, carriage, teleport, custom
  travelNotes: text("travel_notes"), // หมายเหตุการเดินทาง (เช่น "ต้องผ่านป่าดิบ")
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("loc_conn_novel_id_idx").on(table.novelId),
  sourceLocIdx: index("loc_conn_source_loc_idx").on(table.sourceLocationId),
  targetLocIdx: index("loc_conn_target_loc_idx").on(table.targetLocationId),
}));


export const timelineEvents = pgTable("timeline_events", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  eventDate: text("event_date"), // วันที่ในโลกนิยาย (อาจเป็น string เพราะอาจไม่ใช่ปฏิทินจริง)
  orderIndex: integer("order_index").notNull(),
  relatedCharacterIds: jsonb("related_character_ids"), // array of character IDs
  relatedLocationIds: jsonb("related_location_ids"), // array of location IDs
  // Event classification
  eventType: text("event_type").default("scene"), // scene, action, dialogue, flashback, revelation, emotional, transition
  isCompleted: boolean("is_completed").default(false),
  // Scene dramatic fields (D1) — โครงฉากดราม่า
  sceneType: text("scene_type"),             // setup | action | reaction | climax | resolution — null = ฉากเก่า ถือเป็น action
  sceneTone: text("scene_tone"),             // โทนที่ตั้งใจไว้สั้นๆ (เช่น "ตึงเครียด") — ลด token ตอน AI เดา ไม่ต้องอนุมานทุกครั้ง
  sceneGoal: text("scene_goal"),             // field1 ทั่วไป — ความหมายเปลี่ยนตาม sceneType (Goal/Hook/Reaction/Ultimate Test/Aftermath)
  sceneConflict: text("scene_conflict"),     // field2 ทั่วไป — ความหมายเปลี่ยนตาม sceneType (Conflict/Context/Dilemma/Value Turn/New Normal)
  sceneOutcome: text("scene_outcome"),       // ผลลัพธ์: success | failure | ongoing | unknown
  valueShift: integer("value_shift"),        // ทิศ/ความเข้มของการเปลี่ยนค่า −5…+5 (ป้อน tension curve A2)
  povCharacterId: text("pov_character_id").references(() => characters.id, { onDelete: "set null" }), // ฉากนี้เล่าผ่านสายตาใคร (P1)
  storyTimeIndex: integer("story_time_index"), // ลำดับเวลาจริงในโลกเรื่อง (P3) — null = ยังไม่จัด; eventDate เป็นแค่ป้ายแสดง
  storyDate: integer("story_date"), // วันที่ N นับจาก novels.timelineEpoch (P3 Phase A) — ใช้คำนวณ gap/timeskip ได้
  storyDuration: integer("story_duration"), // ความยาวฉากเป็นชั่วโมง (P3 Phase A) — optional
  eraId: text("era_id").references(() => eras.id, { onDelete: "set null" }), // ยุคที่ฉากนี้เกิดขึ้น (P3 Phase A)
  // Causal chain (P2) — Therefore/But: ฉากนี้เกิดขึ้นเพราะ/ทั้งที่ฉากไหน
  causeEventId: text("cause_event_id").references((): AnyPgColumn => timelineEvents.id, { onDelete: "set null" }),
  causeKind: text("cause_kind"),   // "therefore" (ดังนั้น) | "but" (แต่ว่า) — null = "แล้วก็" (and then, จุดอ่อนพล็อต)
  causeNote: text("cause_note"),   // อธิบายเหตุ-ผลสั้นๆ
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  relatedChapterId: text("related_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  canvasData: jsonb("canvas_data"),
}, (table) => ({
  novelIdIdx: index("timeline_events_novel_id_idx").on(table.novelId),
  eraIdIdx: index("timeline_events_era_id_idx").on(table.eraId),
}));

export const notes = pgTable("notes", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("general"), // character_note, plot_note, research, idea, general
  tags: jsonb("tags"), // array of tag strings
  linkedToChapterId: text("linked_to_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  // ลำดับของตอนภายในบท — คู่กับ chapters.orderIndex จะได้ "ลำดับการอ่าน" ที่แท้จริง
  // เดิมใช้ createdAt เรียง ซึ่งเพี้ยนทันทีที่แทรกตอนย้อนหลังหรือสลับลำดับ
  orderIndex: integer("order_index").notNull().default(0),
  linkedToCharacterId: text("linked_to_character_id").references(() => characters.id, { onDelete: "set null" }),
  linkedToLocationId: text("linked_to_location_id").references(() => locations.id, { onDelete: "set null" }),
  // AI Summary
  summary: text("summary"), // AI-generated summary of note content
  // Note Status
  status: text("status").default("draft"), // draft, writing, needs_rewrite, published
  // Plot Hole Checking
  plotHoleCheckedAt: timestamp("plot_hole_checked_at"), // เวลาที่ตรวจสอบล่าสุด
  plotHoleCount: integer("plot_hole_count").default(0), // จำนวน plot holes ที่พบ
  plotHoleIssues: jsonb("plot_hole_issues"), // รายละเอียดปัญหา [{type, description}]
  // Active Plots
  activePlotIds: jsonb("active_plot_ids"), // array of marked plot/idea IDs for this note
  deletedAt: timestamp("deleted_at"), // ถังขยะ — ดู novels.deletedAt
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("notes_novel_id_idx").on(table.novelId),
}));

// Note Versions - เก็บ history ของ notes (จำกัด 3 versions ล่าสุดต่อ note)
export const noteVersions = pgTable("note_versions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),

  // Content snapshot
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  wordCount: integer("word_count").default(0),

  // Metadata
  versionNumber: integer("version_number").notNull(),
  saveType: text("save_type").notNull().default("manual"), // "manual" | "auto"

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color"), // hex color code
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("tags_novel_id_idx").on(table.novelId),
}));

export const chapterTags = pgTable("chapter_tags", {
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const factions = pgTable("factions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type"), // e.g. "Guild", "Family", "Kingdom"
  color: text("color").default("#64748b"), // Slate-500 default

  // Hierarchy - แผนก/สาขาซ้อนใต้ฝ่ายแม่ (เช่น แผนก → กปธ., 13 ตระกูล → หมวด)
  parentFactionId: text("parent_faction_id").references((): any => factions.id, { onDelete: "set null" }),

  // Story fields
  status: text("status").default("active"), // "active" | "disbanded" | "defected" | "neutral" | "allied_gov"
  alignment: text("alignment"), // "good" | "neutral" | "gray" | "evil"
  goal: text("goal"), // เป้าหมาย/จุดยืนของฝ่าย
  element: text("element"), // ธาตุ-มิติ (โลกเฉพาะเรื่อง)
  leaderId: text("leader_id").references((): any => characters.id, { onDelete: "set null" }),
  icon: text("icon"),
  linkedIdeaIds: jsonb("linked_idea_ids"), // การ์ดไอเดียที่แปะไว้กับฝ่ายนี้ — ["ideaId1", ...]
  linkedSystemIds: jsonb("linked_system_ids"), // ระบบโลก (world systems) ที่ผูกกับฝ่ายนี้ — ["systemId1", ...]
  importance: integer("importance").default(5), // 1-10
  orderIndex: integer("order_index").default(0),

  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("factions_novel_id_idx").on(table.novelId),
}));

// Faction ↔ Faction relationships — พันธมิตร/ศัตรู/ขึ้นตรง/แตกออกมา (ขนานกับ characterRelationships)
export const factionRelationships = pgTable("faction_relationships", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  sourceFactionId: text("source_faction_id")
    .notNull()
    .references(() => factions.id, { onDelete: "cascade" }),
  targetFactionId: text("target_faction_id")
    .notNull()
    .references(() => factions.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "ally" | "enemy" | "subsidiary" | "splinter" | "rival" | "neutral"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("faction_rel_novel_id_idx").on(table.novelId),
  sourceIdx: index("faction_rel_source_idx").on(table.sourceFactionId),
  targetIdx: index("faction_rel_target_idx").on(table.targetFactionId),
}));

// Faction Status Presets — user-defined statuses (global หรือ novel-specific)
export const factionStatusPresets = pgTable("faction_status_presets", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),           // slug ใช้เก็บใน factions.status เช่น "active", "ลี้ภัย"
  label: text("label").notNull(),       // ป้าย Thai ที่แสดงใน UI
  color: text("color").notNull().default("#64748b"), // hex สีจุด

  // novelId = NULL  → global preset (ใช้ได้ทุกนิยายของ user)
  // novelId = <id>  → เฉพาะนิยายนั้น
  novelId: text("novel_id").references(() => novels.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  userIdIdx: index("faction_status_presets_user_id_idx").on(table.userId),
  novelIdIdx: index("faction_status_presets_novel_id_idx").on(table.novelId),
}));

export type FactionStatusPreset = typeof factionStatusPresets.$inferSelect;
export type NewFactionStatusPreset = typeof factionStatusPresets.$inferInsert;

export const characterFactions = pgTable("character_factions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  factionId: text("faction_id")
    .notNull()
    .references(() => factions.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  role: text("role"), // e.g. "Leader", "Member"
  // Timeline support: if null, applies generally.
  startChapterId: text("start_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  endChapterId: text("end_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const chapterCharacters = pgTable("chapter_characters", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: text("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  role: text("role"), // e.g. "Main", "Support", "Cameo", "Mentioned"
  frequency: integer("frequency").default(0).notNull(), // Count of mentions in linked notes
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Note Characters - เก็บความสัมพันธ์ระหว่าง Note กับ Character ที่ user เลือกใน Cast Deck
export const noteCharacters = pgTable("note_characters", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  role: text("role"), // e.g. "Main", "Supporting", "Mentioned"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Alias Cache - เก็บ cache ของ aliases ที่ AI generate มา เพื่อไม่ต้องเรียก API ซ้ำ
export const aliasCache = pgTable("alias_cache", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  englishName: text("english_name").notNull().unique(), // ชื่อภาษาอังกฤษ (lowercase)
  aliases: jsonb("aliases").notNull(), // array ของ aliases
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Character States - สถานะตัวละคร ณ จบแต่ละ Note (AI extracted)
export const characterStates = pgTable("character_states", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Location (prioritize locationId in voting)
  locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
  locationName: text("location_name"),
  locationCoordinates: text("location_coordinates"),
  inContactWith: jsonb("in_contact_with"), // character IDs in contact

  // Vitals
  health: integer("health"), // 0-100
  energy: text("energy"), // exhausted, tired, normal, energetic, high
  status: text("status"), // alive, injured, severely_injured, unconscious, dead, escaped
  specificInjuries: jsonb("specific_injuries"), // ["injury1", "injury2"]

  // Mental State
  mood: text("mood"),
  moodIntensity: integer("mood_intensity"), // 0-100
  currentObjective: text("current_objective"),

  // Abilities & Equipment
  equipment: jsonb("equipment"), // ["item1", "item2"]
  abilitiesUsed: jsonb("abilities_used"),
  cooldowns: jsonb("cooldowns"),

  // Relationships (at this point in story)
  relationshipsDynamic: jsonb("relationships_dynamic"), // [{target, dynamic, sentiment}]

  // Notes & Metadata
  notes: text("notes"),
  aiConfidence: integer("ai_confidence"), // 0-100
  rawExtraction: jsonb("raw_extraction"),
  isManuallyEdited: boolean("is_manually_edited").default(false),
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("character_states_novel_id_idx").on(table.novelId),
}));

// State Extraction Queue - Queue สำหรับ background job
export const stateExtractionQueue = pgTable("state_extraction_queue", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  novelId: text("novel_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  retryCount: integer("retry_count").default(0).notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// Ideas - แยกจาก Notes เพื่อไม่ให้กระทบ word count
export const ideas = pgTable("ideas", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content"), // Plain text หรือ simple markdown
  summary: text("summary"), // สรุปสั้นๆ
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Playground Canvas data
  canvasX: integer("canvas_x"),
  canvasY: integer("canvas_y"),
  color: text("color").default("#3b82f6"), // Blue-500 default

  // Connections to other ideas (for flow/mind map)
  connectedIdeaIds: jsonb("connected_idea_ids"), // ["id1", "id2"]

  // Tags & Categories
  category: text("category").default("general"), // "plot", "character", "worldbuilding", "subplot", "general"
  tags: jsonb("tags"),

  // Optional links (soft links, ไม่กระทบ word count)
  linkedChapterId: text("linked_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  linkedCharacterIds: jsonb("linked_character_ids"), // สามารถลิงก์หลายตัวละคร
  linkedPowerIds: jsonb("linked_power_ids"), // ลิงก์กับ Powers
  linkedLoreIds: jsonb("linked_lore_ids"), // ลิงก์กับ Lore Entries
  linkedLocationIds: jsonb("linked_location_ids"), // ลิงก์กับ Locations
  linkedEntityIds: jsonb("linked_entity_ids"), // ลิงก์กับ Entities/Monsters

  isUsed: boolean("is_used").default(false), // Auto-set to true when placed on Playground canvas
  isArchived: boolean("is_archived").default(false),
  isDetected: boolean("is_detected").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("ideas_novel_id_idx").on(table.novelId),
}));

// Idea Connections - สำหรับเชื่อม ideas กันบน canvas
// connectionType: "related" = Red String (plot flow), "ancestor" = Motivation/Reasoning chain
export const ideaConnections = pgTable("idea_connections", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceIdeaId: text("source_idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  targetIdeaId: text("target_idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  connectionType: text("connection_type").default("related").notNull(), // "related" | "ancestor"
  label: text("label"), // optional label for the connection
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("idea_connections_novel_id_idx").on(table.novelId),
}));

// ============================================
// PLOT THREADS — Setup → Payoff / Promise Ledger
// "ปมเรื่อง": สิ่งที่ผู้เขียนหว่านไว้แล้วต้องเฉลย กันลืมว่าผูกอะไรไว้บ้าง
// ============================================
export const plotThreads = pgTable("plot_threads", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("foreshadow"), // mystery | foreshadow | chekhov | character_arc | promise
  status: text("status").notNull().default("planted"), // planted | developing | paid | abandoned
  importance: text("importance").notNull().default("minor"), // major | minor
  color: text("color").default("#f59e0b"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("plot_threads_novel_id_idx").on(table.novelId),
}));

// จุดสัมผัสของปมกับฉาก (หลายจุดต่อปม): หว่าน / ย้ำ / เฉลย
export const plotThreadBeats = pgTable("plot_thread_beats", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: text("thread_id")
    .notNull()
    .references(() => plotThreads.id, { onDelete: "cascade" }),
  eventId: text("event_id")
    .notNull()
    .references(() => timelineEvents.id, { onDelete: "cascade" }),
  // การ์ด/ไอเดียบน playground ที่ผูกปมนี้ (null = ผูกระดับฉากเฉยๆ แบบเดิม)
  canvasItemId: text("canvas_item_id"),
  role: text("role").notNull().default("seed"), // seed | reinforce | payoff
  note: text("note"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  threadIdIdx: index("plot_thread_beats_thread_id_idx").on(table.threadId),
}));

export const plotThreadRelations = relations(plotThreads, ({ one, many }) => ({
  novel: one(novels, { fields: [plotThreads.novelId], references: [novels.id] }),
  beats: many(plotThreadBeats),
}));

export const plotThreadBeatRelations = relations(plotThreadBeats, ({ one }) => ({
  thread: one(plotThreads, { fields: [plotThreadBeats.threadId], references: [plotThreads.id] }),
  event: one(timelineEvents, { fields: [plotThreadBeats.eventId], references: [timelineEvents.id] }),
}));

export type PlotThread = typeof plotThreads.$inferSelect;
export type PlotThreadBeat = typeof plotThreadBeats.$inferSelect;

// ============================================
// STORY ARC TABLES
// ============================================

export const storyArcs = pgTable("story_arcs", {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    novelId: text("novel_id").notNull().references(() => novels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    color: text("color").notNull().default("#6366f1"),
    startChapterId: text("start_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    endChapterId: text("end_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    novelIdIdx: index("story_arcs_novel_id_idx").on(table.novelId),
}))

export const storyArcRelations = relations(storyArcs, ({ one }) => ({
    novel: one(novels, { fields: [storyArcs.novelId], references: [novels.id] }),
    startChapter: one(chapters, { fields: [storyArcs.startChapterId], references: [chapters.id] }),
    endChapter: one(chapters, { fields: [storyArcs.endChapterId], references: [chapters.id] }),
}))

export type StoryArc = typeof storyArcs.$inferSelect

// ============================================
// POWER SYSTEM TABLES
// ============================================

// Powers - พลังหลัก
export const powers = pgTable("powers", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("special"), // "elemental", "physical", "mental", "support", "special"
  rarity: text("rarity").default("common"), // "common", "rare", "epic", "legendary"
  maxLevel: integer("max_level").default(10),
  icon: text("icon"), // Icon name or emoji
  color: text("color").default("#3b82f6"), // Theme color
  limitations: jsonb("limitations"), // ["ใช้ได้เฉพาะตอนกลางคืน", "ต้องมีน้ำอยู่ใกล้ๆ"]

  // ใครใช้พลังนี้ได้ — เดิมตอบได้ทางเดียวคือไล่เพิ่มแถวใน characterPowers ทีละคน
  // พลังที่ทั้งโลกใช้ได้จึงเขียนลงระบบไม่ได้เลย (ตัวประกอบไม่มีชื่อก็ไม่มีแถว)
  access: text("access").default("unique"), // universal | learnable | restricted | unique
  accessNote: text("access_note"), // เงื่อนไขของ restricted: "ต้องเกิดในตระกูลคาเงะ"
  // ระดับที่คนทั่วไปทำได้ (เฉพาะ universal/learnable) — ถ้าไม่รู้เส้นฐาน คนอ่านจะไม่รู้ว่าอะไรน่าทึ่ง
  baseline: text("baseline"),

  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("powers_novel_id_idx").on(table.novelId),
}));

// Power Levels - ระดับของพลัง (พร้อมข้อดี/ข้อเสีย)
export const powerLevels = pgTable("power_levels", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  powerId: text("power_id")
    .notNull()
    .references(() => powers.id, { onDelete: "cascade" }),
  level: integer("level").notNull(), // 1, 2, 3, ...
  name: text("name"), // optional level name (e.g., "Novice", "Master")
  description: text("description"),

  // Pros & Cons
  pros: jsonb("pros"), // ["เพิ่มความเร็ว 20%", "สามารถใช้ได้ทุกที่"]
  cons: jsonb("cons"), // ["ใช้พลังงานมาก", "ต้องพักหลังใช้"]

  // Stats (optional for game-like tracking)
  powerBoost: integer("power_boost"), // percentage or flat value
  cooldown: integer("cooldown"), // in seconds/turns
  manaCost: integer("mana_cost"),

  // Changes from previous level
  changes: jsonb("changes"), // ["เพิ่มระยะโจมตี 2 เท่า", "ลดเวลา cooldown"]

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Power Combinations - การรวมพลัง
export const powerCombinations = pgTable("power_combinations", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Source powers (those that combine)
  sourcePowerIds: jsonb("source_power_ids").notNull(), // ["power-id-1", "power-id-2"]

  // Result power
  resultPowerId: text("result_power_id")
    .notNull()
    .references(() => powers.id, { onDelete: "cascade" }),

  // Requirements
  requiredLevels: jsonb("required_levels"), // {"power-id-1": 5, "power-id-2": 3} - minimum levels needed

  description: text("description"), // How the combination works narratively
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("power_combinations_novel_id_idx").on(table.novelId),
}));

// Power Rules - กฎของระบบพลัง
// ตารางเดียวคุมทั้งกฎระดับเล่มและกฎรายพลัง — ต่างกันแค่ powerIds:
// ว่าง/null = ใช้กับทุกพลังในเรื่อง, มีรายการ = บังคับเฉพาะพลังที่ระบุ
export const powerRules = pgTable("power_rules", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  title: text("title").notNull(),        // ตัวกฎสั้น ๆ: "ใช้เวทต้องแลกด้วยอายุขัย"
  description: text("description"),      // ขยายความ/ตัวอย่าง/ข้อยกเว้น

  kind: text("kind").notNull().default("limit"),      // cost | limit | forbidden | condition
  severity: text("severity").notNull().default("hard"), // hard = ฝ่าฝืนไม่ได้, soft = ฝ่าได้แต่มีราคา

  powerIds: jsonb("power_ids"),          // string[] — ว่าง = ทั้งระบบ
  orderIndex: integer("order_index").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("power_rules_novel_id_idx").on(table.novelId),
}));

// Character Powers - ตัวละครมีพลังอะไรบ้าง
export const characterPowers = pgTable("character_powers", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  powerId: text("power_id")
    .notNull()
    .references(() => powers.id, { onDelete: "cascade" }),

  currentLevel: integer("current_level").default(1), // ระดับปัจจุบัน
  acquiredAt: text("acquired_at"), // เมื่อไหร่ได้มา (ในเรื่อง)
  acquiredMethod: text("acquired_method"), // ได้มาอย่างไร (born, trained, gifted, stolen)
  notes: text("notes"), // หมายเหตุเพิ่มเติม

  // Timeline (optional - chapter-based)
  startChapterId: text("start_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  endChapterId: text("end_chapter_id").references(() => chapters.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Character Design Elements (Moodboard/Design Board)
export const characterDesignElements = pgTable("character_design_elements", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: text("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'color', 'hairstyle', 'clothing', 'accessory', 'other'
  value: text("value").notNull(), // hex color or image URL
  name: text("name"), // e.g. "Crimson Red" or "Formal Suit"
  position: integer("position").default(0), // for ordering in the UI
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("character_design_elements_novel_id_idx").on(table.novelId),
}));

// ============================================
// WORLD BUILDING TABLES
// ============================================

// Items/Artifacts - ของวิเศษ อาวุธ ยา
export const items = pgTable("items", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("artifact"), // artifact, weapon, armor, potion, material, currency, misc
  rarity: text("rarity").default("common"), // common, uncommon, rare, epic, legendary
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Ownership
  currentOwnerId: text("current_owner_id").references(() => characters.id, { onDelete: "set null" }),
  locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),

  // Properties
  properties: jsonb("properties"), // {"durability": 100, "damage": 50}
  lore: text("lore"), // Item backstory/history
  image: text("image"),
  icon: text("icon"), // Emoji or icon name

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("items_novel_id_idx").on(table.novelId),
}));

// Eras - ยุคสมัยสำหรับ Timeline
export const eras = pgTable("eras", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // เช่น "ยุคโบราณ", "ยุคกลาง", "ปัจจุบัน"
  description: text("description"),
  color: text("color").default("#8b5cf6"),
  icon: text("icon"),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").default(0), // ลำดับของยุค (0 = oldest)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("eras_novel_id_idx").on(table.novelId),
}));

// Lore/History - ประวัติศาสตร์โลก
export const loreEntries = pgTable("lore_entries", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content"),
  type: text("type").default("event"), // event, legend, prophecy, mythology, history

  // Era-based Timeline
  eraId: text("era_id").references(() => eras.id, { onDelete: "set null" }), // ยุคที่ lore นี้เกิดขึ้น
  orderInEra: integer("order_in_era").default(0), // ลำดับใน era (0 = earliest in era)
  era: text("era"), // DEPRECATED: เก็บไว้สำหรับ migration เท่านั้น

  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Scope - world lore vs location lore
  scope: text("scope").default("world"), // "world" = lore ของโลก, "location" = lore ของสถานที่
  locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }), // ถ้า scope = location

  // Hierarchy - sub-lore
  parentLoreId: text("parent_lore_id").references((): any => loreEntries.id, { onDelete: "set null" }), // parent lore for sub-lore

  // Grouping
  groupId: text("group_id").references((): any => loreGroups.id, { onDelete: "set null" }), // lore group

  // Timeline (for horizontal ordering)
  orderIndex: integer("order_index").default(0),

  // Relations
  relatedCharacterIds: jsonb("related_character_ids"), // array of character IDs
  relatedLocationIds: jsonb("related_location_ids"), // array of location IDs
  relatedItemIds: jsonb("related_item_ids"), // array of item IDs

  // Display
  icon: text("icon"),
  color: text("color").default("#8b5cf6"), // Purple-500
  importance: integer("importance").default(5), // 1-10

  // Background Extraction Status
  extractionStatus: text("extraction_status").default("none").notNull(), // "none", "pending", "processing", "completed", "failed"
  extractionError: text("extraction_error"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("lore_entries_novel_id_idx").on(table.novelId),
  eraIdIdx: index("lore_entries_era_id_idx").on(table.eraId),
}));

// Lore Groups - กลุ่มของ Lore
export const loreGroups = pgTable("lore_groups", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"), // Indigo-500
  icon: text("icon"),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("lore_groups_novel_id_idx").on(table.novelId),
}));

// Entities - สิ่งมีชีวิต มอนสเตอร์
export const entities = pgTable("entities", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("creature"), // creature, monster, spirit, beast, humanoid, plant
  threatLevel: text("threat_level").default("harmless"), // harmless, low, medium, high, extreme, legendary
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Physical
  appearance: text("appearance"),
  abilities: jsonb("abilities"), // ["ยิงไฟ", "บินได้"]
  weaknesses: jsonb("weaknesses"), // ["น้ำ", "แสงแดด"]

  // Habitat
  habitat: text("habitat"), // forest, mountain, cave, water, sky, underground

  // Visual
  image: text("image"),
  icon: text("icon"),
  color: text("color").default("#ef4444"), // Red-500

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("entities_novel_id_idx").on(table.novelId),
}));

// Location Entities - สิ่งมีชีวิตในสถานที่
export const locationEntities = pgTable("location_entities", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  locationId: text("location_id")
    .notNull()
    .references(() => locations.id, { onDelete: "cascade" }),
  entityId: text("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "cascade" }),
  population: text("population").default("few"), // few, some, many, swarm, dominant
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// World Systems - "ระบบ/สารบบ" ทั่วไปของโลก (ยศ, ลำดับชั้น, taxonomy, องค์กร, กฎ)
// primitive กลาง: รายการ entry ที่เรียง/จัดกลุ่มได้ + attribute อิสระต่อ entry (jsonb)
// ครอบทุกโครงสร้างที่ไม่ใช่ instance เดี่ยว โดยไม่ต้องมีตารางต่อชนิด
export const worldSystems = pgTable("world_systems", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("taxonomy"), // rank | hierarchy | taxonomy | org | ruleset | process
  description: text("description"),
  ordered: boolean("ordered").notNull().default(false), // เป็นบันไดเรียงลำดับไหม
  // entries: [{ label, order, note, attrs: { [key]: string } }]
  entries: jsonb("entries").notNull().default(sql`'[]'::jsonb`),
  // attrKeys: ลำดับคอลัมน์ attribute ที่ผู้ใช้กำหนด เช่น ["EN","Threat"]
  attrKeys: jsonb("attr_keys").notNull().default(sql`'[]'::jsonb`),
  color: text("color").default("#6366f1"),
  icon: text("icon"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("world_systems_novel_id_idx").on(table.novelId),
}));

export const worldSystemRelations = relations(worldSystems, ({ one }) => ({
  novel: one(novels, { fields: [worldSystems.novelId], references: [novels.id] }),
}));

export type WorldSystem = typeof worldSystems.$inferSelect;
export interface WorldSystemEntry {
  label: string;
  order: number;
  note?: string;
  attrs: Record<string, string>;
}

// ============================================
// SCENE ELEMENT DETAILS - ใคร ทำอะไร ที่ไหน อย่างไร
// ============================================

// Scene Element Details - รายละเอียดของ character/location ใน scene
export const sceneElementDetails = pgTable("scene_element_details", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),

  // Link to timeline event (scene)
  sceneId: text("scene_id")
    .notNull()
    .references(() => timelineEvents.id, { onDelete: "cascade" }),

  // Element reference (character or location)
  elementType: text("element_type").notNull(), // "character" | "location"
  elementId: text("element_id").notNull(), // character.id or location.id

  // Canvas item reference (for linking to specific idea on canvas)
  canvasItemId: text("canvas_item_id"), // ID of the canvas item (idea) this belongs to

  // Action Details - ใคร ทำอะไร ที่ไหน อย่างไร
  action: text("action"),           // ทำอะไร: "สู้กับมอนสเตอร์", "ค้นหาสมบัติ"
  how: text("how"),                 // อย่างไร: "ใช้ดาบวิเศษ", "ร่ายเวทมนตร์"
  goal: text("goal"),               // เป้าหมาย/แรงจูงใจ: "เพื่อปกป้องหมู่บ้าน"
  outcome: text("outcome"),         // ผลลัพธ์: "success" | "failure" | "ongoing" | "unknown"
  role: text("role"),               // บทบาทในไอเดีย: "protagonist" | "antagonist" | "witness" | "victim"
  notes: text("notes"),             // หมายเหตุเพิ่มเติม
  noteKind: text("note_kind"),      // สีโน้ต (เฉพาะ elementType="idea_note"): เก็บ hex สี — null = ทั่วไป
  noteOrder: integer("note_order").default(0), // ลำดับการแสดงโน้ต (เฉพาะ elementType="idea_note") — ใช้ตอนลากสลับตำแหน่ง

  // Novel reference for easy querying
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("scene_element_details_novel_id_idx").on(table.novelId),
}));

// ============================================
// AI ANALYSIS TABLES
// ============================================

// Character Analysis Queue - คิวสำหรับ AI วิเคราะห์ตัวละคร (ติดตามว่า chapter ไหนวิเคราะห์แล้ว)
export const characterAnalysisQueue = pgTable("character_analysis_queue", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  chapterId: text("chapter_id")
    .references(() => chapters.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .references(() => characters.id, { onDelete: "cascade" }),

  // Analysis Type
  analysisType: text("analysis_type").notNull().default("all"), // "relationships", "life_events", "states", "all"

  // Status
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  priority: integer("priority").default(5), // 1=highest, 10=lowest

  // Metadata
  error: text("error"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("char_analysis_queue_novel_id_idx").on(table.novelId),
  chapterIdIdx: index("char_analysis_queue_chapter_id_idx").on(table.chapterId),
}));

// AI Suggestions - AI แนะนำข้อมูลที่รอ user review
export const aiSuggestions = pgTable("ai_suggestions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  characterId: text("character_id")
    .references(() => characters.id, { onDelete: "cascade" }),

  // What AI is suggesting
  suggestionType: text("suggestion_type").notNull(), // "opinion_level", "life_event", "relationship_history", "faction_change"
  targetTable: text("target_table").notNull(), // "character_relationships", "character_life_events", etc.
  targetId: text("target_id"), // Existing record ID (for updates) or null (for new)

  // AI's suggestion
  suggestedData: jsonb("suggested_data").notNull(),
  confidence: integer("confidence"), // 0-100
  reasoning: text("reasoning"), // AI's explanation

  // Source context
  sourceChapterId: text("source_chapter_id")
    .references(() => chapters.id, { onDelete: "set null" }),
  sourceExcerpt: text("source_excerpt"), // ข้อความที่ AI ใช้ตัดสินใจ

  // Status
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, modified
  userModifiedData: jsonb("user_modified_data"), // ถ้า user แก้ไข
  reviewedAt: timestamp("reviewed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("ai_suggestions_novel_id_idx").on(table.novelId),
}));

export const driveSettings = pgTable("drive_settings", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .unique()
    .references(() => novels.id, { onDelete: "cascade" }),
  rootFolderId: text("root_folder_id"),
  worldbuildingSpreadsheetId: text("worldbuilding_spreadsheet_id"),
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
    .$onUpdate(() => new Date()).notNull(),
})

export const driveSync = pgTable("drive_sync", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  googleDocId: text("google_doc_id").notNull(),
  googleDriveFolderId: text("drive_folder_id"),
  lastSyncedAt: timestamp("last_synced_at"),

  baseContent: jsonb("base_content"),
  formatSnapshot: jsonb("format_snapshot"),

  lastLocalModifiedAt: timestamp("last_local_modified_at"),
  lastRemoteModifiedAt: timestamp("last_remote_modified_at"),
  syncStatus: text("sync_status").default("synced"),
  conflictData: jsonb("conflict_data"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("drive_sync_novel_id_idx").on(table.novelId),
}));

// ============================================
// GOOGLE DRIVE OAUTH CREDENTIALS
// แยกออกจาก better-auth เพื่อรองรับ Google account ที่ต่าง email กับ login
// ============================================

export const driveCredentials = pgTable("drive_credentials", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .unique() // 1 user = 1 drive account เท่านั้น
    .references(() => user.id, { onDelete: "cascade" }),
  googleEmail: text("google_email").notNull(), // แสดงให้ user รู้ว่า connect ด้วย account อะไร
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Note Stylometry Analysis Results (For individual scenes/episodes)
export const noteStylometry = pgTable("note_stylometry", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Detailed Metrics (JSONB)
  pacingAndMood: jsonb("pacing_and_mood"),
  authorNarrationStyle: jsonb("author_narration_style"),
  characterDialogueVibes: jsonb("character_dialogue_vibes"),
  lexicalRichness: jsonb("lexical_richness"),
  chapterAnatomy: jsonb("chapter_anatomy"),
  fingerprintAnalysis: jsonb("fingerprint_analysis"), // { similarity_score, status, alerts, is_anomaly }

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("note_stylometry_novel_id_idx").on(table.novelId),
}));

/**
 * ผู้อ่านจำลองรายตอน — คะแนนการตอบสนอง ไม่ใช่ร้อยแก้ว
 *
 * แทน aiChapterReviews (persona 5 ตัวที่คืนคำชมลอย ๆ) ด้วยคะแนนที่เทียบข้ามตอนได้
 * suspense/curiosity/surprise มาจากกรอบ Revelation ของ NarraBench ซึ่งเป็น
 * คุณสมบัติที่ประเมินได้ก็ต่อเมื่อผู้อ่าน "ยังไม่รู้ตอนจบ" — contextPosition
 * บันทึกไว้ว่าตอนนั้นผู้อ่านเห็นกี่ตอนก่อนหน้า เพื่อให้ตรวจย้อนได้ว่าไม่มีสปอยล์
 *
 * model/promptVersion จำเป็นตั้งแต่แถวแรก: คะแนนเทียบกันได้เฉพาะภายในคู่เดียวกัน
 * ถ้าไม่เก็บ วันที่แก้ prompt กราฟจะผสมสเกลที่เทียบกันไม่ได้โดยไม่มีใครสังเกต
 */
export const chapterReaderResponse = pgTable("chapter_reader_response", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .unique()
    .references(() => notes.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  suspense: integer("suspense").notNull(),
  suspenseReason: text("suspense_reason").notNull(),
  curiosity: integer("curiosity").notNull(),
  curiosityReason: text("curiosity_reason").notNull(),
  surprise: integer("surprise").notNull(),
  surpriseReason: text("surprise_reason").notNull(),

  // clear | muddy | unclear
  motivationClarity: text("motivation_clarity"),
  motivationReason: text("motivation_reason"),
  causality: text("causality"),
  causalityReason: text("causality_reason"),
  stakes: text("stakes"),
  stakesReason: text("stakes_reason"),

  raw: jsonb("raw"), // output เต็มจากโมเดล เผื่อเพิ่มมิติทีหลังโดยไม่ต้อง migrate
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  contextPosition: integer("context_position").notNull(), // เห็นกี่ตอนก่อนหน้า
  truncated: boolean("truncated").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("chapter_reader_response_novel_id_idx").on(table.novelId),
}));

// AI Reviews Table — เลิกใช้แล้ว แทนด้วย chapterReaderResponse ข้างบน
// เว้นไว้หนึ่งรอบ release ก่อนค่อย drop
export const aiChapterReviews = pgTable("ai_chapter_reviews", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  persona: integer("persona").notNull(),
  personaName: text("persona_name").notNull(), // e.g. "🥰 แฟนคลับเบอร์หนึ่ง"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdIdx: index("ai_chapter_reviews_novel_id_idx").on(table.novelId),
}));

// ============================================
// STYLOMETRY ANALYTICS MAPPING
// ============================================

export const chapterStylometry = pgTable("chapter_stylometry", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: text("chapter_id")
    .notNull()
    .unique()
    .references(() => chapters.id, { onDelete: "cascade" }),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // Data retrieved from Python API
  pacingAndMood: jsonb("pacing_and_mood"),
  authorNarrationStyle: jsonb("author_narration_style"),
  characterDialogueVibes: jsonb("character_dialogue_vibes"),
  lexicalRichness: jsonb("lexical_richness"),
  chapterAnatomy: jsonb("chapter_anatomy"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("chapter_stylometry_novel_id_idx").on(table.novelId),
}));

export const noteAuditIssues = pgTable("note_audit_issues", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),

  level: text("level").notNull(), // 'developmental' | 'line' | 'proofreading'
  category: text("category").notNull(), // 'plot_hole', 'character_state', 'tell_vs_show', 'spelling', 'redundancy'

  startIndex: integer("start_index").notNull(),
  endIndex: integer("end_index").notNull(),

  flaggedText: text("flagged_text").notNull(),
  issueDescription: text("issue_description").notNull(),
  suggestedText: text("suggested_text"),
  suggestionNotes: text("suggestion_notes"),

  status: text("status").default("unresolved").notNull(), // 'unresolved' | 'resolved'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("note_audit_issues_novel_id_idx").on(table.novelId),
}));

export const noteAuditIssuesRelations = relations(noteAuditIssues, ({ one }) => ({
  novel: one(novels, {
    fields: [noteAuditIssues.novelId],
    references: [novels.id],
  }),
  note: one(notes, {
    fields: [noteAuditIssues.noteId],
    references: [notes.id],
  }),
}));

// ── ตัววิเคราะห์พล็อต (docs/plot-analysis-plan.md ข้อ 1.6) ──
// ธงคำนวณสดทุกครั้ง — ตารางนี้มีไว้จำ verdict ของผู้เขียนเท่านั้น
// จับคู่กับธงด้วย (novelId, checkId, subjectRef) ปมที่ถูกปัดตกแล้วต้องไม่โผล่ซ้ำ
export const plotFindings = pgTable("plot_findings", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  sceneId: text("scene_id").references(() => timelineEvents.id, { onDelete: "cascade" }),

  checkId: text("check_id").notNull(), // 'threads_unpaid' | 'single_lane' | ...
  subjectRef: text("subject_ref").notNull(), // รหัสการ์ด/ปม/ชื่อ ที่ธงนี้ชี้ถึง
  evidence: jsonb("evidence").notNull(), // ตัวเลขและรายการที่ใช้สร้างข้อความ

  verdict: text("verdict"), // null | 'real' | 'not_real' | 'irrelevant'
  formatVersion: text("format_version").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => ({
  novelIdIdx: index("plot_findings_novel_id_idx").on(table.novelId),
  // หนึ่ง verdict ต่อธงหนึ่งอัน — upsert ด้วยคีย์นี้
  subjectUnique: uniqueIndex("plot_findings_check_subject_idx").on(
    table.novelId, table.checkId, table.subjectRef),
}));

export const plotFindingsRelations = relations(plotFindings, ({ one }) => ({
  novel: one(novels, {
    fields: [plotFindings.novelId],
    references: [novels.id],
  }),
  scene: one(timelineEvents, {
    fields: [plotFindings.sceneId],
    references: [timelineEvents.id],
  }),
}));

/**
 * สรุปเนื้อหาจากโครงสร้างบนกระดานพล็อต (cast/threads/beats) — คนละตารางกับ plot_findings
 * เพราะนั่นออกแบบมาสำหรับ "ธงที่ต้องยืนยัน" (มี verdict) recap เป็นสรุปข้อเท็จจริงล้วน ๆ
 * subjectId คือ sceneId หรือ chapterId แล้วแต่ scope — ไม่ผูก FK ตายตัวเพราะชี้ได้สองตาราง
 */
export const plotRecaps = pgTable("plot_recaps", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id").notNull().references(() => novels.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // 'scene' | 'chapter'
  subjectId: text("subject_id").notNull(), // sceneId หรือ chapterId ตาม scope
  content: text("content").notNull(), // ย่อหน้าสรุป
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputHash: text("input_hash").notNull(), // เทียบก่อนยิงซ้ำ (เหมือน plot_findings.evidence.inputHash)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  novelIdIdx: index("plot_recaps_novel_id_idx").on(table.novelId),
  subjectUnique: uniqueIndex("plot_recaps_scope_subject_idx").on(table.novelId, table.scope, table.subjectId),
}));

// ============================================
// RELATIONS
// ============================================

export const userRelations = relations(user, ({ many }) => ({
  novels: many(novels),
}));

export const novelRelations = relations(novels, ({ one, many }) => ({
  user: one(user, {
    fields: [novels.userId],
    references: [user.id],
  }),
  chapters: many(chapters),
  characters: many(characters),
  locations: many(locations),
  timelineEvents: many(timelineEvents),
  notes: many(notes),
  ideas: many(ideas),
  tags: many(tags),
  factions: many(factions),
}));

export const chapterRelations = relations(chapters, ({ one, many }) => ({
  novel: one(novels, {
    fields: [chapters.novelId],
    references: [novels.id],
  }),
  chapterTags: many(chapterTags),
  notes: many(notes),
  characters: many(chapterCharacters),
  chapterStylometry: one(chapterStylometry, {
    fields: [chapters.id],
    references: [chapterStylometry.chapterId],
  }),
}));

export const chapterStylometryRelations = relations(chapterStylometry, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterStylometry.chapterId],
    references: [chapters.id],
  }),
  novel: one(novels, {
    fields: [chapterStylometry.novelId],
    references: [novels.id],
  }),
}));

export const characterRelations = relations(characters, ({ one, many }) => ({
  novel: one(novels, {
    fields: [characters.novelId],
    references: [novels.id],
  }),
  notes: many(notes),
  sourceRelationships: many(characterRelationships, { relationName: "source" }),
  targetRelationships: many(characterRelationships, { relationName: "target" }),
  factions: many(characterFactions),
  chapters: many(chapterCharacters),
  designElements: many(characterDesignElements),
}));

export const characterDesignElementRelations = relations(characterDesignElements, ({ one }) => ({
  character: one(characters, {
    fields: [characterDesignElements.characterId],
    references: [characters.id],
  }),
  novel: one(novels, {
    fields: [characterDesignElements.novelId],
    references: [novels.id],
  }),
}));

export const locationRelations = relations(locations, ({ one, many }) => ({
  novel: one(novels, {
    fields: [locations.novelId],
    references: [novels.id],
  }),
  parentLocation: one(locations, {
    fields: [locations.parentLocationId],
    references: [locations.id],
    relationName: "locationHierarchy",
  }),
  childLocations: many(locations, {
    relationName: "locationHierarchy",
  }),
  notes: many(notes),
  outgoingConnections: many(locationConnections, { relationName: "source" }),
  incomingConnections: many(locationConnections, { relationName: "target" }),
}));

export const locationConnectionRelations = relations(locationConnections, ({ one }) => ({
  sourceLocation: one(locations, {
    fields: [locationConnections.sourceLocationId],
    references: [locations.id],
    relationName: "source",
  }),
  targetLocation: one(locations, {
    fields: [locationConnections.targetLocationId],
    references: [locations.id],
    relationName: "target",
  }),
  novel: one(novels, {
    fields: [locationConnections.novelId],
    references: [novels.id],
  }),
}));

export const timelineEventRelations = relations(timelineEvents, ({ one, many }) => ({
  novel: one(novels, {
    fields: [timelineEvents.novelId],
    references: [novels.id],
  }),
  elementDetails: many(sceneElementDetails),
}));

export const sceneElementDetailsRelations = relations(sceneElementDetails, ({ one }) => ({
  scene: one(timelineEvents, {
    fields: [sceneElementDetails.sceneId],
    references: [timelineEvents.id],
  }),
  novel: one(novels, {
    fields: [sceneElementDetails.novelId],
    references: [novels.id],
  }),
}));

export const noteRelations = relations(notes, ({ one, many }) => ({
  novel: one(novels, {
    fields: [notes.novelId],
    references: [novels.id],
  }),
  linkedChapter: one(chapters, {
    fields: [notes.linkedToChapterId],
    references: [chapters.id],
  }),
  linkedCharacter: one(characters, {
    fields: [notes.linkedToCharacterId],
    references: [characters.id],
  }),
  linkedLocation: one(locations, {
    fields: [notes.linkedToLocationId],
    references: [locations.id],
  }),
  characters: many(noteCharacters),
  aiReviews: many(aiChapterReviews),
  auditIssues: many(noteAuditIssues),
}));

export const tagRelations = relations(tags, ({ one, many }) => ({
  novel: one(novels, {
    fields: [tags.novelId],
    references: [novels.id],
  }),
  chapterTags: many(chapterTags),
}));

export const chapterTagRelations = relations(chapterTags, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterTags.chapterId],
    references: [chapters.id],
  }),
  tag: one(tags, {
    fields: [chapterTags.tagId],
    references: [tags.id],
  }),
}));

export const characterRelationshipRelations = relations(characterRelationships, ({ one, many }) => ({
  novel: one(novels, {
    fields: [characterRelationships.novelId],
    references: [novels.id],
  }),
  sourceCharacter: one(characters, {
    fields: [characterRelationships.sourceCharacterId],
    references: [characters.id],
    relationName: "source",
  }),
  targetCharacter: one(characters, {
    fields: [characterRelationships.targetCharacterId],
    references: [characters.id],
    relationName: "target",
  }),
  history: many(relationshipHistory),
}));

export const relationshipHistoryRelations = relations(relationshipHistory, ({ one }) => ({
  relationship: one(characterRelationships, {
    fields: [relationshipHistory.relationshipId],
    references: [characterRelationships.id],
  }),
  chapter: one(chapters, {
    fields: [relationshipHistory.chapterId],
    references: [chapters.id],
  }),
  novel: one(novels, {
    fields: [relationshipHistory.novelId],
    references: [novels.id],
  }),
}));

export const characterLifeEventRelations = relations(characterLifeEvents, ({ one }) => ({
  character: one(characters, {
    fields: [characterLifeEvents.characterId],
    references: [characters.id],
  }),
  chapter: one(chapters, {
    fields: [characterLifeEvents.chapterId],
    references: [chapters.id],
  }),
  novel: one(novels, {
    fields: [characterLifeEvents.novelId],
    references: [novels.id],
  }),
}));

export const factionRelations = relations(factions, ({ one, many }) => ({
  novel: one(novels, {
    fields: [factions.novelId],
    references: [novels.id],
  }),
  members: many(characterFactions),
  parent: one(factions, {
    fields: [factions.parentFactionId],
    references: [factions.id],
    relationName: "faction_hierarchy",
  }),
  children: many(factions, { relationName: "faction_hierarchy" }),
  leader: one(characters, {
    fields: [factions.leaderId],
    references: [characters.id],
  }),
}));

export const factionRelationshipRelations = relations(factionRelationships, ({ one }) => ({
  novel: one(novels, {
    fields: [factionRelationships.novelId],
    references: [novels.id],
  }),
  sourceFaction: one(factions, {
    fields: [factionRelationships.sourceFactionId],
    references: [factions.id],
    relationName: "faction_rel_source",
  }),
  targetFaction: one(factions, {
    fields: [factionRelationships.targetFactionId],
    references: [factions.id],
    relationName: "faction_rel_target",
  }),
}));

export const characterFactionRelations = relations(characterFactions, ({ one }) => ({
  faction: one(factions, {
    fields: [characterFactions.factionId],
    references: [factions.id],
  }),
  character: one(characters, {
    fields: [characterFactions.characterId],
    references: [characters.id],
  }),
  startChapter: one(chapters, {
    fields: [characterFactions.startChapterId],
    references: [chapters.id],
  }),
  endChapter: one(chapters, {
    fields: [characterFactions.endChapterId],
    references: [chapters.id],
  }),
}));

export const chapterCharacterRelations = relations(chapterCharacters, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterCharacters.chapterId],
    references: [chapters.id],
  }),
  character: one(characters, {
    fields: [chapterCharacters.characterId],
    references: [characters.id],
  }),
}));

export const noteCharacterRelations = relations(noteCharacters, ({ one }) => ({
  note: one(notes, {
    fields: [noteCharacters.noteId],
    references: [notes.id],
  }),
  character: one(characters, {
    fields: [noteCharacters.characterId],
    references: [characters.id],
  }),
}));

export const characterStateRelations = relations(characterStates, ({ one }) => ({
  note: one(notes, {
    fields: [characterStates.noteId],
    references: [notes.id],
  }),
  character: one(characters, {
    fields: [characterStates.characterId],
    references: [characters.id],
  }),
  novel: one(novels, {
    fields: [characterStates.novelId],
    references: [novels.id],
  }),
  location: one(locations, {
    fields: [characterStates.locationId],
    references: [locations.id],
  }),
}));

export const stateExtractionQueueRelations = relations(stateExtractionQueue, ({ one }) => ({
  note: one(notes, {
    fields: [stateExtractionQueue.noteId],
    references: [notes.id],
  }),
}));

export const ideaRelations = relations(ideas, ({ one }) => ({
  novel: one(novels, {
    fields: [ideas.novelId],
    references: [novels.id],
  }),
  linkedChapter: one(chapters, {
    fields: [ideas.linkedChapterId],
    references: [chapters.id],
  }),
}));

export const ideaConnectionRelations = relations(ideaConnections, ({ one }) => ({
  sourceIdea: one(ideas, {
    fields: [ideaConnections.sourceIdeaId],
    references: [ideas.id],
    relationName: "source",
  }),
  targetIdea: one(ideas, {
    fields: [ideaConnections.targetIdeaId],
    references: [ideas.id],
    relationName: "target",
  }),
  novel: one(novels, {
    fields: [ideaConnections.novelId],
    references: [novels.id],
  }),
}));

// Power Relations
export const powerRelations = relations(powers, ({ one, many }) => ({
  novel: one(novels, {
    fields: [powers.novelId],
    references: [novels.id],
  }),
  levels: many(powerLevels),
  characterPowers: many(characterPowers),
}));

export const powerLevelRelations = relations(powerLevels, ({ one }) => ({
  power: one(powers, {
    fields: [powerLevels.powerId],
    references: [powers.id],
  }),
}));

export const powerRuleRelations = relations(powerRules, ({ one }) => ({
  novel: one(novels, {
    fields: [powerRules.novelId],
    references: [novels.id],
  }),
}));

export const powerCombinationRelations = relations(powerCombinations, ({ one }) => ({
  novel: one(novels, {
    fields: [powerCombinations.novelId],
    references: [novels.id],
  }),
  resultPower: one(powers, {
    fields: [powerCombinations.resultPowerId],
    references: [powers.id],
  }),
}));

export const characterPowerRelations = relations(characterPowers, ({ one }) => ({
  character: one(characters, {
    fields: [characterPowers.characterId],
    references: [characters.id],
  }),
  power: one(powers, {
    fields: [characterPowers.powerId],
    references: [powers.id],
  }),
  startChapter: one(chapters, {
    fields: [characterPowers.startChapterId],
    references: [chapters.id],
  }),
  endChapter: one(chapters, {
    fields: [characterPowers.endChapterId],
    references: [chapters.id],
  }),
}));

// AI Analysis Relations
export const characterAnalysisQueueRelations = relations(characterAnalysisQueue, ({ one }) => ({
  novel: one(novels, {
    fields: [characterAnalysisQueue.novelId],
    references: [novels.id],
  }),
  chapter: one(chapters, {
    fields: [characterAnalysisQueue.chapterId],
    references: [chapters.id],
  }),
  character: one(characters, {
    fields: [characterAnalysisQueue.characterId],
    references: [characters.id],
  }),
}));

export const aiSuggestionRelations = relations(aiSuggestions, ({ one }) => ({
  novel: one(novels, {
    fields: [aiSuggestions.novelId],
    references: [novels.id],
  }),
  character: one(characters, {
    fields: [aiSuggestions.characterId],
    references: [characters.id],
  }),
  sourceChapter: one(chapters, {
    fields: [aiSuggestions.sourceChapterId],
    references: [chapters.id],
  }),
}));

export const aiChapterReviewRelations = relations(aiChapterReviews, ({ one }) => ({
  note: one(notes, {
    fields: [aiChapterReviews.noteId],
    references: [notes.id],
  }),
  novel: one(novels, {
    fields: [aiChapterReviews.novelId],
    references: [novels.id],
  }),
}));

// World Building Relations
export const itemRelations = relations(items, ({ one }) => ({
  novel: one(novels, {
    fields: [items.novelId],
    references: [novels.id],
  }),
  owner: one(characters, {
    fields: [items.currentOwnerId],
    references: [characters.id],
  }),
  location: one(locations, {
    fields: [items.locationId],
    references: [locations.id],
  }),
}));

export const loreEntryRelations = relations(loreEntries, ({ one, many }) => ({
  novel: one(novels, {
    fields: [loreEntries.novelId],
    references: [novels.id],
  }),
  location: one(locations, {
    fields: [loreEntries.locationId],
    references: [locations.id],
  }),
  era: one(eras, {
    fields: [loreEntries.eraId],
    references: [eras.id],
  }),
  parentLore: one(loreEntries, {
    fields: [loreEntries.parentLoreId],
    references: [loreEntries.id],
    relationName: "loreHierarchy",
  }),
  childLores: many(loreEntries, {
    relationName: "loreHierarchy",
  }),
  group: one(loreGroups, {
    fields: [loreEntries.groupId],
    references: [loreGroups.id],
  }),
}));

export const eraRelations = relations(eras, ({ one, many }) => ({
  novel: one(novels, {
    fields: [eras.novelId],
    references: [novels.id],
  }),
  loreEntries: many(loreEntries),
}));

export const loreGroupRelations = relations(loreGroups, ({ one, many }) => ({
  novel: one(novels, {
    fields: [loreGroups.novelId],
    references: [novels.id],
  }),
  loreEntries: many(loreEntries),
}));

export const entityRelations = relations(entities, ({ one, many }) => ({
  novel: one(novels, {
    fields: [entities.novelId],
    references: [novels.id],
  }),
  locations: many(locationEntities),
}));

export const locationEntityRelations = relations(locationEntities, ({ one }) => ({
  location: one(locations, {
    fields: [locationEntities.locationId],
    references: [locations.id],
  }),
  entity: one(entities, {
    fields: [locationEntities.entityId],
    references: [entities.id],
  }),
}));

// ============================================
// CONTEXT FABRIC — Universal Reference Layer (L1)
// ชั้นเชื่อมกลางที่ทุก module โยงหากันได้อิสระ
// docs/context-fabric-plan.md
// ============================================
export const references = pgTable("references", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),

  // edge: from --(relation)--> to. type = EntityType (ดู server/registry)
  fromType: text("from_type").notNull(),
  fromId: text("from_id").notNull(),
  toType: text("to_type").notNull(),
  toId: text("to_id").notNull(),

  relation: text("relation").notNull(), // mentions | features | member_of | wields | advances | ... (controlled vocab)
  context: text("context"), // ข้อความรอบ mention / คำอธิบายสั้น
  sourceSpan: jsonb("source_span"), // {start,end} ตำแหน่งใน rich text (ไว้ลบ ref เมื่อลบข้อความ)
  meta: jsonb("meta"), // attribute ของ junction เดิม (role, level, travelTime...) — nullable

  createdBy: text("created_by").notNull().default("user"), // user | ai | migration
  confidence: integer("confidence"), // null=manual, 0-100 สำหรับ ai (เก็บเป็น int กัน float drift)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fromIdx: index("ref_from_idx").on(table.fromType, table.fromId),
  toIdx: index("ref_to_idx").on(table.toType, table.toId),
  novelIdx: index("ref_novel_idx").on(table.novelId),
  uniqueEdge: uniqueIndex("ref_unique_edge").on(
    table.fromType,
    table.fromId,
    table.toType,
    table.toId,
    table.relation,
  ),
}));

export const referencesRelations = relations(references, ({ one }) => ({
  novel: one(novels, {
    fields: [references.novelId],
    references: [novels.id],
  }),
}));

export type Reference = typeof references.$inferSelect;
export type InsertReference = typeof references.$inferInsert;

// ============================================
// LIBRARIAN — บรรณารักษ์ถาม-ตอบ (Graph RAG chat thread)
// v1: เธรดเดียวต่อนิยาย · manual/opt-in · เก็บประวัติให้ผู้ใช้ย้อนดูได้
// ============================================
export const librarianMessages = pgTable("librarian_messages", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  sources: jsonb("sources"), // LibrarianSource[] — เฉพาะข้อความ assistant
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  novelIdx: index("librarian_msg_novel_idx").on(table.novelId),
}));

export const librarianMessagesRelations = relations(librarianMessages, ({ one }) => ({
  novel: one(novels, {
    fields: [librarianMessages.novelId],
    references: [novels.id],
  }),
}));

export type LibrarianMessage = typeof librarianMessages.$inferSelect;
export type InsertLibrarianMessage = typeof librarianMessages.$inferInsert;

// ============================================
// AI CONTROL CENTER — ศูนย์ควบคุมระบบ AI ทั้งหมด
// gateway ใน lib/ai-gateway.ts อ่านสองตารางนี้ก่อนยิง LLM ทุกครั้ง
// (ai_features: แถวไม่ต้องมีครบ — ไม่มีแถว = ใช้ default จาก registry เปิด/ไม่จำกัด)
// ============================================

/** toggle เปิด/ปิด + quota รายฟีเจอร์ — admin แก้ผ่านหน้า /dashboard/ai-control */
export const aiFeatures = pgTable("ai_features", {
  key: text("key").primaryKey(), // feature key จาก AI_FEATURES registry เช่น "librarian"
  enabled: boolean("enabled").notNull().default(true),
  dailyLimitPerUser: integer("daily_limit_per_user"), // null = ไม่จำกัด
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** log ทุก run ของ AI (success/error/blocked) — ไว้ดู usage, token, latency, ตัด quota */
export const aiUsageLog = pgTable("ai_usage_log", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  novelId: text("novel_id").references(() => novels.id, { onDelete: "set null" }),
  feature: text("feature").notNull(), // key จาก AI_FEATURES registry
  provider: text("provider").notNull(), // groq | typhoon | gemini | openrouter | python
  model: text("model").notNull(),
  status: text("status").notNull(), // success | error | blocked
  promptTokens: integer("prompt_tokens").default(0).notNull(),
  completionTokens: integer("completion_tokens").default(0).notNull(),
  latencyMs: integer("latency_ms"),
  errorDetail: text("error_detail"), // ตัดสั้นๆ — อย่าเก็บ prompt/เนื้อหาผู้ใช้
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userDayIdx: index("ai_usage_user_day_idx").on(table.userId, table.createdAt),
  featureIdx: index("ai_usage_feature_idx").on(table.feature, table.createdAt),
}));

/** heartbeat ต่อ (ผู้ใช้, ฟีเจอร์) — "กำลังทำงานอยู่ไหม" ไม่ใช่ log ประวัติ (นั่นคือ ai_usage_log)
 *  แถวเดียวต่อ (userId, feature) ถูก upsert ทับซ้ำเรื่อยๆ — "active" ตัดสินตอนอ่านด้วย lastSeenAt
 *  สดพอไหม (ACTIVE_STALE_MS ใน lib/ai-gateway.ts) ไม่ต้องมี job ลบทิ้ง */
export const aiActiveRuns = pgTable("ai_active_runs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  novelId: text("novel_id").references(() => novels.id, { onDelete: "set null" }),
  feature: text("feature").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(), // รีเซ็ตเมื่อรอบเก่า stale ไปแล้ว
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => ({
  userFeatureUnique: uniqueIndex("ai_active_runs_user_feature_idx").on(table.userId, table.feature),
}));

export const aiFeaturesRelations = relations(aiFeatures, () => ({}));

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  user: one(user, { fields: [aiUsageLog.userId], references: [user.id] }),
  novel: one(novels, { fields: [aiUsageLog.novelId], references: [novels.id] }),
}));

export const aiActiveRunsRelations = relations(aiActiveRuns, ({ one }) => ({
  user: one(user, { fields: [aiActiveRuns.userId], references: [user.id] }),
  novel: one(novels, { fields: [aiActiveRuns.novelId], references: [novels.id] }),
}));

export type AiFeature = typeof aiFeatures.$inferSelect;
export type InsertAiFeature = typeof aiFeatures.$inferInsert;
export type AiUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLog.$inferInsert;
export type AiActiveRun = typeof aiActiveRuns.$inferSelect;
export type InsertAiActiveRun = typeof aiActiveRuns.$inferInsert;

// ============================================
// TONE PRESETS — user-defined scene tone labels
// ============================================
export const tonePresets = pgTable("tone_presets", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  userIdIdx: index("tone_presets_user_id_idx").on(table.userId),
}));

export type TonePreset = typeof tonePresets.$inferSelect;

export type User = typeof user.$inferSelect;
export type Novel = typeof novels.$inferSelect;
// (chapterStylometry table and relations moved earlier to avoid undefined references)

export type Chapter = typeof chapters.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type LocationConnection = typeof locationConnections.$inferSelect;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Faction = typeof factions.$inferSelect;
export type FactionRelationship = typeof factionRelationships.$inferSelect;
export type CharacterFaction = typeof characterFactions.$inferSelect;
export type NoteCharacter = typeof noteCharacters.$inferSelect;
export type CharacterState = typeof characterStates.$inferSelect;
export type StateExtractionQueue = typeof stateExtractionQueue.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type IdeaConnection = typeof ideaConnections.$inferSelect;
export type SceneElementDetails = typeof sceneElementDetails.$inferSelect;
export type AIChapterReview = typeof aiChapterReviews.$inferSelect;

export type InsertNovel = typeof novels.$inferInsert;
export type InsertChapter = typeof chapters.$inferInsert;
export type InsertCharacter = typeof characters.$inferInsert;
export type InsertLocation = typeof locations.$inferInsert;
export type InsertTimelineEvent = typeof timelineEvents.$inferInsert;
export type InsertNote = typeof notes.$inferInsert;
export type InsertTag = typeof tags.$inferInsert;
export type InsertCharacterRelationship = typeof characterRelationships.$inferInsert;
export type InsertFaction = typeof factions.$inferInsert;
export type InsertCharacterFaction = typeof characterFactions.$inferInsert;
export type InsertNoteCharacter = typeof noteCharacters.$inferInsert;
export type InsertCharacterState = typeof characterStates.$inferInsert;
export type InsertStateExtractionQueue = typeof stateExtractionQueue.$inferInsert;
export type InsertIdea = typeof ideas.$inferInsert;
export type InsertIdeaConnection = typeof ideaConnections.$inferInsert;
export type InsertSceneElementDetails = typeof sceneElementDetails.$inferInsert;
export type Power = typeof powers.$inferSelect;
export type PowerLevel = typeof powerLevels.$inferSelect;
export type PowerCombination = typeof powerCombinations.$inferSelect;
export type PowerRule = typeof powerRules.$inferSelect;
export type CharacterPower = typeof characterPowers.$inferSelect;
export type CharacterDesignElement = typeof characterDesignElements.$inferSelect;
export type InsertPower = typeof powers.$inferInsert;
export type InsertPowerLevel = typeof powerLevels.$inferInsert;
export type InsertPowerCombination = typeof powerCombinations.$inferInsert;
export type InsertCharacterPower = typeof characterPowers.$inferInsert;
export type InsertCharacterDesignElement = typeof characterDesignElements.$inferInsert;
export type CharacterAnalysisQueue = typeof characterAnalysisQueue.$inferSelect;
export type AISuggestion = typeof aiSuggestions.$inferSelect;
export type InsertCharacterAnalysisQueue = typeof characterAnalysisQueue.$inferInsert;
export type InsertAISuggestion = typeof aiSuggestions.$inferInsert;
export type InsertAIChapterReview = typeof aiChapterReviews.$inferInsert;

// Drive Credentials Types
export type DriveCredentials = typeof driveCredentials.$inferSelect;
export type InsertDriveCredentials = typeof driveCredentials.$inferInsert;

// World Building Types
export type Item = typeof items.$inferSelect;
export type LoreEntry = typeof loreEntries.$inferSelect;
export type Era = typeof eras.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;
export type Entity = typeof entities.$inferSelect;
export type LocationEntity = typeof locationEntities.$inferSelect;
export type InsertItem = typeof items.$inferInsert;
export type InsertLoreEntry = typeof loreEntries.$inferInsert;
export type InsertEntity = typeof entities.$inferInsert;
export type InsertLocationEntity = typeof locationEntities.$inferInsert;

// ============================================
// SCHEMA EXPORT
// ============================================

export const schema = {
  user,
  session,
  account,
  verification,
  novels,
  chapters,
  chapterStylometry,
  noteStylometry,
  characters,
  characterRelationships,
  locations,
  locationConnections,
  timelineEvents,
  notes,
  tags,
  chapterTags,
  factions,
  factionRelationships,
  characterFactions,
  aliasCache,
  aiChapterReviews,
  userRelations,
  novelRelations,
  chapterRelations,
  chapterStylometryRelations,
  characterRelations,
  locationRelations,
  locationConnectionRelations,
  timelineEventRelations,
  noteRelations,
  tagRelations,
  chapterTagRelations,
  characterRelationshipRelations,
  factionRelations,
  factionRelationshipRelations,
  characterFactionRelations,
  chapterCharacters,
  chapterCharacterRelations,
  noteCharacters,
  noteCharacterRelations,
  characterStates,
  characterStateRelations,
  stateExtractionQueue,
  stateExtractionQueueRelations,
  ideas,
  ideaRelations,
  ideaConnections,
  ideaConnectionRelations,
  plotThreads,
  plotThreadBeats,
  plotThreadRelations,
  plotThreadBeatRelations,
  storyArcs,
  storyArcRelations,
  powers,
  powerLevels,
  powerCombinations,
  characterPowers,
  powerRelations,
  powerLevelRelations,
  powerCombinationRelations,
  characterPowerRelations,
  characterAnalysisQueue,
  characterAnalysisQueueRelations,
  aiSuggestions,
  aiSuggestionRelations,
  aiChapterReviewRelations,
  relationshipHistory,
  relationshipHistoryRelations,
  characterLifeEvents,
  characterLifeEventRelations,
  // World Building
  items,
  itemRelations,
  eras,
  eraRelations,
  loreEntries,
  loreEntryRelations,
  loreGroups,
  loreGroupRelations,
  entities,
  entityRelations,
  locationEntities,
  locationEntityRelations,
  worldSystems,
  worldSystemRelations,
  // Scene Element Details
  sceneElementDetails,
  sceneElementDetailsRelations,
  characterDesignElements,
  characterDesignElementRelations,
  driveSettings,
  driveSync,
  driveCredentials,
  noteAuditIssues,
  noteAuditIssuesRelations,
  // Context Fabric (L1)
  references,
  referencesRelations,
  // Faction Status Presets
  factionStatusPresets,
  // AI Control Center
  aiFeatures,
  aiUsageLog,
  aiActiveRuns,
  aiActiveRunsRelations,
  // Tone Presets
  tonePresets,
};
