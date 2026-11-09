import { z } from "zod";

// Character Design v2 — โครงสร้าง jsonb 6 ก้อนใน characters (profile/psych/motive/arc/narration/customValues)
// ทุกก้อนมี v:1 ไว้ทำ migration ฝั่งโค้ดเมื่อโครงสร้างเปลี่ยน ทุก field ไม่บังคับ (ตัวละครเก่า = null = ยังไม่มีข้อมูล)

const str = z.string().max(2000).optional();
const level5 = z.number().int().min(1).max(5).optional();
const pct = z.number().int().min(0).max(100);

export const profileSchema = z.object({
  v: z.literal(1).default(1),
  identity: z.object({
    fullName: str, birthName: str, ageAtStart: z.number().int().min(0).max(100000).optional(),
    birthLabel: str, // ponytail: วันเกิดเป็นข้อความ จนกว่าจะมีระบบปฏิทินโลกในเรื่อง
    homeland: str, nationality: str, belief: str,
  }).partial().optional(),
  body: z.object({
    heightCm: z.number().int().min(10).max(1000).optional(),
    build: str, hair: str, eyes: str, skin: str, marks: str, handedness: str, health: str,
  }).partial().optional(),
  social: z.object({
    occupation: str, formerTitle: str, education: str, maritalStatus: str, residence: str,
    wealth: level5, status: level5, fame: level5,
  }).partial().optional(),
  speech: z.object({
    selfPronoun: str, addressOthers: str, voice: str, catchphrase: str, languages: str,
    habits: str, likes: str, dislikes: str, fears: str,
  }).partial().optional(),
  family: z.array(z.object({
    name: z.string().min(1).max(200), relation: z.string().max(200), status: str,
    characterId: z.string().optional(), // ลิงก์ตัวละครจริงได้ แต่ไม่บังคับ (พ่อแม่ที่ตายแล้วไม่ต้องเป็นตัวละคร)
  })).max(50).optional(),
  lifeMarks: z.array(z.object({ age: z.number().int().min(0), label: z.string().max(200) })).max(30).optional(),
});

export const DARK_PATTERNS = ["none", "machiavellian", "narcissist", "psychopathic"] as const;

export const psychSchema = z.object({
  v: z.literal(1).default(1),
  bigFive: z.object({ E: level5, A: level5, C: level5, N: level5, O: level5 }).partial().optional(),
  facets: z.array(z.object({
    key: z.string().max(60).optional(), // ชื่อ facet NEO (เช่น "Trust") ถ้ามี
    name: z.string().min(1).max(200),
    direction: z.enum(["low", "high"]).optional(),
    strength: pct.optional(),
    scene: str,
  })).max(12).optional(),
  contradiction: str,
  honestyHumility: z.enum(["low", "mid", "high"]).optional(),
  darkPattern: z.enum(DARK_PATTERNS).optional(),
  mbti: z.object({ EI: pct, SN: pct, TF: pct, JP: pct }).partial().optional(), // <50 = ตัวซ้าย
  enneagram: z.object({ type: z.number().int().min(1).max(9), wing: z.number().int().min(1).max(9).optional() }).optional(),
});

export const motiveSchema = z.object({
  v: z.literal(1).default(1),
  strategy: str, lie: str, value: str, pressurePoint: str, wound: str,
  // "ต้องการ" ใช้คอลัมน์เดิม characters.goals ไม่เก็บซ้ำ
});

export const ARC_TYPES = ["growth", "fall", "flat", "undecided"] as const;

export const arcSchema = z.object({
  v: z.literal(1).default(1),
  type: z.enum(ARC_TYPES).optional(),
  trackedBelief: str,
  // ponytail: อ้าง chapterId ใน jsonb ไม่มี FK — บทที่ถูกลบ UI ต้องกรองทิ้งเอง; ย้ายเป็นตารางถ้าต้อง query ข้ามตัวละคร
  points: z.array(z.object({ chapterId: z.string(), value: pct })).max(500).optional(),
  stages: z.array(z.object({
    stage: z.enum(["start", "turn", "end"]),
    text: str, chapterId: z.string().optional(), lifeEventId: z.string().optional(),
  })).max(20).optional(),
});

export const narrationSchema = z.object({
  v: z.literal(1).default(1),
  pov: z.enum(["first", "third_close", "third_distant", "other_eyes"]).optional(),
  readerFeeling: str,
  secrets: z.array(z.object({ text: z.string().min(1).max(1000), revealChapterId: z.string().optional() })).max(50).optional(),
});

export const customValuesSchema = z.record(z.string(), z.union([z.string().max(2000), z.number(), z.null()]));

export const CHARACTER_SECTIONS = {
  profile: profileSchema,
  psych: psychSchema,
  motive: motiveSchema,
  arc: arcSchema,
  narration: narrationSchema,
  customValues: customValuesSchema,
} as const;

export type CharacterSection = keyof typeof CHARACTER_SECTIONS;
export type CharacterProfile = z.infer<typeof profileSchema>;
export type CharacterPsych = z.infer<typeof psychSchema>;
export type CharacterMotive = z.infer<typeof motiveSchema>;
export type CharacterArc = z.infer<typeof arcSchema>;
export type CharacterNarration = z.infer<typeof narrationSchema>;
export type CharacterCustomValues = z.infer<typeof customValuesSchema>;

export const FIELD_TYPES = ["text", "number", "select"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
