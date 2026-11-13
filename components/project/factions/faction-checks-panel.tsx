"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { FactionIssue } from "@/lib/faction-checks";
import { cn } from "@/lib/utils";

/** แถบ "ตรวจระบบฝ่าย" — พับได้ · ไม่มีปัญหา = ซ่อนทั้งแถบ · แต่ละข้อพาไปแก้ */
export function FactionChecksPanel({ issues, novelId, factionName, characterName, onSelect }: {
    issues: FactionIssue[];
    novelId: string;
    factionName: (id: string) => string;
    characterName: (id: string) => string;
    onSelect: (factionId: string) => void;
}) {
    const [open, setOpen] = useState(false);
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
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                className="flex items-center gap-2 text-xs text-[var(--forge-amber)] cursor-pointer">
                <AlertTriangle className="h-3.5 w-3.5" />
                ตรวจระบบฝ่าย: พบ {issues.length} จุดที่ควรดู
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
            </button>
            {open && (
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground animate-in fade-in duration-200 motion-reduce:animate-none">
                    {issues.map((i, k) => (
                        <li key={k} className={cn("border-l-2 pl-2.5 py-0.5", i.kind === "enemy-overlap" || i.kind === "reversed-range" || i.kind === "rel-conflict" ? "border-red-500/70" : "border-[var(--forge-amber)]/60")}>
                            {i.kind === "enemy-overlap" && <>{charLink(i.characterId)} อยู่ทั้ง {facBtn(i.factionIds[0])} และ {facBtn(i.factionIds[1])} ซึ่งเป็นศัตรูกัน ใน{span(i.from, i.to)} — ถ้าเป็นสายลับ ใส่บทบาทให้ชัด</>}
                            {i.kind === "reversed-range" && <>{charLink(i.characterId)} ใน {facBtn(i.factionId)}: บทจบอยู่ก่อนบทเริ่ม</>}
                            {i.kind === "leader-not-member" && <>ผู้นำของ {facBtn(i.factionId)} ({charLink(i.characterId)}) ยังไม่ได้เป็นสมาชิกของฝ่ายนี้</>}
                            {i.kind === "empty" && <>{facBtn(i.factionId)} ยังไม่มีสมาชิก</>}
                            {i.kind === "rel-conflict" && <>{facBtn(i.factionIds[0])} กับ {facBtn(i.factionIds[1])} มีความสัมพันธ์ 2 แบบ ({i.types.join(" / ")}) ทับกันใน{span(i.from, i.to)} — ปรับช่วงบทให้ต่อกัน</>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
