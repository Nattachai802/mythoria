"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Users, MapPin, X, Link as LinkIcon, Pencil, ExternalLink, Copy,
  GitBranchPlus, Shield, Check, MoreVertical, Loader2, Star, MessageCircle,
  BookOpen, Quote, StickyNote as StickyNoteIcon, Lightbulb, Sparkles,
  Swords, RotateCcw, Flame, CheckCircle2, Route, GripVertical, CornerDownRight, Zap, Gem, PawPrint, Layers, User, ChevronDown, MoreHorizontal, Plus,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { noteToPlain, noteIsEmpty, noteTemplate, withTemplate, looksLikeDialogue, NOTE_TEMPLATES, type NoteTemplate } from "@/lib/note-text";
import { RichNoteEditor, NoteView, ClampedNote } from "./rich-note-editor";
import { SceneElementDetails } from "@/db/schema";
import { SceneParticipantsPanel, PromoteDummyButton } from "./scene-participants-panel";
import { kindOf, canContainChild } from "@/lib/participant-types";
import { resolveNesting, NEST_TOP } from "@/lib/participant-nest";
import { CharacterThroughLine } from "./character-through-line";
import { IdeaDramaticPanel } from "./idea-dramatic-panel";
import { EchoGuessBadge } from "./echo-score-panel";
import { runEchoScore } from "@/server/plot-analysis";
import type { EchoFinding } from "@/lib/echo-score";
import { SCENE_TYPES, OUTCOMES } from "@/lib/scene-dramatic";

// ไอคอนย่อบนการ์ดที่ย่อ — บอกประเภทฉาก (Unified Scene Framework) ให้เห็นทั้งบอร์ดโดยไม่ต้องเปิดทีละใบ
const SCENE_TYPE_ICONS: Record<string, typeof BookOpen> = {
  setup: BookOpen, action: Swords, reaction: RotateCcw, climax: Flame, resolution: CheckCircle2,
};

// ป้ายสีจัดกลุ่มโน้ต — เดิมอยู่ใน canvas-item.tsx ย้ายมาที่นี่เพราะใช้เฉพาะระบบโน้ตของ idea
const CARD_COLORS = ["#f59e0b", "#fb923c", "#f43f5e", "#a78bfa", "#6366f1", "#22d3ee", "#34d399", "#facc15", "#e879f9", "#94a3b8"];

