// เรียกผ่าน same-origin proxy (/api/py) — proxy เช็ค session + แนบ internal key ให้ Python
const PYTHON_SERVICE_URL = "/api/py";

export interface SpellError {
  word: string;
  position: number;
  offset: number;
  suggestions: string[];
  sentence: string;
  sentence_index: number;
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
// runSpellCheck — แกนหลักของการตรวจคำผิด
// ใช้ร่วมกันทั้งปุ่ม "ตรวจคำผิด" และ auto-check ตอนเปลี่ยนสถานะเป็น proofreading
// ============================================================

const BATCH_SIZE = 10; // ย่อหน้าต่อ batch

export interface RunSpellCheckParams {
  novelId: string;
  noteId: string;
  fullText: string;              // Quill getText() — index ตรงกับ editor.setSelection
  onProgress?: (msg: string) => void;  // toast ความคืบหน้า
  onBatchDone?: () => void;            // refresh list หลังแต่ละ batch
}

export interface RunSpellCheckSummary {
  totalWords: number;
  totalErrors: number;
  totalSaved: number;
}

export async function runSpellCheck({
  novelId,
  noteId,
  fullText,
  onProgress,
  onBatchDone,
}: RunSpellCheckParams): Promise<RunSpellCheckSummary> {
  // 1. ดึงคำเฉพาะของเรื่อง (ตัวละคร ฝ่าย สถานที่ สิ่งของ สิ่งมีชีวิต พลัง ระบบ ตำนาน)
  const entRes = await fetch(`/api/novel/${novelId}/spell-entities`);
  const entities: SpellEntity[] = (await entRes.json()).entities ?? [];

  // 2. แบ่งย่อหน้า พร้อมเก็บตำแหน่งเริ่มต้นใน fullText
  const paragraphs: { text: string; start: number }[] = [];
  {
    let pos = 0;
    for (const part of fullText.split("\n")) {
      if (part.trim().length > 0) paragraphs.push({ text: part, start: pos });
      pos += part.length + 1;
    }
  }
  if (paragraphs.length === 0) {
    return { totalWords: 0, totalErrors: 0, totalSaved: 0 };
  }

  const batches: { text: string; start: number }[][] = [];
  for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
    batches.push(paragraphs.slice(i, i + BATCH_SIZE));
  }

  // 3. dedup — ลบ spelling issues เก่าก่อน (เขียนทับ)
  const delRes = await fetch(
    `/api/novel/${novelId}/note/${noteId}/audit-issues?category=spelling`,
    { method: "DELETE" }
  );
  if (delRes.ok) onBatchDone?.();

  // 4. ตรวจทีละ batch — save + refresh ทันที (progressive)
  let totalWords = 0;
  let totalErrors = 0;
  let totalSaved = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const batchText = batch.map(p => p.text).join("\n");

    const result = await callSpellCheck(batchText, entities, novelId);
    if (!result.success) continue;

    totalWords += result.total_words;
    totalErrors += result.errors.length;

    // offset จาก Python อ้างกับ batchText — แปลงกลับเป็นตำแหน่งใน fullText ทีละย่อหน้า
    // (เดิมใช้ indexOf ไล่หา ทำให้ชิ้นคำอย่าง "เสี" ไปตรงกับ "เสียง" คำแรกที่เจอ)
    let batchSaved = 0;
    for (const err of result.errors) {
      let local = err.offset;
      let idx = -1;
      for (const p of batch) {
        if (local <= p.text.length) { idx = p.start + local; break; }
        local -= p.text.length + 1;
      }
      if (idx < 0 || fullText.slice(idx, idx + err.word.length) !== err.word) continue;

      const hasSuggestion = err.suggestions.length > 0;
      const body = {
        level: hasSuggestion ? "proofreading" : "line",
        category: "spelling",
        startIndex: idx,
        endIndex: idx + err.word.length,
        flaggedText: err.word,
        issueDescription: hasSuggestion
          ? `คำสะกดผิด — แนะนำ: ${err.suggestions.slice(0, 3).join(", ")}`
          : `อาจสะกดผิด — ไม่มีคำแนะนำอัตโนมัติ โปรดตรวจสอบเอง`,
        suggestedText: hasSuggestion ? err.suggestions[0] : null,
        suggestionNotes: hasSuggestion ? null : "PyThaiNLP หาคำที่ถูกต้องไม่ได้",
      };

      const res = await fetch(`/api/novel/${novelId}/note/${noteId}/audit-issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        batchSaved++;
        totalSaved++;
      }
    }

    if (batchSaved > 0) onBatchDone?.();
    if (totalErrors > 0) onProgress?.(`ตรวจแล้ว ${b + 1}/${batches.length} ส่วน — พบ ${totalErrors} คำ`);
  }

  return { totalWords, totalErrors, totalSaved };
}
