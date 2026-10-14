// เรียกผ่าน same-origin proxy (/api/py) — proxy เช็ค session + แนบ internal key ให้ Python
const PYTHON_SERVICE_URL = "/api/py";

export interface SpellError {
  word: string;
  position: number;
  offset: number;
  suggestions: string[];
  sentence: string;
  sentence_index: number;
  // style = ทับศัพท์ไม่ตรงหลักราชบัณฑิตฯ · double_vowel = สระ/วรรณยุกต์ซ้อน · elongation = ลากเสียง (ซ้ำ 3+)
  kind?: "spelling" | "style" | "double_vowel" | "elongation" | "spacing"; // spacing = วรรคแทรกกลางคำ
}

export interface SpellCheckResult {
  success: boolean;
  total_words: number;
  error_count: number;
  errors: SpellError[];
  custom_words_used: string[];
  entities_found?: { name: string; type: string; count: number; offsets: number[] }[];
}

export type SpellEntity = { text: string; type: string };

export async function callSpellCheck(
  text: string,
  entities: SpellEntity[],
  novelId: string
): Promise<SpellCheckResult> {
  const res = await fetch(`${PYTHON_SERVICE_URL}/spell-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, entities, novel_id: novelId }),
  });

  if (!res.ok) {
    throw new Error(`Spell check service error: ${res.status}`);
  }

  return res.json();
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// runSpellCheck — ปุ่ม "ตรวจคำผิด": สั่งงานเบื้องหลังแล้วถามสถานะจนเสร็จ
//
// เดิมหน้าจอยิงตรวจทีละ 10 ย่อหน้าแล้วบันทึกเอง ผู้ใช้ต้องรอทั้งบท — ตอนนี้ตัวตรวจต้องผ่าน Longdo + HF
// (หลายสิบวินาทีต่อบท) จึงให้ Python ทำเบื้องหลังและเขียน note_audit_issues เอง หน้าจอแค่ถามว่าเสร็จหรือยัง
// งานเดียวกับที่ตรวจอัตโนมัติตอนเปลี่ยนสถานะ (ต่างกันแค่ setStatus)
// ============================================================

export interface RunSpellCheckParams {
  novelId: string;
  noteId: string;
  fullText: string;              // Quill getText() — ข้อความล่าสุดในหน้าจอ (อาจยังไม่ได้บันทึก)
  onProgress?: (msg: string) => void;
}

export interface RunSpellCheckSummary {
  totalErrors: number;
  seconds?: number;
}

const POLL_MS = 3000;
// ponytail: เกินนี้ถือว่างานหาย ให้ผู้ใช้กดใหม่ — นานเพราะอาจต้องรอคิวกลาง (ทีละบท ~2 นาที)
const POLL_LIMIT_MS = 60 * 60 * 1000;

export async function runSpellCheck({
  novelId,
  noteId,
  fullText,
  onProgress,
}: RunSpellCheckParams): Promise<RunSpellCheckSummary> {
  // 1. คำเฉพาะของเรื่อง (ตัวละคร ฝ่าย สถานที่ สิ่งของ สิ่งมีชีวิต พลัง ระบบ ตำนาน) — ถูก mask ก่อนตรวจ
  const entRes = await fetch(`/api/novel/${novelId}/spell-entities`);
  const entities: SpellEntity[] = (await entRes.json()).entities ?? [];

  // 2. สั่งงาน — Python ตอบทันที
  const start = await fetch(`${PYTHON_SERVICE_URL}/spell-check-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteId, novelId, text: fullText, entities, setStatus: false }),
  });
  if (!start.ok) throw new Error(`Spell check service error: ${start.status}`);
  onProgress?.("กำลังตรวจคำผิดเบื้องหลัง — เขียนต่อได้เลย");

  // 3. ถามสถานะจนเสร็จ
  const deadline = Date.now() + POLL_LIMIT_MS;
  let lastPosition = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const res = await fetch(`${PYTHON_SERVICE_URL}/spell-check-note/status/${noteId}`);
    if (!res.ok) continue; // สะดุดชั่วคราว ถามใหม่รอบหน้า
    const job = await res.json();
    if (job.state === "done") return { totalErrors: job.count ?? 0, seconds: job.seconds };
    if (job.state === "queued" && job.position && job.position !== lastPosition) {
      lastPosition = job.position;
      onProgress?.(`รอคิวตรวจ ลำดับที่ ${job.position}`);
    }
    if (job.state === "error") throw new Error(job.error || "ตรวจไม่สำเร็จ");
    if (job.state === "unknown") throw new Error("งานตรวจหายไป (ระบบเพิ่งรีสตาร์ต) — กดตรวจใหม่อีกครั้ง");
  }
  throw new Error("ตรวจนานเกินไป — กดตรวจใหม่อีกครั้ง");
}
