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

    // "ยังไม่มีสมาชิก" มักมีหลายข้อ — รวมเป็นบรรทัดเดียว ที่เหลือแสดงทีละข้อ
    const empty = issues.filter((i) => i.kind === "empty");
    const rest = issues.filter((i) => i.kind !== "empty");
    const shown = all ? rest : rest.slice(0, 3);
    const hiddenCount = rest.length - shown.length;

    return (
        <div className="border-b border-steel-800/60 px-6 py-3 text-sm">
            <div className="flex items-center gap-2 text-[var(--forge-amber)]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-medium">ตรวจระบบฝ่าย</span>
                <span className="text-muted-foreground">{issues.length} ข้อ</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
                {shown.map((i, k) => (
                    <li key={k} className="flex gap-2">
                        <span className={cn("mt-2 h-1.5 w-1.5 rounded-full shrink-0", i.kind === "leader-not-member" ? "bg-[var(--forge-amber)]" : "bg-red-500")} />
                        <span>
                            {i.kind === "enemy-overlap" && <>{charLink(i.characterId)} อยู่ทั้ง {facBtn(i.factionIds[0])} และ {facBtn(i.factionIds[1])} ซึ่งเป็นศัตรูกัน ใน{span(i.from, i.to)} — ถ้าเป็นสายลับ ใส่บทบาทให้ชัด</>}
                            {i.kind === "reversed-range" && <>{charLink(i.characterId)} ใน {facBtn(i.factionId)}: บทจบอยู่ก่อนบทเริ่ม</>}
                            {i.kind === "leader-not-member" && <>ผู้นำของ {facBtn(i.factionId)} ({charLink(i.characterId)}) ยังไม่ได้เป็นสมาชิกของฝ่ายนี้</>}
                            {i.kind === "rel-conflict" && <>{facBtn(i.factionIds[0])} กับ {facBtn(i.factionIds[1])} มีความสัมพันธ์ 2 แบบ ({i.types.join(" / ")}) ทับกันใน{span(i.from, i.to)} — ปรับช่วงบทให้ต่อกัน</>}
                        </span>
                    </li>
                ))}
                {empty.length > 0 && (
                    <li className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/50" />
                        <span>ยังไม่มีสมาชิก {empty.length} ฝ่าย: {(all ? empty : empty.slice(0, 6)).map((i, k) => (
                            <span key={k}>{k > 0 && ", "}{i.kind === "empty" && facBtn(i.factionId)}</span>
                        ))}{!all && empty.length > 6 && ` และอีก ${empty.length - 6}`}</span>
                    </li>
                )}
            </ul>
            {(hiddenCount > 0 || empty.length > 6) && (
                <button type="button" onClick={() => setAll((v) => !v)} className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    {all ? "ย่อ" : "ดูทั้งหมด"}<ChevronDown className={cn("h-3 w-3 transition-transform duration-200", all && "rotate-180")} />
                </button>
            )}
        </div>
    );
}
