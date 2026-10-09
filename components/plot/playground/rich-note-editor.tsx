"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import "quill-mention/dist/quill.mention.css";
import { parseDelta, legacyToDelta, type DeltaOp } from "@/lib/note-text";

// quill-mention ต้องลงทะเบียนบน Quill ฝั่ง client เท่านั้น (เหมือน components/project/note-editor.tsx)
const ReactQuill = dynamic(async () => {
  const RQ = await import("react-quill-new");
  await import("quill-mention/autoregister");
  return RQ;
}, { ssr: false });

export type NoteMentionCandidate = {
  id: string;
  name: string;
  aliases?: string[];
  role?: string;
  group: "narrator" | "card" | "novel" | "dummy";
};

const GROUP_LABEL: Record<NoteMentionCandidate["group"], string> = {
  narrator: "คำบรรยาย",
  card: "ในการ์ดนี้",
  novel: "ตัวละครอื่น",
  dummy: "ตัวประกอบ",
};
// สีประจำกลุ่มในรายการ @ — แยกให้เห็นชัดว่าเป็นตัวละครในการ์ดนี้ หรือตัวประกอบ/ตัวละครอื่น
const GROUP_TONE: Record<NoteMentionCandidate["group"], { color: string; dot: string }> = {
  narrator: { color: "#7c3aed", dot: "◆" },
  card: { color: "#d97706", dot: "●" },
  novel: { color: "#2563eb", dot: "●" },
  dummy: { color: "#6b7280", dot: "○" },
};
const ROLE_RANK: Record<string, number> = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };

/**
 * editor โน้ต — เก็บเป็น Delta JSON (string) ผ่าน onChange
 * ใช้เป็น uncontrolled: value เริ่มต้นอ่านครั้งเดียวตอน mount (key ที่ parent เป็นตัวสั่ง remount)
 * onChange ยิงเฉพาะตอนผู้ใช้พิมพ์ — เปิดโน้ตเก่าเฉย ๆ จึงไม่ถูกนับว่าแก้
 */
