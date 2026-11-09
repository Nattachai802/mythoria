"use client";

import { BookOpen, User, Flame, Target, Swords, Shield, AlertTriangle } from "lucide-react";
import type { Character } from "@/db/schema";
import { cn } from "@/lib/utils";
import { useCharacterText, type CharacterTextField } from "./use-section";
import { SaveBadge } from "./profile-section";

/**
 * ข้อความที่อ่านและแก้ได้ในที่เดียว — textarea หน้าตาเหมือนย่อหน้า (ไม่มีกรอบ ไม่สลับโหมด)
 * พิมพ์ = บันทึกเองหลังหยุด 800ms · คลิกออก = บันทึกทันที · Esc = คืนค่าที่บันทึกล่าสุด
 */
export function EditableText({
    character,
    field,
    placeholder,
    className,
    multiline = true,
    required,
    label,
    showBadge = true,
}: {
    character: Character;
    field: CharacterTextField;
    placeholder: string;
    className?: string;
    multiline?: boolean;
    required?: boolean;
    label: string;
    showBadge?: boolean;
}) {
    const f = useCharacterText(character.id, field, character[field] as string | null, { required });
    const common = {
        "aria-label": label,
        value: f.value,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => f.change(e.target.value),
        onBlur: f.commit,
        onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Escape") { f.revert(); (e.target as HTMLElement).blur(); }
            if (!multiline && e.key === "Enter") (e.target as HTMLElement).blur();
        },
        className: cn(
            "w-full bg-transparent outline-none rounded-sm -mx-1 px-1 transition-[background-color,box-shadow] duration-200",
            "placeholder:text-muted-foreground/45 hover:bg-muted/40 focus:bg-muted/50 focus:ring-1 focus:ring-[var(--forge-gold)]/50",
            className,
        ),
    };
    return (
        <div className="relative group/edit">
            {multiline
                ? <textarea {...common} rows={1} className={cn(common.className, "resize-none [field-sizing:content] min-h-[1.75em]")} />
                : <input {...common} />}
            {showBadge && (
                <span className="pointer-events-none absolute -top-5 right-0"><SaveBadge state={f.state} /></span>
            )}
        </div>
    );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="flex items-center gap-3">
                <span className="flex items-center gap-2 font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                    {icon}{title}
                </span>
                <span className="flex-1 h-px bg-border/70" />
            </div>
            {children}
        </section>
    );
}

function Sub({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{icon}{title}</span>
            {children}
        </div>
    );
}

const body = "text-base leading-relaxed";

export function OverviewSection({ character }: { character: Character }) {
    return (
        <div className="space-y-8">
            <Section icon={<BookOpen className="w-3 h-3" />} title="สรุป">
                <EditableText character={character} field="description" label="สรุปตัวละคร" className="text-[17px] leading-relaxed"
                    placeholder="+ เขียนสรุปสั้น ๆ ว่าตัวละครนี้คือใคร" />
            </Section>
            <Section icon={<User className="w-3 h-3" />} title="รูปลักษณ์">
                <EditableText character={character} field="appearance" label="รูปลักษณ์" className={body} placeholder="+ เขียนรูปลักษณ์" />
            </Section>
            <Section icon={<Flame className="w-3 h-3" />} title="บุคลิกภาพ">
                <EditableText character={character} field="personality" label="บุคลิกภาพ" className={body} placeholder="+ เขียนบุคลิกภาพ" />
            </Section>
            <Section icon={<BookOpen className="w-3 h-3" />} title="ปูมหลัง">
                <EditableText character={character} field="backstory" label="ปูมหลัง" className={body} placeholder="+ เขียนปูมหลัง" />
            </Section>
            <Section icon={<Target className="w-3 h-3" />} title="มิติตัวละคร">
                <div className="grid sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Sub icon={<Target className="w-3 h-3 text-emerald-500" />} title="เป้าหมาย">
                        <EditableText character={character} field="goals" label="เป้าหมาย" className={body} placeholder="+ ต้องการอะไร" />
                    </Sub>
                    <Sub icon={<Flame className="w-3 h-3 text-[var(--forge-amber)]" />} title="แรงจูงใจ">
                        <EditableText character={character} field="motivation" label="แรงจูงใจ" className={body} placeholder="+ ทำไมถึงต้องการ" />
                    </Sub>
                    <Sub icon={<Swords className="w-3 h-3 text-red-500" />} title="ความขัดแย้ง">
                        <EditableText character={character} field="conflict" label="ความขัดแย้ง" className={body} placeholder="+ อะไรขวางอยู่" />
                    </Sub>
                </div>
            </Section>
            <div className="grid sm:grid-cols-2 gap-6">
                <Section icon={<Shield className="w-3 h-3 text-emerald-500" />} title="จุดแข็ง">
                    <EditableText character={character} field="strengths" label="จุดแข็ง" className={body} placeholder="+ เก่งอะไร" />
                </Section>
                <Section icon={<AlertTriangle className="w-3 h-3 text-red-500" />} title="จุดอ่อน">
                    <EditableText character={character} field="weaknesses" label="จุดอ่อน" className={body} placeholder="+ พลาดตรงไหน" />
                </Section>
            </div>
        </div>
    );
}
