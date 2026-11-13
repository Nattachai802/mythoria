"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { FactionIssue } from "@/lib/faction-checks";
import { cn } from "@/lib/utils";

/** แถบ "ตรวจระบบฝ่าย" — การ์ดเห็นทันที 4 ข้อแรก (ที่เหลือกด "ดูทั้งหมด") · ไม่มีปัญหา = ซ่อนทั้งแถบ · แต่ละข้อพาไปแก้ */
export function FactionChecksPanel({ issues, novelId, factionName, characterName, onSelect }: {
    issues: FactionIssue[];
    novelId: string;
    factionName: (id: string) => string;
    characterName: (id: string) => string;
    onSelect: (factionId: string) => void;
}) {
    const [all, setAll] = useState(false);
    if (issues.length === 0) return null;

    const charLink = (id: string) => (
        <Link href={`/dashboard/project/${novelId}/characters/${id}`} className="underline decoration-dotted underline-offset-2 hover:text-foreground">{characterName(id)}</Link>
    );
    const facBtn = (id: string) => (
        <button type="button" onClick={() => onSelect(id)} className="underline decoration-dotted underline-offset-2 hover:text-foreground cursor-pointer">{factionName(id)}</button>
    );
    const span = (a: number | null, b: number | null) => (a === null && b === null ? "ทุกบท" : `บท ${a ?? "แรก"}–${b ?? "ปัจจุบัน"}`);

    return (
        <div className="border-b border-steel-800/60 px-6 py-2">
            <div className="flex items-center gap-2 font-technical text-[10px] uppercase tracking-[0.12em] text-[var(--forge-amber)]">
                <AlertTriangle className="h-3.5 w-3.5" /> ตรวจระบบฝ่าย · {issues.length}
            </div>
            {(
                <ul className="mt-2 grid sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    {issues.slice(0, all ? undefined : 4).map((i, k) => (
                        <li key={k} className={cn("border-l-2 pl-2.5 pr-2 py-1.5 bg-steel-800/30", i.kind === "enemy-overlap" || i.kind === "reversed-range" || i.kind === "rel-conflict" ? "border-red-500/70" : "border-[var(--forge-amber)]/60")}>
                            {i.kind === "enemy-overlap" && <>{charLink(i.characterId)} อยู่ทั้ง {facBtn(i.factionIds[0])} และ {facBtn(i.factionIds[1])} ซึ่งเป็นศัตรูกัน ใน{span(i.from, i.to)} — ถ้าเป็นสายลับ ใส่บทบาทให้ชัด</>}
                            {i.kind === "reversed-range" && <>{charLink(i.characterId)} ใน {facBtn(i.factionId)}: บทจบอยู่ก่อนบทเริ่ม</>}
                            {i.kind === "leader-not-member" && <>ผู้นำของ {facBtn(i.factionId)} ({charLink(i.characterId)}) ยังไม่ได้เป็นสมาชิกของฝ่ายนี้</>}
                            {i.kind === "empty" && <>{facBtn(i.factionId)} ยังไม่มีสมาชิก</>}
                            {i.kind === "rel-conflict" && <>{facBtn(i.factionIds[0])} กับ {facBtn(i.factionIds[1])} มีความสัมพันธ์ 2 แบบ ({i.types.join(" / ")}) ทับกันใน{span(i.from, i.to)} — ปรับช่วงบทให้ต่อกัน</>}
                        </li>
                    ))}
                </ul>
            )}
            {issues.length > 4 && (
                <button type="button" onClick={() => setAll((v) => !v)} className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
                    {all ? "ย่อ" : `ดูทั้งหมด (${issues.length})`}<ChevronDown className={cn("h-3 w-3 transition-transform duration-200", all && "rotate-180")} />
                </button>
            )}
        </div>
    );
}
