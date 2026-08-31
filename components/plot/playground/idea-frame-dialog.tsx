"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Users, MapPin, X, Link as LinkIcon, Pencil, ExternalLink, Copy,
  GitBranchPlus, Shield, Check, MoreVertical, Loader2, Star, MessageCircle,
  BookOpen, Quote, StickyNote as StickyNoteIcon, Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mentionRangeAtCaret } from "@/lib/mentions";
import { SceneElementDetails } from "@/db/schema";
import { SceneParticipantsPanel } from "./scene-participants-panel";

// ป้ายสีจัดกลุ่มโน้ต — เดิมอยู่ใน canvas-item.tsx ย้ายมาที่นี่เพราะใช้เฉพาะระบบโน้ตของ idea
const CARD_COLORS = ["#f59e0b", "#fb923c", "#f43f5e", "#a78bfa", "#6366f1", "#22d3ee", "#34d399", "#facc15", "#e879f9", "#94a3b8"];

// ต้องตรงกับ ROLES ใน scene-participants-panel
const ROLE_META: Record<string, { label: string; text: string; dot: string }> = {
  protagonist: { label: 'ตัวหลัก', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  antagonist: { label: 'ฝ่ายตรงข้าม', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  witness: { label: 'ผู้เห็นเหตุ', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  victim: { label: 'เหยื่อ', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
};
const roleMeta = (role?: string) => ROLE_META[(role || 'protagonist').toLowerCase()] ?? ROLE_META.protagonist;

const frameNumber = (item: any) => `#${String((item.beatIndex ?? 0) + 1).padStart(3, "0")}`;

// แถบรูฟิล์ม (sprocket holes) — บน/ล่างของการ์ดและไดอะล็อกไอเดีย
function FilmSprockets({ count = 11 }: { count?: number }) {
  return (
    <div className="film-sprockets" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => <span key={i} />)}
    </div>
  );
}

interface AncestorConnection {
  id: string;
  sourceIdeaId: string;
  targetIdeaId: string;
  label?: string | null;
  targetIdeaTitle?: string | null;
  targetIdeaContent?: string | null;
  targetIdeaCategory?: string | null;
  targetIdeaNotes?: string[];
}

interface ThreadBeat {
  beatId: string;
  threadId: string;
  title: string;
  color: string | null;
  role: string;
}

interface IdeaFilmCardProps {
  item: any;
  onRemove?: () => void;
  onRemoveChild?: (id: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
  isOver?: boolean;
  isLinkingSource?: boolean;
  onLinkStart?: () => void;
  elementDetails?: Map<string, SceneElementDetails>;
  onEditChild?: (child: any) => void;
  ideaNotes?: SceneElementDetails[];
  onQuickAddNote?: (item: any, text: string, existingNoteId?: string, noteKind?: string) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void | Promise<void>;
  onReorderNotes?: (orderedNoteIds: string[]) => void | Promise<void>;
  novelId?: string;
  onSetAncestor?: () => void;
  ancestorConnections?: AncestorConnection[];
  onRemoveAncestor?: (connectionId: string) => void;
  sceneId?: string;
  characters?: any[];
  novelDummyNames?: string[];
  factions?: any[];
  ideas?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onUpdateChild?: (parentId: string, childId: string, patch: any) => void;
  onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
  onSetColor?: (color: string | null) => void;
  tonePresets?: { id: string; label: string; color: string }[];
  onSetKeyMoment?: (label: string | null) => void;
  onSetNarration?: (isNarration: boolean) => void;
  threadBeats?: ThreadBeat[];
  onOpenThreadBind?: () => void;
}

// การ์ดหน้าตา "เฟรมฟิล์ม" แบบย่อบน canvas — กดเพื่อเปิดรายละเอียดเต็มใน IdeaFrameDialog
export function IdeaFilmCard(props: IdeaFilmCardProps) {
  const {
    item, onRemove, onRemoveChild, isDragging, isOverlay, isOver, isLinkingSource, onLinkStart,
    elementDetails, onEditChild, ideaNotes, onQuickAddNote, onDeleteNote, onReorderNotes, novelId,
    onSetAncestor, ancestorConnections, onRemoveAncestor, sceneId, characters, novelDummyNames,
    factions, ideas, onAddChild, onUpdateChild, onPromoteDummy, onDetailSaved, onSetColor,
    tonePresets = [], onSetKeyMoment, onSetNarration, threadBeats, onOpenThreadBind,
  } = props;

  const [dialogOpen, setDialogOpen] = useState(false);

  const isKeyMoment = !!item.keyMomentLabel;
  const widthClass = isOverlay ? 'w-72' : 'w-full';

  const children = item.children || [];
  const peopleNames = children.filter((c: any) => ['character', 'dummy_character', 'faction', 'dummy_faction'].includes(c.type)).map((c: any) => c.title);
  const locationCount = children.filter((c: any) => c.type === 'location').length;
  const stickyChildren = children.filter((c: any) => c.type === 'sticky-note');
  const thisIdeaNotes = (ideaNotes || [])
    .filter((n) => n.canvasItemId === item.id && n.elementType === 'idea_note')
    .sort((a, b) => (a.noteOrder ?? 0) - (b.noteOrder ?? 0));

  const copyToClipboard = async () => {
    const characterNames = children.filter((c: any) => c.type === 'character').map((c: any) => c.title).join(', ') || '';
    const locations = children.filter((c: any) => c.type === 'location').map((c: any) => c.title).join(', ') || '';
    const others = children.filter((c: any) => !['character', 'location', 'sticky-note'].includes(c.type)).map((c: any) => c.title).join(', ') || '';
    const stickyNotes = stickyChildren.map((c: any) => c.content).filter(Boolean).join('\n') || '';
    const notes = thisIdeaNotes.map((n) => n.notes).join('\n') || '';
    const ancestors = (ancestorConnections || []).map((conn) => {
      const title = conn.targetIdeaTitle || conn.targetIdeaId.slice(0, 8);
      return conn.label ? `[${conn.label}] ${title}` : title;
    }).join(', ') || '';
    const content = typeof item.content === 'string' ? item.content : '';
    const clipboardText = `Title: ${item.title}\nDesc: ${content}\nCharacter: ${characterNames}\nOther: ${locations}${others ? (locations ? ', ' : '') + others : ''}\nAncestors: ${ancestors}\nNotes: ${notes}\nSticky Notes: ${stickyNotes}`;
    try {
      await navigator.clipboard.writeText(clipboardText);
      toast.success('คัดลอกข้อมูลแล้ว');
    } catch {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  return (
    <div className="relative group">
      <Popover open={dialogOpen} onOpenChange={setDialogOpen}>
      <PopoverTrigger asChild>
      <Card
        className={cn(
          widthClass, "bg-card overflow-hidden cursor-pointer border shadow-sm hover:shadow-md transition-all duration-200 p-0",
          isOver && "ring-2 ring-[var(--forge-amber)] ring-offset-1",
          isLinkingSource && "ring-2 ring-blue-500 ring-offset-1",
          isKeyMoment && "ring-1 ring-amber-400/60 shadow-[0_0_14px_-2px] shadow-amber-500/40",
          item.isNarration ? "border-dashed border-amber-500/30 opacity-75 hover:opacity-100" : "border-border/70",
          isDragging && !isOverlay && "opacity-0"
        )}
      >
        <FilmSprockets />
        <div className="px-2.5 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="flex items-center gap-1.5 font-technical text-[10px] tracking-widest text-muted-foreground/60 shrink-0">
              {item.color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: item.color }} />}
              {frameNumber(item)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {item.isNarration && <Quote className="w-3 h-3 text-amber-500" fill="currentColor" />}
              {isKeyMoment && <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="เมนู"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {onLinkStart && (
                    <DropdownMenuItem className={isLinkingSource ? 'text-blue-500 font-medium' : ''} onSelect={() => onLinkStart()}>
                      <LinkIcon className="w-3.5 h-3.5 mr-2" />
                      {isLinkingSource ? 'กำลังเชื่อม...' : 'เชื่อมการ์ด'}
                    </DropdownMenuItem>
                  )}
                  {onSetNarration && (
                    <DropdownMenuItem onSelect={() => onSetNarration(!item.isNarration)}>
                      <Quote className="w-3.5 h-3.5 mr-2" fill={item.isNarration ? "currentColor" : "none"} />
                      {item.isNarration ? "เอาเครื่องหมายคำบรรยายออก" : "ทำเครื่องหมายเป็นคำบรรยาย"}
                    </DropdownMenuItem>
                  )}
                  {onSetAncestor && (
                    <DropdownMenuItem onSelect={() => onSetAncestor()}>
                      <GitBranchPlus className="w-3.5 h-3.5 mr-2" />
                      เชื่อมเหตุผล
                    </DropdownMenuItem>
                  )}
                  {onSetKeyMoment && (
                    <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
                      <Star className="w-3.5 h-3.5 mr-2" />
                      {item.keyMomentLabel ? 'แก้ไขเหตุการณ์สำคัญ' : 'ทำเครื่องหมายเหตุการณ์สำคัญ'}
                    </DropdownMenuItem>
                  )}
                  {onOpenThreadBind && (
                    <DropdownMenuItem onSelect={() => onOpenThreadBind()}>
                      <LinkIcon className="w-3.5 h-3.5 mr-2" />
                      {threadBeats && threadBeats.length > 0 ? 'จัดการปมที่ผูก' : 'ผูกปมเรื่อง'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => copyToClipboard()}>
                    <Copy className="w-3.5 h-3.5 mr-2" />
                    คัดลอกข้อมูล
                  </DropdownMenuItem>
                  {onSetColor && tonePresets.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Tone</p>
                        <div className="flex flex-col gap-0.5">
                          {tonePresets.map((t) => (
                            <button
                              key={t.id}
                              className={cn(
                                "flex items-center gap-2 px-1.5 py-1 rounded text-xs text-left transition-colors hover:bg-muted",
                                item.color === t.color && "bg-muted font-medium"
                              )}
                              onClick={(e) => { e.stopPropagation(); onSetColor(t.color); }}
                            >
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                              <span className="flex-1 truncate">{t.label}</span>
                              {item.color === t.color && <Check className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            </button>
                          ))}
                          {item.color && (
                            <button
                              className="flex items-center gap-2 px-1.5 py-1 rounded text-xs text-muted-foreground hover:bg-muted transition-colors"
                              onClick={(e) => { e.stopPropagation(); onSetColor(null); }}
                            >
                              <X className="h-2.5 w-2.5 shrink-0" />
                              ล้าง tone
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  {onRemove && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onRemove()}>
                        <X className="w-3.5 h-3.5 mr-2" />
                        นำออกจาก canvas
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="font-semibold text-sm leading-snug line-clamp-2">{item.title}</p>
          {item.content && typeof item.content === 'string' && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{item.content}</p>
          )}

          <div className="flex items-center gap-2.5 pt-0.5 text-[11px] text-muted-foreground/90 min-w-0">
            {peopleNames.length > 0 && (
              <span className="flex items-center gap-1 min-w-0 flex-1" title={peopleNames.join(', ')}>
                <Users className="w-3 h-3 shrink-0" />
                <span className="relative min-w-0 flex-1 h-3.5 overflow-hidden">
                  <span className="absolute inset-y-0 left-0 whitespace-nowrap animate-marquee-ltr">
                    {peopleNames.join(', ')}
                  </span>
                </span>
              </span>
            )}
            {locationCount > 0 && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-green-500" />{locationCount}</span>
            )}
            {thisIdeaNotes.length > 0 && (
              <span className="flex items-center gap-1"><StickyNoteIcon className="w-3 h-3 text-yellow-500" />{thisIdeaNotes.length}</span>
            )}
            {threadBeats && threadBeats.length > 0 && (
              <span className="flex items-center gap-0.5 ml-auto">
                {threadBeats.map((b) => (
                  <span key={b.beatId} className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: b.color ?? '#f59e0b' }} title={b.title} />
                ))}
              </span>
            )}
          </div>
        </div>
        <FilmSprockets />
      </Card>
      </PopoverTrigger>

      {isOver && children.length === 0 && (
        <div className="mt-1.5 h-8 border-2 border-dashed border-primary/30 rounded bg-primary/5 flex items-center justify-center text-[10px] text-primary">
          Drop items here
        </div>
      )}

      {/* Sticky Note children — ฟีเจอร์แยกจากระบบโน้ต HOW เดิม คงพฤติกรรมเดิมไว้ */}
      {stickyChildren.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {stickyChildren.map((note: any) => (
            <div key={note.id} className="group relative">
              <div className="w-full bg-purple-100 rounded border-2 border-purple-200 p-2.5" style={{ minHeight: '48px' }}>
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-purple-200">
                  <div className="flex items-center gap-1 text-purple-600">
                    <StickyNoteIcon className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase">Note</span>
                  </div>
                  {onRemoveChild && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveChild(note.id); }}
                      className="text-purple-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">
                  {note.content || <span className="text-purple-400 italic">Empty note...</span>}
                </p>
              </div>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-sm" />
            </div>
          ))}
        </div>
      )}

      <IdeaFrameDialog
        onClose={() => setDialogOpen(false)}
        item={item}
        elementDetails={elementDetails}
        onEditChild={onEditChild}
        onRemoveChild={onRemoveChild}
        ideaNotes={ideaNotes}
        onQuickAddNote={onQuickAddNote}
        onDeleteNote={onDeleteNote}
        onReorderNotes={onReorderNotes}
        novelId={novelId}
        ancestorConnections={ancestorConnections}
        onRemoveAncestor={onRemoveAncestor}
        sceneId={sceneId}
        characters={characters}
        novelDummyNames={novelDummyNames}
        factions={factions}
        ideas={ideas}
        onAddChild={onAddChild}
        onUpdateChild={onUpdateChild}
        onPromoteDummy={onPromoteDummy}
        onDetailSaved={onDetailSaved}
        onSetKeyMoment={onSetKeyMoment}
        onOpenThreadBind={onOpenThreadBind}
        threadBeats={threadBeats}
        onCopy={copyToClipboard}
      />
      </Popover>
    </div>
  );
}

interface IdeaFrameDialogProps {
  onClose: () => void;
  item: any;
  elementDetails?: Map<string, SceneElementDetails>;
  onEditChild?: (child: any) => void;
  onRemoveChild?: (id: string) => void;
  ideaNotes?: SceneElementDetails[];
  onQuickAddNote?: (item: any, text: string, existingNoteId?: string, noteKind?: string) => void | Promise<void>;
  onDeleteNote?: (noteId: string) => void | Promise<void>;
  onReorderNotes?: (orderedNoteIds: string[]) => void | Promise<void>;
  novelId?: string;
  ancestorConnections?: AncestorConnection[];
  onRemoveAncestor?: (connectionId: string) => void;
  sceneId?: string;
  characters?: any[];
  novelDummyNames?: string[];
  factions?: any[];
  ideas?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onUpdateChild?: (parentId: string, childId: string, patch: any) => void;
  onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
  onSetKeyMoment?: (label: string | null) => void;
  onOpenThreadBind?: () => void;
  threadBeats?: ThreadBeat[];
  onCopy: () => void;
}

// รายละเอียดเต็มของไอเดีย — ลอยข้างการ์ดแบบ hovercard (Popover) แทน dialog กลางจอ
// เพื่อให้เปิดดูได้พร้อมกันหลายใบสำหรับเทียบ ๆ กัน — ไม่บังพื้นหลัง ไม่ auto-close ตอนคลิกการ์ดอื่น
function IdeaFrameDialog({
  onClose, item, elementDetails, onEditChild, onRemoveChild, ideaNotes,
  onQuickAddNote, onDeleteNote, onReorderNotes, novelId, ancestorConnections, onRemoveAncestor,
  sceneId, characters, novelDummyNames, factions, ideas, onAddChild, onUpdateChild,
  onPromoteDummy, onDetailSaved, onSetKeyMoment, onOpenThreadBind, threadBeats, onCopy,
}: IdeaFrameDialogProps) {
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null); // null = สร้างใหม่, id = แก้ไขโน้ตเดิม
  const [quickNoteKind, setQuickNoteKind] = useState<string | null>(null); // null = ทั่วไป
  const [deletingNote, setDeletingNote] = useState(false);
  const [noteBaseline, setNoteBaseline] = useState("");
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(false);
  const [confirmDiscardNote, setConfirmDiscardNote] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [editingKeyMoment, setEditingKeyMoment] = useState(false);
  const [keyMomentDraft, setKeyMomentDraft] = useState(item.keyMomentLabel || "");

  // @mention ในโน้ต — เฉพาะ character ที่เป็น children ของการ์ดนี้
  const quickNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const [qmOpen, setQmOpen] = useState(false);
  const [qmQuery, setQmQuery] = useState("");
  const [qmIndex, setQmIndex] = useState(0);
  type MentionGroup = "narrator" | "card" | "novel" | "dummy";
  type MentionChar = { id: string; name: string; aliases?: string[]; role?: string; group: MentionGroup };
  const narratorChars: MentionChar[] = item.isNarration ? [{ id: 'narrator', name: 'narrator', group: 'narrator' as const }] : [];
  const cardChars: MentionChar[] = Array.from(
    new Map(
      (item.children || [])
        .filter((c: any) => c.type === 'character' || c.type === 'dummy_character')
        .map((c: any) => { const id = c.referenceId || c.id; return [id, { id, name: c.title, group: "card" as const }]; })
    ).values()
  ) as MentionChar[];
  const cardIds = new Set(cardChars.map(c => c.id));
  const cardNames = new Set(cardChars.map(c => c.name));
  const novelChars: MentionChar[] = (characters || [])
    .filter((c: any) => !cardIds.has(c.id))
    .map((c: any) => ({ id: c.id, name: c.name, aliases: Array.isArray(c.aliases) ? c.aliases : undefined, role: c.role, group: "novel" as const }));
  const novelNames = new Set(novelChars.map(c => c.name));
  const dummyChars: MentionChar[] = (novelDummyNames || [])
    .filter(n => !cardNames.has(n) && !novelNames.has(n))
    .map(n => ({ id: `dummy:${n}`, name: n, group: "dummy" as const }));
  const allMentionChars = [...narratorChars, ...cardChars, ...novelChars, ...dummyChars];

  const ROLE_RANK: Record<string, number> = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };
  const q = qmQuery.toLowerCase();
  const matchChar = (c: MentionChar) =>
    c.name.toLowerCase().includes(q) || (c.aliases?.some(a => String(a).toLowerCase().includes(q)) ?? false);
  const narratorMatches = qmOpen ? narratorChars.filter(c => q === "" || matchChar(c)) : [];
  const cardMatches = qmOpen ? cardChars.filter(c => q === "" || matchChar(c)) : [];
  const novelMatches = qmOpen
    ? novelChars
        .filter(c => q === "" || matchChar(c))
        .sort((a, b) => (ROLE_RANK[a.role ?? ""] ?? 9) - (ROLE_RANK[b.role ?? ""] ?? 9) || a.name.localeCompare(b.name))
        .slice(0, q === "" ? 5 : 6)
    : [];
  const dummyMatches = qmOpen
    ? dummyChars.filter(c => q === "" || matchChar(c)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, q === "" ? 5 : 6)
    : [];
  const qmMatches = [...narratorMatches, ...cardMatches, ...novelMatches, ...dummyMatches];
  const detectQm = (value: string, caret: number) => {
    const m = value.slice(0, caret).match(/@([^\s@]{0,30})$/);
    if (m && allMentionChars.length > 0) { setQmQuery(m[1]); setQmOpen(true); setQmIndex(0); }
    else setQmOpen(false);
  };
  const insertQm = (name: string) => {
    const ta = quickNoteRef.current;
    const caret = ta?.selectionStart ?? quickNote.length;
    const before = quickNote.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `);
    const after = quickNote.slice(caret);
    setQuickNote(before + after);
    setQmOpen(false);
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(before.length, before.length); });
  };

  const renderNoteMentions = (text: string): React.ReactNode => {
    const names = allMentionChars.map(c => c.name).filter(Boolean);
    if (!names.length || !text) return text;
    const esc = names.slice().sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`@(${esc.join("|")})`, "g");
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(
        <span key={m.index} className="inline-flex items-center rounded bg-amber-500/20 px-1 font-medium text-amber-700 dark:text-amber-300">
          @{m[1]}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const submitQuickNote = async () => {
    const text = quickNote.trim();
    if (!text || !onQuickAddNote) return;
    setSavingQuickNote(true);
    await onQuickAddNote(item, text, editingNoteId ?? undefined, quickNoteKind ?? undefined);
    setSavingQuickNote(false);
    resetQuickNote();
  };

  const resetQuickNote = () => {
    setQuickNote("");
    setQuickNoteOpen(false);
    setEditingNoteId(null);
    setQuickNoteKind(null);
    setNoteBaseline("");
    setConfirmDeleteNote(false);
    setConfirmDiscardNote(false);
  };

  const closeQuickNote = () => {
    const dirty = quickNote.trim() && quickNote !== noteBaseline;
    if (dirty && !confirmDiscardNote) { setConfirmDiscardNote(true); return; }
    resetQuickNote();
  };

  const activeNoteColor = quickNoteKind ?? undefined;

  const deleteEditingNote = async () => {
    if (!editingNoteId || !onDeleteNote) return;
    setDeletingNote(true);
    await onDeleteNote(editingNoteId);
    setDeletingNote(false);
    closeQuickNote();
  };

  const noteEditor = (
    <div className="space-y-1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setQuickNoteKind(null)}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded border transition-colors",
            !quickNoteKind ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" : "border-border/60 text-muted-foreground hover:border-border"
          )}
        >
          ทั่วไป
        </button>
        {CARD_COLORS.map((color) => {
          const active = quickNoteKind === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => setQuickNoteKind(color)}
              title={color}
              className={cn(
                "w-4 h-4 rounded-full border transition-transform",
                active ? "scale-110 border-foreground" : "border-black/10 hover:scale-105"
              )}
              style={{ background: color }}
            />
          );
        })}
      </div>
      <Popover open={qmOpen && qmMatches.length > 0}>
        <PopoverAnchor asChild>
          <Textarea
            autoFocus
            ref={quickNoteRef}
            value={quickNote}
            onChange={(e) => { setQuickNote(e.target.value); setConfirmDeleteNote(false); setConfirmDiscardNote(false); detectQm(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
            onKeyDown={(e) => {
              if (qmOpen && qmMatches.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setQmIndex(i => (i + 1) % qmMatches.length); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setQmIndex(i => (i - 1 + qmMatches.length) % qmMatches.length); return; }
                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertQm(qmMatches[qmIndex].name); return; }
                if (e.key === "Escape") { e.preventDefault(); setQmOpen(false); return; }
              }
              if ((e.key === "Backspace" || e.key === "Delete") && !e.metaKey && !e.ctrlKey && !e.altKey) {
                const ta = e.currentTarget;
                if (ta.selectionStart === ta.selectionEnd) {
                  const r = mentionRangeAtCaret(quickNote, ta.selectionStart, allMentionChars.map(c => c.name), e.key === "Backspace" ? "back" : "forward");
                  if (r) {
                    e.preventDefault();
                    setQuickNote(quickNote.slice(0, r[0]) + quickNote.slice(r[1]));
                    requestAnimationFrame(() => ta.setSelectionRange(r[0], r[0]));
                    return;
                  }
                }
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitQuickNote(); }
              else if (e.key === "Escape") { closeQuickNote(); }
            }}
            placeholder={allMentionChars.length > 0
              ? "เขียนโน้ต… (@ เพื่อ mention ตัวละคร, ⌘/Ctrl+Enter บันทึก)"
              : "เขียนโน้ต… (⌘/Ctrl+Enter เพื่อบันทึก)"}
            className={cn("min-h-[52px] max-h-64 field-sizing-content resize-none text-xs", !activeNoteColor && "bg-yellow-500/10 border-yellow-500/30 focus-visible:ring-yellow-500/40")}
            style={activeNoteColor ? { background: `${activeNoteColor}1a`, borderColor: `${activeNoteColor}4d` } : undefined}
          />
        </PopoverAnchor>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          hideWhenDetached
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="p-0 w-56 max-h-52 overflow-y-auto border-yellow-400"
        >
          {qmMatches.map((c, i) => {
            const firstNarrator = i === 0 && narratorMatches.length > 0;
            const firstCard = i === narratorMatches.length && cardMatches.length > 0;
            const firstNovel = i === narratorMatches.length + cardMatches.length && novelMatches.length > 0;
            const firstDummy = i === narratorMatches.length + cardMatches.length + novelMatches.length && dummyMatches.length > 0;
            return (
              <div key={c.id}>
                {firstNarrator && <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-amber-600/80 font-technical">คำบรรยาย</div>}
                {firstCard && <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70 font-technical border-t border-border/40 mt-0.5">ในการ์ดนี้</div>}
                {firstNovel && <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70 font-technical border-t border-border/40 mt-0.5">ตัวละครอื่นในนิยาย</div>}
                {firstDummy && <div className="px-2 pt-1 pb-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70 font-technical border-t border-border/40 mt-0.5">ตัวประกอบจากฉากอื่น</div>}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertQm(c.name); }}
                  className={`w-full flex items-center gap-2 px-2 py-1 text-left text-xs ${i === qmIndex ? "bg-yellow-500/20" : "hover:bg-yellow-500/10"}`}
                >
                  <span className="text-yellow-600 font-semibold">@</span>
                  <span className="truncate flex-1">{c.name}</span>
                </button>
              </div>
            );
          })}
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-1">
        {editingNoteId && onDeleteNote && (
          <Button
            type="button" size="sm" variant="ghost"
            className={cn("h-6 text-xs px-2 text-destructive hover:text-destructive", confirmDeleteNote && "bg-destructive/10")}
            disabled={deletingNote}
            onClick={() => confirmDeleteNote ? deleteEditingNote() : setConfirmDeleteNote(true)}
          >
            {deletingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmDeleteNote ? "แน่ใจ?" : "ลบ"}
          </Button>
        )}
        <div className="flex justify-end gap-1 ml-auto">
          <Button
            type="button" size="sm" variant="ghost"
            className={cn("h-6 text-xs px-2", confirmDiscardNote && "text-destructive bg-destructive/10")}
            onClick={closeQuickNote}
          >
            {confirmDiscardNote ? "ทิ้งข้อความ?" : "ยกเลิก"}
          </Button>
          <Button type="button" size="sm" className="h-6 text-xs px-2" disabled={!quickNote.trim() || savingQuickNote} onClick={submitQuickNote}>
            {savingQuickNote ? <Loader2 className="w-3 h-3 animate-spin" /> : (editingNoteId ? "อัปเดต" : "บันทึก")}
          </Button>
        </div>
      </div>
    </div>
  );

  const getChildDetail = (child: any) => {
    if (!elementDetails) return null;
    const key = `${item.id}-${child.type}-${child.referenceId || child.refId || child.id}`;
    return elementDetails.get(key);
  };

  const thisIdeaNotes = (ideaNotes || [])
    .filter((n) => n.canvasItemId === item.id && n.elementType === 'idea_note')
    .sort((a, b) => (a.noteOrder ?? 0) - (b.noteOrder ?? 0));

  const children = item.children || [];
  const getDetailPageUrl = () => (novelId ? `/dashboard/project/${novelId}/idea` : null);

  return (
    <PopoverContent
      side="right"
      align="start"
      sideOffset={12}
      collisionPadding={16}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onInteractOutside={(e) => e.preventDefault()}
      className="w-[315px] max-w-[92vw] max-h-[56vh] overflow-y-auto p-0"
    >
        <FilmSprockets count={15} />
        <div className="p-4 space-y-4">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-left">
              <span className="font-technical text-[10px] tracking-widest text-muted-foreground/60 shrink-0">
                {frameNumber(item)}
              </span>
              <span className="text-sm font-semibold flex-1 min-w-0 truncate">{item.title}</span>
              {item.isNarration && (
                <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                  <Quote className="w-3 h-3" fill="currentColor" /> บรรยาย
                </span>
              )}
              <button
                onClick={onClose}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="ปิด"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {item.content && typeof item.content === 'string' && (
              <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.content}</p>
            )}
          </div>

          {/* เหตุการณ์สำคัญ */}
          {editingKeyMoment ? (
            <div className="flex items-center gap-1.5 chamfered-sm bg-amber-500/15 border border-amber-500/50 px-2 py-1">
              <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" />
              <input
                autoFocus
                value={keyMomentDraft}
                onChange={(e) => setKeyMomentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onSetKeyMoment?.(keyMomentDraft.trim() || null); setEditingKeyMoment(false); }
                  if (e.key === 'Escape') { setKeyMomentDraft(item.keyMomentLabel || ""); setEditingKeyMoment(false); }
                }}
                onBlur={() => { onSetKeyMoment?.(keyMomentDraft.trim() || null); setEditingKeyMoment(false); }}
                placeholder="เช่น พระเอกชนะ, ตัวร้ายตาย…"
                className="flex-1 min-w-0 h-6 bg-transparent text-xs font-semibold text-amber-900 dark:text-amber-100 placeholder:text-amber-500/60 placeholder:font-normal focus:outline-none"
              />
            </div>
          ) : item.keyMomentLabel ? (
            <button
              onClick={() => { setKeyMomentDraft(item.keyMomentLabel); setEditingKeyMoment(true); }}
              className="group/km w-full flex items-center gap-1.5 chamfered-sm bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-300/60 pl-2 pr-2.5 py-1 text-left shadow-sm shadow-amber-500/30 hover:from-amber-300 hover:to-amber-400 transition-colors"
              title="แก้ไขเหตุการณ์สำคัญ"
            >
              <Star className="w-3.5 h-3.5 text-amber-950 shrink-0" fill="currentColor" />
              <span className="font-technical text-[8px] uppercase tracking-[0.14em] text-amber-900/70 shrink-0">จุดสำคัญ</span>
              <span className="flex-1 min-w-0 truncate text-xs font-bold text-amber-950">{item.keyMomentLabel}</span>
              <Pencil className="w-3 h-3 text-amber-900/50 shrink-0 opacity-0 group-hover/km:opacity-100 transition-opacity" />
            </button>
          ) : onSetKeyMoment ? (
            <button
              onClick={() => { setKeyMomentDraft(""); setEditingKeyMoment(true); }}
              className="w-full flex items-center gap-1.5 chamfered-sm border border-dashed border-border/60 px-2.5 py-1 text-left text-xs text-muted-foreground hover:border-amber-500/50 hover:text-amber-600 transition-colors"
            >
              <Star className="w-3.5 h-3.5 shrink-0" />
              ทำเครื่องหมายเหตุการณ์สำคัญ
            </button>
          ) : null}

          {/* ปมเรื่องที่ผูกกับการ์ดนี้ */}
          {threadBeats && threadBeats.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {threadBeats.map(b => {
                const roleLabel = b.role === 'seed' ? 'หว่าน' : b.role === 'reinforce' ? 'ย้ำ' : b.role === 'payoff' ? 'เฉลย' : b.role;
                return (
                  <button
                    key={b.beatId}
                    onClick={() => onOpenThreadBind?.()}
                    className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full border text-[10px] font-medium hover:brightness-95 transition"
                    style={{ borderColor: (b.color ?? '#f59e0b') + '66', background: (b.color ?? '#f59e0b') + '1a', color: b.color ?? '#b45309' }}
                    title={`ปม: ${b.title} · ${roleLabel}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: b.color ?? '#f59e0b' }} />
                    <span className="truncate max-w-[140px]">{b.title}</span>
                    <span className="opacity-70">· {roleLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* WHO — Characters + Factions รวมกัน */}
          {children.some((c: any) => ['character', 'dummy_character', 'faction', 'dummy_faction'].includes(c.type)) && (
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50">WHO</p>
              <div className="divide-y divide-border/40">
                {children
                  .filter((c: any) => c.type === 'character' || c.type === 'dummy_character')
                  .map((child: any) => {
                    const detail = getChildDetail(child);
                    const isDummy = child.type === 'dummy_character';
                    const rm = roleMeta(detail?.role || child.role);
                    return (
                      <div key={child.id} className="py-1 text-xs group/item">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", rm.dot)} />
                          <span className={cn("truncate font-medium text-foreground", isDummy && "italic text-muted-foreground")}>
                            {child.title}{isDummy && <span className="text-[10px] text-muted-foreground font-normal ml-1">(Dummy)</span>}
                          </span>
                          <span className={cn("text-[10px] shrink-0", rm.text)}>{rm.label}</span>
                          <span className="flex-1" />
                          {onEditChild && (
                            <button onClick={() => onEditChild({ ...child, canvasItemId: item.id })} className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0" title="แก้ไขรายละเอียด">
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {onRemoveChild && (
                            <button onClick={() => onRemoveChild(child.id)} className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {detail?.action && (
                          <p className="mt-0.5 ml-3 text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap">{detail.action}</p>
                        )}
                      </div>
                    );
                  })}
                {children
                  .filter((c: any) => c.type === 'faction' || c.type === 'dummy_faction')
                  .map((child: any) => {
                    const detail = getChildDetail(child);
                    const isDummy = child.type === 'dummy_faction';
                    const realFaction = !isDummy ? factions?.find((f: any) => f.id === child.referenceId) : null;
                    const factionBlurb: string | null = realFaction?.goal || realFaction?.description || null;
                    const allLinkedIdeas: any[] = realFaction?.linkedIdeaIds
                      ? realFaction.linkedIdeaIds.map((id: string) => ideas?.find((i: any) => i.id === id)).filter(Boolean)
                      : [];
                    const linkedIdeas = child.pinnedIdeaIds
                      ? allLinkedIdeas.filter((i: any) => child.pinnedIdeaIds.includes(i.id))
                      : allLinkedIdeas;
                    const togglePinnedIdea = (ideaId: string) => {
                      const current: string[] = child.pinnedIdeaIds ?? allLinkedIdeas.map((i: any) => i.id);
                      const next = current.includes(ideaId) ? current.filter((id) => id !== ideaId) : [...current, ideaId];
                      onUpdateChild?.(item.id, child.id, { pinnedIdeaIds: next });
                    };
                    return (
                      <div key={child.id} className="py-1 text-xs group/item">
                        <div className="flex items-center gap-1.5">
                          <Shield className={cn("w-3 h-3 shrink-0", isDummy ? "text-muted-foreground" : "text-emerald-500")}
                            style={!isDummy && realFaction?.color ? { color: realFaction.color } : undefined} />
                          <span className={cn("truncate font-medium text-foreground", isDummy && "italic text-muted-foreground")}>
                            {child.title}{isDummy && <span className="text-[10px] text-muted-foreground font-normal ml-1">(Dummy)</span>}
                          </span>
                          {realFaction?.type && (
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 shrink-0">{realFaction.type}</span>
                          )}
                          <span className="flex-1" />
                          {onEditChild && (
                            <button onClick={() => onEditChild({ ...child, canvasItemId: item.id })} className="opacity-0 group-hover/item:opacity-100 hover:text-emerald-500 transition-opacity shrink-0" title="แก้ไขรายละเอียด">
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {onRemoveChild && (
                            <button onClick={() => onRemoveChild(child.id)} className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity shrink-0">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {detail?.action && (
                          <p className="mt-0.5 ml-[18px] text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap">{detail.action}</p>
                        )}
                        {!detail?.action && factionBlurb && (
                          <p className="mt-0.5 ml-[18px] text-[11px] leading-snug text-muted-foreground/80 line-clamp-2 whitespace-pre-wrap">{factionBlurb}</p>
                        )}
                        {linkedIdeas.length > 0 && (
                          <div className="mt-1 ml-[18px] flex flex-wrap items-center gap-1">
                            {linkedIdeas.map((idea: any) => (
                              <span key={idea.id}
                                className="group/idea inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                                title={idea.summary || idea.content || idea.title}>
                                <Lightbulb className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate max-w-[140px]">{idea.title}</span>
                                {onUpdateChild && (
                                  <button onClick={() => togglePinnedIdea(idea.id)} className="shrink-0 opacity-40 hover:opacity-100 hover:text-destructive transition-opacity" title="ซ่อนไอเดียนี้ออกจากการ์ด">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {allLinkedIdeas.length > linkedIdeas.length && onUpdateChild && (
                              <button onClick={() => onUpdateChild(item.id, child.id, { pinnedIdeaIds: undefined })} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                                +{allLinkedIdeas.length - linkedIdeas.length} ซ่อนอยู่ · แสดงทั้งหมด
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* WHERE — Locations */}
          {children.some((c: any) => c.type === 'location') && (
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50">WHERE</p>
              <div className="divide-y divide-border/40">
                {children
                  .filter((c: any) => c.type === 'location')
                  .map((child: any) => {
                    const detail = getChildDetail(child);
                    const hasDetail = detail && (detail.action || detail.how || detail.goal);
                    return (
                      <div key={child.id} className="flex items-center gap-1.5 py-1 text-xs group/item">
                        <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                        <span className="truncate font-medium">{child.title}</span>
                        {hasDetail && (
                          <span className="truncate text-[10px] text-muted-foreground/80 min-w-0">
                            {detail.action && `· ${detail.action}`}
                          </span>
                        )}
                        <span className="flex-1" />
                        {onEditChild && (
                          <button onClick={() => onEditChild({ ...child, canvasItemId: item.id })} className="opacity-0 group-hover/item:opacity-100 hover:text-green-500 transition-opacity shrink-0" title="แก้ไขรายละเอียด">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {onRemoveChild && (
                          <button onClick={() => onRemoveChild(child.id)} className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* WHY — Ancestor Connections */}
          {ancestorConnections && ancestorConnections.length > 0 && (
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-amber-500/60 mb-1">WHY</p>
              <div className="flex flex-wrap gap-1">
                {ancestorConnections.map((conn) => {
                  const ancestorTitle = conn.label || conn.targetIdeaTitle || conn.targetIdeaId.slice(0, 8) + '...';
                  const categoryLabels: Record<string, string> = {
                    plot: 'พล็อต', character: 'ตัวละคร', worldbuilding: 'สร้างโลก', subplot: 'เนื้อรอง', general: 'ทั่วไป',
                  };
                  return (
                    <Popover key={conn.id}>
                      <div className="group/ancestor inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[10px] font-medium">
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-1 cursor-pointer text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors">
                            <GitBranchPlus className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[110px]">{ancestorTitle}</span>
                          </button>
                        </PopoverTrigger>
                        {onRemoveAncestor && (
                          <button onClick={() => onRemoveAncestor(conn.id)} className="opacity-0 group-hover/ancestor:opacity-100 hover:text-destructive transition-opacity text-amber-500/70 shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <PopoverContent side="top" align="start" className="w-72 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                          <p className="text-sm font-semibold truncate">{conn.targetIdeaTitle || 'Idea'}</p>
                        </div>
                        {conn.targetIdeaCategory && (
                          <span className="inline-block text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                            {categoryLabels[conn.targetIdeaCategory] || conn.targetIdeaCategory}
                          </span>
                        )}
                        {conn.label && (
                          <div className="flex items-start gap-1.5">
                            <MessageCircle className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground/80 italic">{conn.label}</p>
                          </div>
                        )}
                        {conn.targetIdeaContent ? (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">{conn.targetIdeaContent}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic">ไม่มีเนื้อหาเพิ่มเติม</p>
                        )}
                        {conn.targetIdeaNotes && conn.targetIdeaNotes.length > 0 && (
                          <div className="pt-2 border-t border-border/60 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                              <BookOpen className="w-3 h-3" /> Notes
                            </p>
                            {conn.targetIdeaNotes.map((note, idx) => (
                              <p key={idx} className="text-xs text-foreground/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1 whitespace-pre-wrap">{note}</p>
                            ))}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  );
                })}
              </div>
            </div>
          )}

          {/* รายการอื่นที่ไม่เข้าหมวดไหน */}
          {children.some((c: any) => !['character', 'dummy_character', 'faction', 'dummy_faction', 'location', 'sticky-note'].includes(c.type)) && (
            <div className="divide-y divide-border/40">
              {children
                .filter((c: any) => !['character', 'dummy_character', 'faction', 'dummy_faction', 'location', 'sticky-note'].includes(c.type))
                .map((child: any) => (
                  <div key={child.id} className="flex items-center gap-1.5 py-1 text-xs group/item">
                    <Lightbulb className="w-3 h-3 text-yellow-500 shrink-0" />
                    <span className="truncate flex-1">{child.title}</span>
                    {onRemoveChild && (
                      <button onClick={() => onRemoveChild(child.id)} className="opacity-0 group-hover/item:opacity-100 hover:text-destructive transition-opacity shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* ผู้เข้าร่วม */}
          {onAddChild && sceneId && novelId && onDetailSaved && (
            <div className="flex justify-end">
              <SceneParticipantsPanel
                ideaItem={item}
                sceneId={sceneId}
                novelId={novelId}
                characters={characters || []}
                factions={factions || []}
                elementDetails={elementDetails}
                onAddChild={onAddChild}
                onPromoteDummy={onPromoteDummy}
                onRemoveChild={(childId) => onRemoveChild?.(childId)}
                onDetailSaved={onDetailSaved}
              />
            </div>
          )}

          {/* HOW — Notes */}
          {onQuickAddNote && (
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50">HOW</p>
              {thisIdeaNotes.map((note) => {
                const noteColor = note.noteKind || undefined;
                return editingNoteId === note.id ? (
                  <div key={note.id}>{noteEditor}</div>
                ) : (
                  <div
                    key={note.id}
                    draggable={!!onReorderNotes}
                    onDragStart={() => setDraggedNoteId(note.id)}
                    onDragEnd={() => setDraggedNoteId(null)}
                    onDragOver={(e) => { if (draggedNoteId) e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!draggedNoteId || draggedNoteId === note.id || !onReorderNotes) return;
                      const ids = thisIdeaNotes.map((n) => n.id);
                      const fromIndex = ids.indexOf(draggedNoteId);
                      const toIndex = ids.indexOf(note.id);
                      if (fromIndex === -1 || toIndex === -1) return;
                      const reordered = [...ids];
                      reordered.splice(fromIndex, 1);
                      reordered.splice(toIndex, 0, draggedNoteId);
                      onReorderNotes(reordered);
                      setDraggedNoteId(null);
                    }}
                    className={cn(
                      "group/note relative rounded-md border px-2 py-1.5 text-xs cursor-pointer transition-colors",
                      !noteColor && "border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/15",
                      draggedNoteId === note.id && "opacity-40"
                    )}
                    style={noteColor ? { borderColor: `${noteColor}4d`, background: `${noteColor}1a` } : undefined}
                    onClick={() => {
                      setEditingNoteId(note.id);
                      setQuickNote(note.notes || "");
                      setNoteBaseline(note.notes || "");
                      setQuickNoteKind(note.noteKind ?? null);
                      setConfirmDeleteNote(false);
                      setQuickNoteOpen(true);
                    }}
                  >
                    <p className="text-foreground/90 whitespace-pre-wrap line-clamp-3 pr-4">{renderNoteMentions(note.notes || "")}</p>
                    <Pencil className="w-3 h-3 absolute top-1.5 right-1.5 text-muted-foreground opacity-0 group-hover/note:opacity-100 transition-opacity" />
                  </div>
                );
              })}
              {editingNoteId === null && quickNoteOpen ? (
                noteEditor
              ) : !quickNoteOpen ? (
                <button
                  onClick={() => { setEditingNoteId(null); setQuickNote(""); setNoteBaseline(""); setQuickNoteKind(null); setConfirmDeleteNote(false); setQuickNoteOpen(true); }}
                  className="flex items-center justify-center gap-1 w-full text-xs text-yellow-700/70 dark:text-yellow-500/70 hover:text-yellow-800 dark:hover:text-yellow-400 border border-dashed border-yellow-500/30 hover:border-yellow-500/50 hover:bg-yellow-500/5 rounded-md px-2 py-1.5 transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  เพิ่มโน้ต
                </button>
              ) : null}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            {getDetailPageUrl() ? (
              <Link href={getDetailPageUrl()!} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink className="w-3 h-3" />
                ดูรายละเอียดเต็ม
              </Link>
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCopy}>
                <Copy className="w-3 h-3" /> คัดลอกข้อมูล
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" onClick={onClose}>
                ปิด
              </Button>
            </div>
          </div>
        </div>
        <FilmSprockets count={15} />
    </PopoverContent>
  );
}