export function RichNoteEditor({
  initial,
  candidates,
  placeholder,
  onChange,
  onSubmit,
  onCancel,
  tint,
}: {
  initial: string;
  candidates: NoteMentionCandidate[];
  placeholder?: string;
  onChange: (deltaJson: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  tint?: string;
}) {
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const initialDelta = useMemo(() => parseDelta(initial) ?? legacyToDelta(initial, candidates), []); // eslint-disable-line react-hooks/exhaustive-deps

  const modules = useMemo(() => ({
    toolbar: [["bold", "italic", "strike"], [{ list: "bullet" }, { list: "ordered" }]],
    mention: {
      allowedChars: /^[\p{L}\p{N}_ .()]*$/u, // ชื่อไทย + วงเล็บแบบ "สมาชิกทีม(ฝ่ายปัดเป่า)"
      mentionDenotationChars: ["@"],
      dataAttributes: ["id", "value", "group"],
      showDenotationChar: true,
      source: (term: string, renderList: (items: unknown[], term: string) => void) => {
        const q = term.toLowerCase();
        const match = (c: NoteMentionCandidate) =>
          q === "" || c.name.toLowerCase().includes(q) || (c.aliases?.some((a) => String(a).toLowerCase().includes(q)) ?? false);
        const all = candidatesRef.current;
        const by = (g: NoteMentionCandidate["group"]) => all.filter((c) => c.group === g && match(c));
        const cap = q === "" ? 5 : 6;
        const items = [
          ...by("narrator"),
          ...by("card"),
          ...by("novel").sort((a, b) => (ROLE_RANK[a.role ?? ""] ?? 9) - (ROLE_RANK[b.role ?? ""] ?? 9) || a.name.localeCompare(b.name)).slice(0, cap),
          ...by("dummy").sort((a, b) => a.name.localeCompare(b.name)).slice(0, cap),
        ].map((c, i, arr) => ({ id: c.id, value: c.name, group: c.group, first: i === 0 || arr[i - 1].group !== c.group }));
        renderList(items, term);
      },
      renderItem: (item: { value: string; group: NoteMentionCandidate["group"]; first?: boolean }) => {
        const tone = GROUP_TONE[item.group];
        const el = document.createElement("div");
        el.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:1.3";
        if (item.first) {
          const head = document.createElement("span");
          head.textContent = GROUP_LABEL[item.group];
          head.style.cssText = `font-size:10px;font-weight:600;letter-spacing:.04em;color:${tone.color};padding-bottom:2px;border-bottom:1px solid ${tone.color}33`;
          el.append(head);
        }
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:6px;align-items:center";
        const mark = document.createElement("span");
        mark.textContent = tone.dot;
        mark.style.cssText = `color:${tone.color};font-size:9px`;
        const name = document.createElement("span");
        name.textContent = item.value;
        row.append(mark, name);
        el.append(row);
        return el;
      },
    },
  }), []);

  return (
    <div
      // Quill snow ตั้งฟอนต์/ขนาดของมันเอง (serif ~15px) → ทับให้เท่าโน้ตที่แสดงในแผง (text-xs, ฟอนต์ของแอป)
      className={
        "rich-note-editor rounded-md border bg-muted/30 text-xs " +
        "[&_.ql-container]:!font-[inherit] [&_.ql-container]:!text-xs " +
        // app/globals.css ตั้ง .ql-editor เป็นสไตล์เขียนนิยาย (1.05rem, line-height 1.9, ช่องไฟย่อหน้า) → ทับเฉพาะในโน้ต
        "[&_.ql-editor]:!px-2.5 [&_.ql-editor]:!py-2 [&_.ql-editor]:!text-xs [&_.ql-editor]:!leading-relaxed [&_.ql-editor]:!tracking-normal [&_.ql-editor]:min-h-[56px] " +
        "[&_.ql-editor_p]:!mb-0.5 [&_.ql-editor_p+p]:!mt-0 " +
        "[&_.ql-editor.ql-blank::before]:!not-italic [&_.ql-editor.ql-blank::before]:!font-[inherit] [&_.ql-editor.ql-blank::before]:!left-2.5 " +
        "[&_.ql-toolbar]:!px-1.5 [&_.ql-toolbar]:!py-1 [&_.ql-toolbar_button]:!h-5 [&_.ql-toolbar_button]:!w-5 [&_.ql-toolbar_button]:!p-0.5 " +
        "[&_.ql-mention-list-container]:!text-xs [&_.ql-mention-list-item]:!h-auto [&_.ql-mention-list-item]:!py-1 [&_.ql-mention-list-item]:!leading-snug " +
        "[&_.ql-toolbar]:!border-0 [&_.ql-toolbar]:!border-b [&_.ql-toolbar]:!border-border/40 [&_.ql-container]:!border-0"
      }
      style={tint ? { background: `${tint}1a`, borderColor: `${tint}4d` } : undefined}
      // ⌘/Ctrl+Enter ต้องดักก่อน Quill (ไม่งั้นกลายเป็นขึ้นบรรทัดใหม่) · ห้าม stopPropagation ตรงนี้
      // ไม่งั้น Quill/quill-mention ไม่ได้รับ Enter ตอนเลือกชื่อ (hotkey กระดานเช็ก contentEditable เองอยู่แล้ว)
      onKeyDownCapture={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(); }
      }}
      onKeyDown={(e) => {
        const listOpen = (e.currentTarget.querySelector(".ql-mention-list-container") as HTMLElement | null)?.style.display === "block";
        if (e.key === "Escape" && !listOpen) onCancel();
      }}
    >
      <ReactQuill
        theme="snow"
        defaultValue={initialDelta as any}
        modules={modules}
        placeholder={placeholder}
        onChange={(_html: string, _delta: unknown, source: string, editor: any) => {
          if (source === "user") onChange(JSON.stringify(editor.getContents()));
        }}
      />
    </div>
  );
}

// ── แสดงผลโน้ต (อ่านอย่างเดียว) — สร้างเป็น React element จาก Delta ตรง ๆ ไม่ผ่าน HTML ──

type Line = { inline: ReactNode[]; list?: "bullet" | "ordered"; lead?: { id: string; value: string } };