// ต้องตรงกับ ROLES ใน scene-participants-panel
const ROLE_META: Record<string, { label: string; text: string; dot: string }> = {
  protagonist: { label: 'ตัวหลัก', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  antagonist: { label: 'ฝ่ายตรงข้าม', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  witness: { label: 'ผู้เห็นเหตุ', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  victim: { label: 'เหยื่อ', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
};
// ไอคอนตามชนิดผู้ร่วมฉาก — registry เก็บชื่อไอคอนเป็น string ฝั่ง UI map เอง
const NODE_ICONS: Record<string, typeof User> = { User, Shield, Zap, Gem, PawPrint, Layers };

const roleMeta = (role?: string) => ROLE_META[(role || 'protagonist').toLowerCase()] ?? ROLE_META.protagonist;

// เลขเดิมยึด beatIndex อย่างเดียว การ์ดร่วมจังหวะจึงเลขซ้ำกันหมด — ตัวจริงคือ #LBBN ที่ board คำนวณให้
// fallback ไว้กันการ์ดที่ไม่ได้มาจาก board (drag overlay ฯลฯ) แสดงช่องว่าง
const frameNumber = (item: any, frameNo?: string) =>
  frameNo ?? `#${String((item.beatIndex ?? 0) + 1).padStart(3, "0")}`;

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
  /** เลขการ์ด #LBBN คำนวณจาก board */
  frameNo?: string;
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
  powers?: any[];
  items?: any[];
  entities?: any[];
  worldSystems?: any[];
  participantLinks?: { charFactions?: any[]; charPowers?: any[] };
  ideas?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onUpdateChild?: (parentId: string, childId: string, patch: any) => void;
  onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
  onSetColor?: (color: string | null) => void;
  onSetSceneDrama?: (patch: Record<string, unknown>) => void;
  tonePresets?: { id: string; label: string; color: string }[];
  onSetKeyMoment?: (label: string | null) => void;
  onRenameIdea?: (title: string) => void;
  onSetNarration?: (isNarration: boolean) => void;
  threadBeats?: ThreadBeat[];
  onOpenThreadBind?: () => void;
  sceneEchoFinding?: EchoFinding; // ผล Echo Score ของฉาก (จาก PlaygroundBoard) ผูกตาม cardId — ต่างจาก echoFinding state ด้านล่างที่ยิงเฉพาะการ์ดนี้ตอนเปิด dialog
  onEchoResult?: (finding: EchoFinding) => void; // แจ้ง PlaygroundBoard เมื่อรัน Echo เฉพาะการ์ดนี้เสร็จ กัน badge มุมการ์ดกับผลใน dialog ไม่ตรงกัน
}

// การ์ดหน้าตา "เฟรมฟิล์ม" แบบย่อบน canvas — กดเพื่อเปิดรายละเอียดเต็มใน IdeaFrameDialog
export function IdeaFilmCard(props: IdeaFilmCardProps) {
  const {
    item, frameNo, onRemove, onRemoveChild, isDragging, isOverlay, isOver, isLinkingSource, onLinkStart,
    elementDetails, onEditChild, ideaNotes, onQuickAddNote, onDeleteNote, onReorderNotes, novelId,
    onSetAncestor, ancestorConnections, onRemoveAncestor, sceneId, characters, novelDummyNames,
    factions, powers, items, entities, worldSystems, participantLinks, ideas, onAddChild, onUpdateChild, onPromoteDummy, onDetailSaved, onSetColor,
    onSetSceneDrama,
    tonePresets = [], onSetKeyMoment, onRenameIdea, onSetNarration, threadBeats, onOpenThreadBind,
    sceneEchoFinding, onEchoResult,
  } = props;

  const [dialogOpen, setDialogOpen] = useState(false);

  const isKeyMoment = !!item.keyMomentLabel;
  const widthClass = isOverlay ? 'w-72' : 'w-full';

  const children = item.children || [];
  // ชื่อคน/ฝ่ายบนการ์ดย่อ — สะท้อนโครงชั้นแบบย่อ "ฝ่าย › สมาชิก" แทนลิสต์แบน
  // ไม่ทำเป็นต้นไม้จริงเพราะการ์ดกว้าง 280px เยื้องแล้วอ่านไม่ออก (P-nest)
  const peopleNames = (() => {
    const PEOPLE = ['character', 'dummy_character', 'faction', 'dummy_faction'];
    const kids = children.filter((c: any) => c.type !== 'sticky-note');
    const links = resolveNesting(kids, {
      charFactions: participantLinks?.charFactions,
      charPowers: participantLinks?.charPowers,
      items: items as any[],
      powers: powers as any[],
    });
    const people = kids.filter((c: any) => PEOPLE.includes(c.type));
    const parentOf = (c: any) => links.get(c.id)?.parentId ?? null;
    return people
      .filter((c: any) => !people.some((p: any) => p.id === parentOf(c)))
      .map((c: any) => {
        const under = people.filter((k: any) => parentOf(k) === c.id).map((k: any) => k.title);
        return under.length > 0 ? `${c.title} › ${under.join(', ')}` : c.title;
      });
  })();
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
    const notes = thisIdeaNotes.map((n) => noteToPlain(n.notes)).join('\n') || '';
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
              {frameNumber(item, frameNo)}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {item.isNarration && <Quote className="w-3 h-3 text-amber-500" fill="currentColor" />}
              {isKeyMoment && <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />}
              {item.sceneType && SCENE_TYPE_ICONS[item.sceneType] && (() => {
                const SceneTypeIcon = SCENE_TYPE_ICONS[item.sceneType];
                return (
                  <span title={SCENE_TYPES[item.sceneType as keyof typeof SCENE_TYPES]?.label} className="flex items-center">
                    <SceneTypeIcon className="w-3 h-3 text-muted-foreground" />
                  </span>
                );
              })()}
              {sceneEchoFinding && <EchoGuessBadge finding={sceneEchoFinding} />}
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

          <div className="flex items-start gap-2.5 pt-0.5 text-[11px] text-muted-foreground/90 min-w-0">
            {peopleNames.length > 0 && (
              <span className="flex items-start gap-1 min-w-0 flex-1" title={peopleNames.join(', ')}>
                <Users className="w-3 h-3 shrink-0 mt-[2px]" />
                {/* ชื่อยาวขึ้นบรรทัดใหม่แทนตัดท้ายด้วย … — ชื่อตัวละครตัดแล้วเดาไม่ออกว่าใคร */}
                <span className="break-words">{peopleNames.join(', ')}</span>
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
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        item={item}
        frameNo={frameNo}
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
        powers={powers}
        items={items}
        entities={entities}
        worldSystems={worldSystems}
        participantLinks={participantLinks}
        ideas={ideas}
        onAddChild={onAddChild}
        onUpdateChild={onUpdateChild}
        onPromoteDummy={onPromoteDummy}
        onDetailSaved={onDetailSaved}
        onSetKeyMoment={onSetKeyMoment}
        onRenameIdea={onRenameIdea}
        onSetSceneDrama={onSetSceneDrama}
        onOpenThreadBind={onOpenThreadBind}
        threadBeats={threadBeats}
        onCopy={copyToClipboard}
        onEchoResult={onEchoResult}
      />
      </Popover>
    </div>
  );
}

interface IdeaFrameDialogProps {
  /**
   * แผงเปิดอยู่ไหม — ต้องรู้เพื่อล้างตำแหน่งที่ลากไว้ตอนปิด
   * Radix ถอดเฉพาะ DOM ของ PopoverContent ตอนปิด แต่ตัว component นี้เป็นพ่อของมัน
   * จึงไม่ถูก unmount · state ตำแหน่งเลยค้างข้ามรอบเปิด-ปิดถ้าไม่ล้างเอง
   */
  open: boolean;
  onClose: () => void;
  item: any;
  frameNo?: string;
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
  powers?: any[];
  items?: any[];
  entities?: any[];
  worldSystems?: any[];
  participantLinks?: { charFactions?: any[]; charPowers?: any[] };
  ideas?: any[];
  onAddChild?: (ideaId: string, child: any) => void;
  onUpdateChild?: (parentId: string, childId: string, patch: any) => void;
  onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void;
  onDetailSaved?: (detail: SceneElementDetails) => void;
  onSetKeyMoment?: (label: string | null) => void;
  onRenameIdea?: (title: string) => void;
  onSetSceneDrama?: (patch: Record<string, unknown>) => void;
  onOpenThreadBind?: () => void;
  threadBeats?: ThreadBeat[];
  onCopy: () => void;
  onEchoResult?: (finding: EchoFinding) => void;
}

/** คลิกนอกแผงสองครั้งห่างกันไม่เกินนี้ = สั่งปิด (ค่าเดียวกับ dblclick ของเบราว์เซอร์คร่าว ๆ) */
const DOUBLE_CLICK_MS = 400;

// รายละเอียดเต็มของไอเดีย — ลอยข้างการ์ดแบบ hovercard (Popover) แทน dialog กลางจอ
// เพื่อให้เปิดดูได้พร้อมกันหลายใบสำหรับเทียบ ๆ กัน — ไม่บังพื้นหลัง ไม่ auto-close ตอนคลิกการ์ดอื่น
// ปิดได้ 3 ทาง: ปุ่มกากบาท · Esc · ดับเบิลคลิกนอกแผง
function IdeaFrameDialog({
  open, onClose, item, frameNo, elementDetails, onEditChild, onRemoveChild, ideaNotes,
  onQuickAddNote, onDeleteNote, onReorderNotes, novelId, ancestorConnections, onRemoveAncestor,
  sceneId, characters, novelDummyNames, factions, powers, items, entities, worldSystems, participantLinks, ideas, onAddChild, onUpdateChild,
  onPromoteDummy, onDetailSaved, onSetKeyMoment, onRenameIdea, onSetSceneDrama, onOpenThreadBind, threadBeats, onCopy,
  onEchoResult,
}: IdeaFrameDialogProps) {
  const [quickNote, setQuickNote] = useState("");
  const [tab, setTab] = useState<"people" | "notes">("people");
  // เปิดการ์ดใบใหม่ → กลับมาที่ "คนในฉาก" เสมอ (ไม่งั้นค้างแท็บโน้ตจากการ์ดก่อนหน้า)
  useEffect(() => { setTab("people"); }, [item.id]);
  // ดราม่า: กางเมื่อมีข้อมูล พับเมื่อว่าง (เปิดการ์ดใบใหม่ = ตั้งค่าเริ่มต้นใหม่)
  const hasDrama = !!(item.sceneGoal || item.sceneConflict || item.sceneOutcome || item.valueShift != null);
  const [dramaOpen, setDramaOpen] = useState(hasDrama);
  useEffect(() => { setDramaOpen(hasDrama); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [savingQuickNote, setSavingQuickNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null); // null = สร้างใหม่, id = แก้ไขโน้ตเดิม
  const [quickNoteKind, setQuickNoteKind] = useState<string | null>(null); // null = ทั่วไป
  const [deletingNote, setDeletingNote] = useState(false);
  const [noteBaseline, setNoteBaseline] = useState("");
  const [quickNoteTpl, setQuickNoteTpl] = useState<NoteTemplate>("plain"); // รูปแบบแสดงผลของโน้ต ผู้ใช้เลือกเอง
  const [noteTplBaseline, setNoteTplBaseline] = useState<NoteTemplate>("plain");
  const [confirmDeleteNote, setConfirmDeleteNote] = useState(false);
  const [confirmDiscardNote, setConfirmDiscardNote] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  // ดูเส้นเรื่องข้ามฉาก — เดิมอยู่ใน popover ผู้เข้าร่วม ย้ายมาที่แถวรายชื่อในไดอะล็อกนี้
  const [throughLine, setThroughLine] = useState<{ type: "character" | "faction"; id: string; name: string } | null>(null);

  // ลากแผงไปวางที่อื่นได้ — เปิดการ์ดสองใบพร้อมกันแล้วมันทับกัน อ่านเทียบไม่ได้
  // offset ทับบน transform ของ Radix (Radix จัดตำแหน่งที่ wrapper ชั้นนอก ตัวนี้อยู่ชั้นใน จึงไม่ตีกัน)
  // ponytail: ตำแหน่งอยู่ใน state ของแผง ปิดแล้วรีเซ็ต — ถ้าอยากให้จำ ค่อยยกไปเก็บที่ canvasData
  // พอเริ่มลาก ตัดแผงออกจากกล่องจัดตำแหน่งของ Radix ไปเลย: จำพิกัดบนจอ ณ ตอนนั้น
  // แล้วสลับเป็น position:fixed — เนื้อแผงหลุดจาก flow กล่องนอกจึงยุบเหลือ 0x0
  // (แค่ปิด pointer-events ไม่พอ กล่องยังกางค้างทับการ์ดใบข้าง ๆ จนกดไม่ได้)
  // เก็บขนาดแผงไว้ด้วย ไม่ใช่แค่มุมบนซ้าย — ขอบเขตการลากต้องรู้ว่าแผงกว้าง/สูงเท่าไหร่
  // ถึงจะกันไม่ให้ "ท้ายแผง" หลุดจอได้ (เดิมใช้เลขคงที่ 80/60 ซึ่งไม่รู้ขนาดจริง
  // แผงที่โน้ตเยอะจึงยาวเลยขอบล่าง และฝั่งขวาหลุดไป ~235px ของความกว้าง 315px)
  const [floatAt, setFloatAt] = useState<{ left: number; top: number; w: number; h: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragFrom = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // ปิดแผง = ทิ้งตำแหน่งที่ลากไว้ ให้ Radix จัดตำแหน่งใหม่ตอนเปิดครั้งหน้า
  // (Radix หลบขอบจอให้เองด้วย collisionPadding อยู่แล้ว แต่พอ floatAt มีค่า
  //  style จะทับเป็น absolute 0,0 + transform ซึ่งตัด Radix ออกจากการจัดตำแหน่งไปเลย)
  useEffect(() => {
    if (!open) {
      setDragPos(null);
      setFloatAt(null);
    }
  }, [open]);

  const PAD = 8; // ระยะเว้นจากขอบจอ

  /**
   * บีบ offset ให้แผง "ทั้งใบ" อยู่ในจอ
   * แผงใหญ่กว่าจอ (โน้ตเยอะจนสูงเกิน) → ยึดขอบบน/ซ้ายแล้วปล่อยให้ scroll ในตัวเอง
   * ดีกว่าดันไปชิดขอบล่างซึ่งทำให้หัวแผงที่ใช้ลากหลุดจอไป
   */
  const clampOffset = (nx: number, ny: number, box: { left: number; top: number; w: number; h: number }) => {
    const fit = (v: number, origin: number, size: number, viewport: number) => {
      const lo = PAD - origin;
      const hi = viewport - PAD - size - origin;
      return hi < lo ? lo : Math.min(Math.max(v, lo), hi);
    };
    return {
      x: fit(nx, box.left, box.w, window.innerWidth),
      y: fit(ny, box.top, box.h, window.innerHeight),
    };
  };

  const startDrag = (e: React.PointerEvent) => {
    // เว้นของที่กดได้ในแถวหัว (ปุ่มปิด, ช่องแก้ชื่อ, ชื่อที่กดเพื่อแก้)
    if ((e.target as HTMLElement).closest("button,input,[data-no-drag]")) return;
    if (!floatAt && contentRef.current) {
      const r = contentRef.current.getBoundingClientRect();
      setFloatAt({ left: r.left, top: r.top, w: r.width, h: r.height });
    }
    const cur = dragPos ?? { x: 0, y: 0 };
    dragFrom.current = { sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation(); // กันกระดานเอาไปใช้ลากการ์ด
  };
  const onDrag = (e: React.PointerEvent) => {
    const d = dragFrom.current;
    if (!d || !floatAt) return;
    setDragPos(clampOffset(d.ox + e.clientX - d.sx, d.oy + e.clientY - d.sy, floatAt));
  };
  // Radix จัดตำแหน่งที่ div ครอบชั้นนอก (popper wrapper) ส่วนเราขยับแต่เนื้อในด้วย transform
  // ผลคือ wrapper ยังกินพื้นที่กล่องเดิมค้างไว้ ทับการ์ดใบข้าง ๆ จนกดไม่ได้แม้ลากแผงหนีไปแล้ว
  // ปิด pointer-events ที่ wrapper แล้วเปิดคืนเฉพาะเนื้อใน — กล่องผีเลยโปร่งให้คลิกทะลุ
  const contentRef = useRef<HTMLDivElement | null>(null);

  // ปิดแผงด้วยการคลิกนอกแผงสองครั้งติด — คลิกเดียวยังไม่ปิด เพราะตั้งใจให้เปิดหลายใบ
  // เทียบกันได้ กดการ์ดใบข้าง ๆ หรือลากกระดานแล้วแผงต้องไม่หาย
  // นับเองด้วยเวลา ไม่ใช้ event.detail เพราะ pointerdown ในบางเบราว์เซอร์ให้ 0 เสมอ
  const noteDirty = quickNoteOpen && !noteIsEmpty(quickNote) && (quickNote !== noteBaseline || quickNoteTpl !== noteTplBaseline);

  const lastOutsideAt = useRef(0);
  const handleInteractOutside = (e: { preventDefault: () => void }) => {
    // มีโน้ตพิมพ์ค้างอยู่ = ไม่ปิดไม่ว่ากดกี่ครั้ง (ปุ่มกากบาทกับ Esc ก็ไม่ควรกินของหาย
    // แต่ตรงนี้คือทางที่เผลอง่ายสุด — คลิกพลาดนอกแผงสองที)
    if (noteDirty) {
      e.preventDefault();
      toast.info("มีโน้ตที่ยังไม่ได้บันทึก — กดบันทึกหรือยกเลิกก่อนปิดแผง");
      return;
    }
    const now = Date.now();
    const isDouble = now - lastOutsideAt.current < DOUBLE_CLICK_MS;
    lastOutsideAt.current = isDouble ? 0 : now; // ปิดแล้วเริ่มนับใหม่ ไม่ให้คลิกที่สามพ่วงต่อ
    if (!isDouble) e.preventDefault();
  };

  // โน้ตไม่มี autosave (เซฟตอนกดปุ่มเท่านั้น) — เตือนก่อนปิดแท็บ/รีเฟรช/ออกไปเว็บอื่น
  // ceiling: เปลี่ยนหน้าในแอปเอง (next/link) ไม่ยิง beforeunload — แผงถูก unmount ไปเงียบ ๆ
  // ถ้าจะกันเคสนั้นด้วยต้องดัก router event ซึ่งต้องแก้นอกไฟล์นี้
  useEffect(() => {
    if (!noteDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // เบราว์เซอร์เก่ายังต้องการค่านี้ถึงจะขึ้นกล่องยืนยัน
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [noteDirty]);

  useEffect(() => {
    const wrapper = contentRef.current?.parentElement;
    if (wrapper) wrapper.style.pointerEvents = "none";
  }, []);

  const endDrag = (e: React.PointerEvent) => {
    if (!dragFrom.current) return;
    dragFrom.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title ?? "");
  const commitTitle = () => {
    const clean = titleDraft.trim();
    setEditingTitle(false);
    if (!clean || clean === item.title) { setTitleDraft(item.title ?? ""); return; }
    onRenameIdea?.(clean);
  };

  const [editingKeyMoment, setEditingKeyMoment] = useState(false);
  const [keyMomentDraft, setKeyMomentDraft] = useState(item.keyMomentLabel || "");

  // Echo Score เฉพาะการ์ดนี้ — scope เดียวกับ EchoScorePanel แต่ยิงแค่การ์ดเดียว
  const [echoFinding, setEchoFinding] = useState<EchoFinding | null>(null);
  const [echoStatus, setEchoStatus] = useState<'idle' | 'pending' | 'empty' | 'error'>('idle');
  const runCardEcho = async () => {
    if (!novelId || !sceneId) return;
    setEchoStatus('pending');
    const result = await runEchoScore(novelId, sceneId, [item.id]);
    if (!result.success) { setEchoStatus('error'); toast.error(result.error); return; }
    if (result.findings.length === 0) { setEchoStatus('empty'); return; }
    setEchoFinding(result.findings[0]);
    setEchoStatus('idle');
    onEchoResult?.(result.findings[0]); // sync ให้ badge มุมการ์ด (state ของ PlaygroundBoard) เห็นผลใหม่ด้วย
  };

  // @mention ในโน้ต — เฉพาะ character ที่เป็น children ของการ์ดนี้
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
        <span key={m.index} className="rounded bg-amber-500/10 px-0.5 font-medium text-amber-700 dark:text-amber-300">
          @{m[1]}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const submitQuickNote = async () => {
    if (noteIsEmpty(quickNote) || !onQuickAddNote) return;
    const text = withTemplate(quickNote, quickNoteTpl, allMentionChars);
    setSavingQuickNote(true);
    scrollToNewNote.current = !editingNoteId;
    await onQuickAddNote(item, text, editingNoteId ?? undefined, quickNoteKind ?? undefined);
    setSavingQuickNote(false);
    resetQuickNote();
  };

  const resetQuickNote = () => {
    setQuickNote("");
    setQuickNoteOpen(false);
    setEditingNoteId(null);
    setQuickNoteKind(null);
    setQuickNoteTpl("plain");
    setNoteTplBaseline("plain");
    setNoteBaseline("");
    setConfirmDeleteNote(false);
    setConfirmDiscardNote(false);
  };

  const closeQuickNote = () => {
    const dirty = !noteIsEmpty(quickNote) && (quickNote !== noteBaseline || quickNoteTpl !== noteTplBaseline);
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
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>รูปแบบ</span>
        {NOTE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setQuickNoteTpl(t.key)}
            className={cn(
              "px-2 py-0.5 rounded border transition-colors",
              quickNoteTpl === t.key ? "border-border bg-background text-foreground font-medium" : "border-transparent hover:bg-muted/60"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <RichNoteEditor
        key={editingNoteId ?? "new"}
        initial={quickNote}
        candidates={allMentionChars}
        tint={activeNoteColor}
        placeholder={allMentionChars.length > 0
          ? "เขียนโน้ต… (@ เพื่อ mention ตัวละคร, ⌘/Ctrl+Enter บันทึก)"
          : "เขียนโน้ต… (⌘/Ctrl+Enter เพื่อบันทึก)"}
        onChange={(json) => { setQuickNote(json); setConfirmDeleteNote(false); setConfirmDiscardNote(false); }}
        onSubmit={submitQuickNote}
        onCancel={closeQuickNote}
      />
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
          <Button type="button" size="sm" className="h-6 text-xs px-2" disabled={noteIsEmpty(quickNote) || savingQuickNote} onClick={submitQuickNote}>
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

  // บันทึกโน้ตใหม่แล้ว เลื่อนไปโชว์โน้ตนั้น + ไฮไลต์สั้น ๆ (โน้ตใหม่ต่อท้ายรายการ ปุ่มเพิ่มอยู่บนสุด ไม่งั้นผู้ใช้ไม่รู้ว่าโน้ตไปอยู่ไหน)
  const scrollToNewNote = useRef(false);
  const [flashNoteId, setFlashNoteId] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollToNewNote.current) return;
    scrollToNewNote.current = false;
    const last = thisIdeaNotes[thisIdeaNotes.length - 1];
    if (!last) return;
    setFlashNoteId(last.id);
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`idea-note-${last.id}`)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    });
    const t = setTimeout(() => setFlashNoteId(null), 1400);
    return () => clearTimeout(t);
  }, [thisIdeaNotes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const children = item.children || [];
  // ── โครงชั้นของ children (P-nest) ─────────────────────────────────────
  // ผูกด้วยมือผ่าน children[].parentChildId — ชี้ไปที่ child ตัวอื่นในการ์ดเดียวกัน
  // parent ที่หายไปแล้ว (ถูกลบ) ถือว่าไม่ผูก เพื่อไม่ให้ลูกหายไปจากจอ
  const treeKids = children.filter((c: any) => c.type !== 'sticky-note');
  // ผูกเอง (bind) ชนะการอนุมานจากตารางโลก (infer) เสมอ — ดู lib/participant-nest.ts
  const nestLinks = resolveNesting(treeKids, {
    charFactions: participantLinks?.charFactions,
    charPowers: participantLinks?.charPowers,
    items: items as any[],
    powers: powers as any[],
  });
  const linkOf = (c: any) => nestLinks.get(c.id) ?? null;
  const parentIdOf = (c: any) => linkOf(c)?.parentId ?? null;
  const childrenOf = (id: string | null) => treeKids.filter((c: any) => parentIdOf(c) === id);
  const treeRoots = childrenOf(null);
  /** nodeId อยู่ใต้ maybeAncestorId อยู่แล้วหรือเปล่า — กันผูกวน */
  const isUnder = (nodeId: string, maybeAncestorId: string): boolean => {
    let cur: any = treeKids.find((c: any) => c.id === nodeId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const pid = parentIdOf(cur);
      if (!pid) return false;
      if (pid === maybeAncestorId) return true;
      cur = treeKids.find((c: any) => c.id === pid);
    }
    return false;
  };
  const parentOptions = (child: any) => treeKids.filter((p: any) =>
    p.id !== child.id && canContainChild(p.type, child.type) && !isUnder(p.id, child.id));
  // null = สั่งให้อยู่ระดับบนสุด (ไม่ใช่ "ยังไม่ตั้ง" ไม่งั้นการอนุมานจะดึงกลับที่เดิม)
  // undefined = ล้างค่า กลับไปใช้การอนุมาน
  const bindTo = (child: any, parentId: string | null | undefined) =>
    onUpdateChild?.(item.id, child.id, { parentChildId: parentId === null ? NEST_TOP : parentId ?? null });

  /** ปุ่มเลือกว่า "อยู่ใต้ใคร" — ใช้ dropdown ไม่ใช่ลาก เพราะแผงแคบ 315px ลากแล้วหย่อนผิดง่าย */
  const BindButton = ({ child }: { child: any }) => {
    const opts = parentOptions(child);
    const link = linkOf(child);
    const bound = link?.source === 'bind' ? link.parentId : null;
    if (!onUpdateChild || (opts.length === 0 && !link)) return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "shrink-0 rounded p-0.5 transition-colors",
              bound ? "text-[var(--forge-amber)]/80 hover:text-[var(--forge-amber)]"
                    : "opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-foreground"
            )}
            title={bound ? "ผูกเองไว้ใต้รายการอื่น — กดเพื่อเปลี่ยน"
              : link ? "อนุมานจากข้อมูลในคลัง — กดเพื่อผูกเอง"
              : "ผูกไว้ใต้..."}
          >
            <CornerDownRight className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1" onClick={(e) => e.stopPropagation()}>
          <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 font-technical">
            ผูก “{child.title}” ไว้ใต้
          </p>
          <button
            onClick={() => bindTo(child, null)}
            className={cn("w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors",
              !link && "text-[var(--forge-amber)]")}
          >
            ไม่ผูก (ระดับบนสุด)
          </button>
          {child.parentChildId && (
            <button
              onClick={() => bindTo(child, undefined)}
              className="w-full text-left px-2 py-1.5 text-[11px] rounded text-muted-foreground hover:bg-muted transition-colors"
            >
              ใช้ข้อมูลจากคลังแทน
            </button>
          )}
          {opts.map((p: any) => (
            <button
              key={p.id}
              onClick={() => bindTo(child, p.id)}
              className={cn("w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors truncate",
                bound === p.id && "text-[var(--forge-amber)]")}
            >
              {p.title}
            </button>
          ))}
          {opts.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground italic">ไม่มีรายการที่ผูกใต้ได้</p>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  /** หนึ่งแถวในโครง + ลูกของมัน — เยื้องตามชั้น */
  const renderNode = (child: any, depth: number): React.ReactNode => {
    const kids = childrenOf(child.id);
    const link = linkOf(child);
    const nestLabel = link?.source === 'infer' ? link.label : null;
    const detail = getChildDetail(child);
    const isDummy = child.type === 'dummy_character' || child.type === 'dummy_faction';
    const isFaction = child.type === 'faction' || child.type === 'dummy_faction';
    const isCharacter = child.type === 'character' || child.type === 'dummy_character';
    const isLocation = child.type === 'location';
    const rm = roleMeta(detail?.role || child.role);
    const kind = kindOf(child.type);
    const TypeIcon = isLocation ? MapPin : (kind ? (NODE_ICONS[kind.icon] ?? Lightbulb) : Lightbulb);
    const realFaction = isFaction && !isDummy ? factions?.find((f: any) => f.id === child.referenceId) : null;
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
      <div key={child.id} style={depth > 0 ? { paddingLeft: depth * 12 } : undefined}>
        <div className="py-1 text-xs group/item">
          <div className="flex items-center gap-1.5">
            {isCharacter ? (
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", rm.dot)} />
            ) : (
              <TypeIcon
                className={cn("w-3 h-3 shrink-0", isDummy ? "text-muted-foreground" : (isLocation ? "text-green-500" : kind?.color ?? "text-yellow-500"))}
                style={realFaction?.color ? { color: realFaction.color } : undefined}
              />
            )}
            <span className={cn("truncate font-medium text-foreground", isDummy && "italic text-muted-foreground")}>
              {child.title}
              {isDummy && <span className="text-[10px] text-muted-foreground font-normal ml-1">(Dummy)</span>}
            </span>
            {isCharacter && <span className={cn("text-[10px] shrink-0", rm.text)}>{rm.label}</span>}
            {nestLabel && (
              <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/60 font-technical" title="อนุมานจากข้อมูลในคลัง — กดปุ่มลูกศรเพื่อผูกเอง">
                {nestLabel}
              </span>
            )}
            {realFaction?.type && (
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70 shrink-0">{realFaction.type}</span>
            )}
            <span className="flex-1" />
            <BindButton child={child} />
            {!isDummy && !isLocation && child.referenceId && novelId && (isCharacter || isFaction) && (
              <button
                onClick={() => setThroughLine({ type: isFaction ? 'faction' : 'character', id: child.referenceId, name: child.title })}
                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                title="ดูเส้นเรื่องข้ามฉาก"
              >
                <Route className="w-3 h-3" />
              </button>
            )}
            {isDummy && onPromoteDummy && (
              <PromoteDummyButton dummy={child} characters={characters || []} factions={factions || []} onPromote={onPromoteDummy} />
            )}
            {onEditChild && (
              <button
                onClick={() => onEditChild({ ...child, canvasItemId: item.id })}
                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                title="แก้ไขรายละเอียด"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onRemoveChild && (
              <button
                onClick={() => removeNode(child)}
                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                title="เอาออกจากไอเดีย"
              >
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

        {kids.length > 0 && (
          <div className={cn("border-l ml-[5px] pl-1",
            kids.some((k: any) => linkOf(k)?.source === 'bind')
              ? "border-[var(--forge-amber)]/40"
              : "border-dashed border-border/60")}>
            {kids.map((k: any) => renderNode(k, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  /** ลบแถว — ลูกของมันเลื่อนขึ้นระดับบนสุด ไม่ลบตาม */
  const removeNode = (child: any) => {
    const kids = childrenOf(child.id);
    kids.forEach((k: any) => onUpdateChild?.(item.id, k.id, { parentChildId: null }));
    onRemoveChild?.(child.id);
    if (kids.length > 0) toast.info(`ย้าย ${kids.length} รายการที่อยู่ใต้ “${child.title}” ขึ้นระดับบนสุด`);
  };

  const dramaCfg = SCENE_TYPES[(item.sceneType as keyof typeof SCENE_TYPES) ?? "action"] ?? SCENE_TYPES.action;
  const shortLabel = (l: string) => l.split(/ [(—]/)[0];
  const dramaOutcome = OUTCOMES.find((o) => o.value === item.sceneOutcome);
  const dramaSummary = [item.sceneGoal, dramaOutcome?.label].filter(Boolean).join(" → ") || "ยังไม่ได้ตั้งค่า";

  const getDetailPageUrl = () => (novelId ? `/dashboard/project/${novelId}/idea` : null);

  return (
    <PopoverContent
      side="right"
      align="start"
      sideOffset={12}
      collisionPadding={16}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onInteractOutside={handleInteractOutside}
      ref={contentRef}
      className="pointer-events-auto w-[420px] max-w-[92vw] max-h-[var(--radix-popover-content-available-height)] flex flex-col overflow-hidden p-0"
      style={floatAt ? {
        // absolute ไม่ใช่ fixed — กล่องนอกของ Radix มี transform อยู่ มันเลยกลายเป็น
        // containing block ของ fixed ทำให้ left/top แบบพิกัดจอเพี้ยนกระเด็นไปไกล
        // absolute ที่ 0,0 = ตำแหน่งเดิมของแผงพอดี แล้วค่อยขยับด้วย translate
        position: "absolute",
        left: 0,
        top: 0,
        margin: 0,
        transform: `translate3d(${dragPos?.x ?? 0}px, ${dragPos?.y ?? 0}px, 0)`,
      } : undefined}
    >
        <FilmSprockets count={15} />
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div
            className={cn(
              "flex items-center gap-1.5 text-left -mx-1 px-1 rounded touch-none select-none",
              "cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors"
            )}
            title="ลากเพื่อย้ายแผง · ดับเบิลคลิกเพื่อคืนตำแหน่ง"
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => { setDragPos(null); setFloatAt(null); }}
          >
            <GripVertical className="w-3 h-3 shrink-0 text-muted-foreground/40" />
            <span className="font-technical text-[11px] tracking-wider text-muted-foreground shrink-0">
              {frameNumber(item, frameNo)}
            </span>
            {editingTitle && onRenameIdea ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  e.stopPropagation(); // กัน Space/ลูกศรถูกกระดานดักไปใช้ลากการ์ด
                  if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                  if (e.key === "Escape") { e.preventDefault(); setTitleDraft(item.title ?? ""); setEditingTitle(false); }
                }}
                className="flex-1 min-w-0 bg-transparent text-[15px] font-medium border-b border-[var(--forge-amber)]/60 focus:outline-none"
              />
            ) : (
              <span
                className={`text-[15px] font-medium flex-1 min-w-0 truncate ${onRenameIdea ? "cursor-text hover:text-[var(--forge-amber)] transition-colors" : ""}`}
                data-no-drag
                title={onRenameIdea ? "กดเพื่อแก้ชื่อ" : undefined}
                onClick={onRenameIdea ? () => { setTitleDraft(item.title ?? ""); setEditingTitle(true); } : undefined}
              >
                {item.title}
              </span>
            )}
            {item.isNarration && (
              <span className="inline-flex items-center gap-1 shrink-0 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Quote className="w-3 h-3" fill="currentColor" /> บรรยาย
              </span>
            )}
            {onSetKeyMoment && (
              <button
                type="button"
                onClick={() => { setKeyMomentDraft(item.keyMomentLabel || ""); setEditingKeyMoment(true); }}
                aria-pressed={!!item.keyMomentLabel}
                aria-label={item.keyMomentLabel ? `จุดสำคัญ: ${item.keyMomentLabel}` : "ทำเครื่องหมายเหตุการณ์สำคัญ"}
                title={item.keyMomentLabel ? "แก้ไขจุดสำคัญ" : "ทำเครื่องหมายเหตุการณ์สำคัญ"}
                className={cn(
                  "shrink-0 rounded p-1 transition-[color,background-color,transform] duration-150 active:scale-90 hover:bg-muted",
                  item.keyMomentLabel ? "text-[var(--forge-amber)]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Star className="w-4 h-4" fill={item.keyMomentLabel ? "currentColor" : "none"} />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="เมนูเพิ่มเติม" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-90">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onSelect={onCopy}>
                  <Copy className="w-3.5 h-3.5" /> คัดลอก
                </DropdownMenuItem>
                {getDetailPageUrl() && (
                  <DropdownMenuItem asChild>
                    <Link href={getDetailPageUrl()!}>
                      <ExternalLink className="w-3.5 h-3.5" /> ดูรายละเอียดเต็ม
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={onClose}
              aria-label="ปิด"
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-90"
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {(editingKeyMoment || item.keyMomentLabel || (threadBeats && threadBeats.length > 0) || (ancestorConnections && ancestorConnections.length > 0)) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {editingKeyMoment ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 shrink-0 text-[var(--forge-amber)]" fill="currentColor" />
                  <input
                    autoFocus
                    value={keyMomentDraft}
                    onChange={(e) => setKeyMomentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') { onSetKeyMoment?.(keyMomentDraft.trim() || null); setEditingKeyMoment(false); }
                      if (e.key === 'Escape') { setKeyMomentDraft(item.keyMomentLabel || ""); setEditingKeyMoment(false); }
                    }}
                    onBlur={() => { onSetKeyMoment?.(keyMomentDraft.trim() || null); setEditingKeyMoment(false); }}
                    placeholder="เช่น พระเอกชนะ, ตัวร้ายตาย…"
                    className="h-6 w-52 min-w-0 bg-transparent border-b border-[var(--forge-amber)]/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </span>
              ) : item.keyMomentLabel ? (
                <button
                  type="button"
                  onClick={() => { setKeyMomentDraft(item.keyMomentLabel); setEditingKeyMoment(true); }}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  title="แก้ไขจุดสำคัญ"
                >
                  <Star className="w-3 h-3 shrink-0 text-[var(--forge-amber)]" fill="currentColor" />
                  <span className="truncate max-w-[220px]">{item.keyMomentLabel}</span>
                </button>
              ) : null}

              {threadBeats?.map((b) => {
                const roleLabel = b.role === 'seed' ? 'หว่าน' : b.role === 'reinforce' ? 'ย้ำ' : b.role === 'payoff' ? 'เฉลย' : b.role;
                return (
                  <button
                    key={b.beatId}
                    type="button"
                    onClick={() => onOpenThreadBind?.()}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    title={`ปม: ${b.title} · ${roleLabel}`}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: b.color ?? 'var(--forge-amber)' }} />
                    <span className="truncate max-w-[160px]">{b.title}</span>
                    <span>· {roleLabel}</span>
                  </button>
                );
              })}

              {ancestorConnections?.map((conn) => {
                const ancestorTitle = conn.label || conn.targetIdeaTitle || conn.targetIdeaId.slice(0, 8) + '...';
                const categoryLabels: Record<string, string> = {
                  plot: 'พล็อต', character: 'ตัวละคร', worldbuilding: 'สร้างโลก', subplot: 'เนื้อรอง', general: 'ทั่วไป',
                };
                return (
                  <Popover key={conn.id}>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" title="ที่มา">
                        <GitBranchPlus className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[140px]">{ancestorTitle}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-72 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-sm font-semibold truncate">{conn.targetIdeaTitle || 'Idea'}</p>
                      </div>
                      {conn.targetIdeaCategory && (
                        <span className="inline-block text-[11px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
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
                        <p className="text-xs text-muted-foreground/70 italic">ไม่มีเนื้อหาเพิ่มเติม</p>
                      )}
                      {conn.targetIdeaNotes && conn.targetIdeaNotes.length > 0 && (
                        <div className="pt-2 border-t border-border/60 space-y-1">
                          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> โน้ต
                          </p>
                          {conn.targetIdeaNotes.map((note, idx) => (
                            <p key={idx} className="text-xs text-foreground/80 border-b border-border/40 py-1 whitespace-pre-wrap">{note}</p>
                          ))}
                        </div>
                      )}
                      {onRemoveAncestor && (
                        <button
                          type="button"
                          onClick={() => onRemoveAncestor(conn.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          ลบการเชื่อมโยงที่มา
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          )}

        </div>

        {/* ส่วนที่เลื่อนได้ — หัวแผง (ดาว/เมนู/ปิด) อยู่นอกกล่องนี้ จึงไม่เลื่อนหายตอนโน้ตยาว */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        {item.content && typeof item.content === 'string' && (
          <p className="px-4 pb-2 text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.content}</p>
        )}

        {/* ดราม่า — พับได้ (กางเมื่อมีข้อมูล) · animate ความสูงด้วย grid-rows ไม่แตะ layout property อื่น */}
        <div className="px-4">
          <button
            type="button"
            onClick={() => setDramaOpen((o) => !o)}
            aria-expanded={dramaOpen}
            className="w-full flex items-center gap-2 border-t border-border/60 py-2 text-left text-[13px] transition-colors hover:text-foreground"
          >
            <span className="font-medium">ดราม่า</span>
            <span className={cn("flex-1 min-w-0 truncate text-xs text-muted-foreground transition-opacity duration-150 motion-reduce:transition-none", dramaOpen && "opacity-0")}>
              {dramaSummary}
            </span>
            <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none", dramaOpen && "rotate-180")} />
          </button>
          <div
            className={cn("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", dramaOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            inert={!dramaOpen}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-2 pb-3">
                {hasDrama ? (
                  <dl className="grid grid-cols-[72px_1fr] gap-x-2.5 gap-y-1 text-[13px] leading-relaxed">
                    {item.sceneGoal && (<><dt className="text-xs text-muted-foreground pt-px">{shortLabel(dramaCfg.field1Label)}</dt><dd>{item.sceneGoal}</dd></>)}
                    {item.sceneConflict && (<><dt className="text-xs text-muted-foreground pt-px">{shortLabel(dramaCfg.field2Label)}</dt><dd>{item.sceneConflict}</dd></>)}
                    {dramaOutcome && (<><dt className="text-xs text-muted-foreground pt-px">ผลลัพธ์</dt><dd className={dramaOutcome.cls}>{dramaOutcome.label}</dd></>)}
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งดราม่าของการ์ดนี้ — ตั้งเป้าหมาย ความขัดแย้ง และผลลัพธ์เพื่อให้ผู้ช่วยดูจังหวะทำงานได้</p>
                )}
                <div className="flex items-center gap-2 border-t border-border/40 pt-2 text-xs">
                  {novelId && sceneId ? (
                    <span className="flex-1 min-w-0 flex items-center gap-1.5 text-muted-foreground">
                      {echoStatus === 'pending' ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />กำลังตรวจ…</>
                      ) : echoStatus === 'empty' ? (
                        <span className="italic">การ์ดนี้ตรวจไม่ได้ (การ์ดแรกของฉาก หรือเป็นบอร์ดโน้ต)</span>
                      ) : echoFinding ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />วิเคราะห์ Echo Score แล้ว<EchoGuessBadge finding={echoFinding} /></>
                      ) : (
                        <span>ยังไม่ได้ตรวจ Echo Score</span>
                      )}
                    </span>
                  ) : <span className="flex-1" />}
                  {item.referenceId && (
                    <IdeaDramaticPanel
                      ideaId={item.referenceId}
                      sceneType={item.sceneType}
                      sceneTone={item.sceneTone}
                      sceneGoal={item.sceneGoal}
                      sceneConflict={item.sceneConflict}
                      sceneOutcome={item.sceneOutcome}
                      valueShift={item.valueShift}
                      pacing={item.pacing}
                      onSaved={onSetSceneDrama}
                    />
                  )}
                  {novelId && sceneId && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" title="หาจังหวะที่เดาได้ (การ์ดนี้)" disabled={echoStatus === 'pending'} onClick={runCardEcho}>
                      {echoStatus === 'pending' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {echoFinding ? "ตรวจใหม่" : "ตรวจ"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* แท็บ — เส้นใต้เลื่อนตามแท็บที่เลือก (ไม่ใช้เลขกำกับ) */}
        <div
          className="sticky top-0 z-10 grid grid-cols-2 border-y border-border/60 bg-muted"
          role="tablist"
          aria-label="ส่วนของการ์ด"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
            e.preventDefault();
            const next = e.key === "Home" || e.key === "ArrowLeft" ? "people" : "notes";
            setTab(next);
            e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
          }}
        >
          {([
            ["people", "คนในฉาก", treeKids.length],
            ["notes", "โน้ต", thisIdeaNotes.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              data-tab={key}
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "py-2 text-[13px] transition-colors duration-150 motion-reduce:transition-none",
                tab === key ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && <span className="ml-1 font-normal text-muted-foreground">{count}</span>}
            </button>
          ))}
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-0 left-0 h-0.5 w-1/2 bg-[var(--forge-amber)] transition-transform duration-200 ease-out motion-reduce:transition-none",
              tab === "notes" && "translate-x-full"
            )}
          />
        </div>

        <div key={tab} role="tabpanel" className="px-4 py-3 space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
          {/* องค์ประกอบในไอเดีย — เดิมเป็นลิสต์แบนแยกกอง ตอนนี้ผูกกันเป็นชั้นได้ (P-nest) */}
          {tab === "people" && treeRoots.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/80">
                <Users className="w-3 h-3" /> องค์ประกอบ
              </p>
              <div className="divide-y divide-border/40">
                {treeRoots.map((c: any) => renderNode(c, 0))}
              </div>
            </div>
          )}

          {/* ผู้เข้าร่วม */}
          {tab === "people" && onAddChild && sceneId && novelId && onDetailSaved && (
            <div>
              <SceneParticipantsPanel
                ideaItem={item}
                sceneId={sceneId}
                novelId={novelId}
                characters={characters || []}
                factions={factions || []}
                powers={powers || []}
                items={items || []}
                entities={entities || []}
                worldSystems={worldSystems || []}
                onAddChild={onAddChild}
                onDetailSaved={onDetailSaved}
              />
            </div>
          )}

          {/* HOW — Notes — ปุ่มเพิ่ม/editor ใหม่อยู่บนสุดให้เห็นชัด โน้ตใหม่ต่อท้ายรายการตามเดิมแล้วเลื่อนไปโชว์ */}
          {tab === "notes" && onQuickAddNote && (
            <div className="space-y-1.5">
              {editingNoteId === null && quickNoteOpen ? (
                noteEditor
              ) : !quickNoteOpen ? (
                <button
                  onClick={() => { setEditingNoteId(null); setQuickNote(""); setNoteBaseline(""); setQuickNoteKind(null); setQuickNoteTpl("plain"); setNoteTplBaseline("plain"); setConfirmDeleteNote(false); setQuickNoteOpen(true); }}
                  className="flex items-center gap-1.5 w-full rounded-md border border-dashed border-border/70 px-2.5 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มโน้ต
                </button>
              ) : null}
              {thisIdeaNotes.map((note) => {
                const noteColor = note.noteKind || undefined;
                return editingNoteId === note.id ? (
                  <div key={note.id}>{noteEditor}</div>
                ) : (
                  <div
                    key={note.id}
                    id={`idea-note-${note.id}`}
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
                      "group/note relative flex gap-2.5 border-b border-border/40 px-1 py-2.5 text-[13px] leading-relaxed cursor-pointer transition-colors duration-700 hover:bg-muted/40",
                      draggedNoteId === note.id && "opacity-40",
                      flashNoteId === note.id && "bg-[var(--forge-amber)]/15"
                    )}
                    onClick={() => {
                      setEditingNoteId(note.id);
                      setQuickNote(note.notes || "");
                      setNoteBaseline(note.notes || "");
                      setQuickNoteKind(note.noteKind ?? null);
                      setQuickNoteTpl(noteTemplate(note.notes));
                      setNoteTplBaseline(noteTemplate(note.notes));
                      setConfirmDeleteNote(false);
                      setQuickNoteOpen(true);
                    }}
                  >
                    {noteColor && <span className="mt-2 h-2 w-2 rounded-full shrink-0" style={{ background: noteColor }} />}
                    <div className="flex-1 min-w-0 text-foreground/90 pr-4">
                      <ClampedNote>
                        <NoteView raw={note.notes || ""} renderPlain={renderNoteMentions} />
                      </ClampedNote>
                      {looksLikeDialogue(note.notes) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onQuickAddNote(item, withTemplate(note.notes || "", "dialogue", allMentionChars), note.id, note.noteKind ?? undefined); }}
                          className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                          ดูเหมือนบทสนทนา — เปลี่ยนเป็นรูปแบบบทสนทนา
                        </button>
                      )}
                    </div>
                    <Pencil className="w-3 h-3 absolute top-1.5 right-1.5 text-muted-foreground opacity-40 group-hover/note:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>
          )}

        </div>
        </div>
        {throughLine && novelId && (
          <CharacterThroughLine
            open={!!throughLine}
            onOpenChange={(o) => !o && setThroughLine(null)}
            novelId={novelId}
            elementType={throughLine.type}
            elementId={throughLine.id}
            elementName={throughLine.name}
            currentSceneId={sceneId}
          />
        )}
    </PopoverContent>
  );
}
