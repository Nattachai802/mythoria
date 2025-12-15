import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

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
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

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
});


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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  relatedChapterId: text("related_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  canvasData: jsonb("canvas_data"),
});

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
  linkedToCharacterId: text("linked_to_character_id").references(() => characters.id, { onDelete: "set null" }),
  linkedToLocationId: text("linked_to_location_id").references(() => locations.id, { onDelete: "set null" }),
  // Plot Hole Checking
  plotHoleCheckedAt: timestamp("plot_hole_checked_at"), // เวลาที่ตรวจสอบล่าสุด
  plotHoleCount: integer("plot_hole_count").default(0), // จำนวน plot holes ที่พบ
  plotHoleIssues: jsonb("plot_hole_issues"), // รายละเอียดปัญหา [{type, description}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color"), // hex color code
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  novelId: text("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

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
});

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

export const timelineEventRelations = relations(timelineEvents, ({ one }) => ({
  novel: one(novels, {
    fields: [timelineEvents.novelId],
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

export const characterRelationshipRelations = relations(characterRelationships, ({ one }) => ({
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
}));

export const factionRelations = relations(factions, ({ one, many }) => ({
  novel: one(novels, {
    fields: [factions.novelId],
    references: [novels.id],
  }),
  members: many(characterFactions),
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

export type User = typeof user.$inferSelect;
export type Novel = typeof novels.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type LocationConnection = typeof locationConnections.$inferSelect;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Faction = typeof factions.$inferSelect;
export type CharacterFaction = typeof characterFactions.$inferSelect;
export type NoteCharacter = typeof noteCharacters.$inferSelect;
export type CharacterState = typeof characterStates.$inferSelect;
export type StateExtractionQueue = typeof stateExtractionQueue.$inferSelect;

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
  characters,
  characterRelationships,
  locations,
  locationConnections,
  timelineEvents,
  notes,
  tags,
  chapterTags,
  factions,
  characterFactions,
  aliasCache,
  userRelations,
  novelRelations,
  chapterRelations,
  characterRelations,
  locationRelations,
  locationConnectionRelations,
  timelineEventRelations,
  noteRelations,
  tagRelations,
  chapterTagRelations,
  characterRelationshipRelations,
  factionRelations,
  characterFactionRelations,
  chapterCharacters,
  chapterCharacterRelations,
  noteCharacters,
  noteCharacterRelations,
  characterStates,
  characterStateRelations,
  stateExtractionQueue,
  stateExtractionQueueRelations,
};