function toLines(ops: DeltaOp[]): Line[] {
  const lines: Line[] = [];
  let cur: ReactNode[] = [];
  let lead: Line["lead"];
  let k = 0;
  const wrap = (node: ReactNode, a?: DeltaOp["attributes"]) => {
    if (a?.bold) node = <strong key={k++}>{node}</strong>;
    if (a?.italic) node = <em key={k++}>{node}</em>;
    if (a?.strike) node = <s key={k++}>{node}</s>;
    return node;
  };
  for (const op of ops) {
    if (typeof op.insert !== "string") {
      const m = op.insert?.mention;
      if (m?.value) {
        if (cur.length === 0) lead = { id: m.id ?? m.value, value: m.value }; // ชิปต้นบรรทัด = ผู้พูดของ template บทสนทนา
        cur.push(
          <span key={k++} className="rounded bg-amber-500/10 px-0.5 font-medium text-amber-700 dark:text-amber-300">
            @{m.value}
          </span>
        );
      }
      continue;
    }
    const parts = op.insert.split("\n");
    parts.forEach((part, i) => {
      if (part) cur.push(wrap(part, op.attributes));
      if (i < parts.length - 1) {
        lines.push({ inline: cur, list: op.attributes?.list, lead });
        cur = [];
        lead = undefined;
      }
    });
  }
  if (cur.length) lines.push({ inline: cur, lead });
  return lines;
}

// สีประจำตัวละคร: hash จาก id → hue คงที่ ตัวละครเดียวกันได้สีเดียวกันทุกโน้ต
const hueOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

/**
 * template บทสนทนา: บรรทัดที่ขึ้นต้นด้วยชิป = ตาพูดของคนนั้น · บรรทัดอื่น = บรรทัดบรรยาย (เต็มความกว้าง)
 * grid สองคอลัมน์ทั้งโน้ต — คอลัมน์ชื่อกว้างตามชื่อที่ยาวสุด (เพดาน 38%) ข้อความทุกตาเลยเรียงแนวเดียวกัน
 * และบรรทัดที่ยาวพับกลับมาตรงคอลัมน์ข้อความ ไม่ลอดใต้ชื่อ
 */
function DialogueView({ lines }: { lines: Line[] }) {
  const rows = lines.filter((l) => l.inline.length > 0);
  return (
    <div className="grid grid-cols-[fit-content(38%)_1fr] gap-x-3">
      {rows.map((l, i) => {
        const sep = i > 0 ? "border-t border-border/40 " : "";
        if (!l.lead) return <p key={i} className={sep + "col-span-2 py-1.5 italic text-muted-foreground"}>{l.inline}</p>;
        const hue = hueOf(l.lead.id);
        return (
          <Fragment key={i}>
            <span className={sep + "py-1.5 text-[11px] font-semibold break-words"} style={{ color: `hsl(${hue} 60% 38%)` }}>{l.lead.value}</span>
            <div className={sep + "py-1.5 min-w-0"}>{l.inline.slice(1)}</div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** โน้ตรูปแบบใหม่ (Delta) → React · โน้ตเก่า (plain) ให้ fallback ไปที่ renderPlain ที่ส่งมา */
export function NoteView({ raw, renderPlain }: { raw: string; renderPlain: (text: string) => ReactNode }) {
  const delta = parseDelta(raw);
  if (!delta) return <p className="whitespace-pre-wrap">{renderPlain(raw)}</p>;
  const lines = toLines(delta.ops);
  if (delta.template === "dialogue") return <DialogueView lines={lines} />;
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const l = lines[i];
    if (l.list) {
      const kind = l.list;
      const items: ReactNode[] = [];
      while (i < lines.length && lines[i].list === kind) { items.push(<li key={i}>{lines[i].inline}</li>); i++; }
      const Tag = kind === "ordered" ? "ol" : "ul";
      out.push(<Tag key={`l${i}`} className={kind === "ordered" ? "list-decimal pl-4" : "list-disc pl-4"}>{items}</Tag>);
    } else {
      out.push(<p key={i} className="min-h-[1em]">{l.inline}</p>);
      i++;
    }
  }
  return <div className="space-y-0.5">{out}</div>;
}

/** โน้ตยาว: ตัดที่ ~6 บรรทัด + "ดูเพิ่ม" (วัดจริงหลัง render ไม่เดาจากจำนวนตัวอักษร) */
export function ClampedNote({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1 || open);
  });
  return (
    <>
      <div ref={ref} className={open ? "" : "max-h-[8.5rem] overflow-hidden"}>{children}</div>
      {overflowing && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          {open ? "ย่อ" : "ดูเพิ่ม"}
        </button>
      )}
    </>
  );
}
