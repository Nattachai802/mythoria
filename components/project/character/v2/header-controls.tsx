"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import type { Character } from "@/db/schema";
import { updateCharacter } from "@/server/character";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";

async function save(characterId: string, data: Parameters<typeof updateCharacter>[1]) {
    const res = await updateCharacter(characterId, data);
    if (!res.success) toast.error("บันทึกไม่สำเร็จ", { description: res.error });
    return res.success;
}

/** ป้ายบทบาทที่กดเปลี่ยนได้ — select จริงซ้อนใต้ป้าย (คีย์บอร์ด/จอสัมผัสใช้ได้ตามปกติ) */
export function RolePicker({ character, roles }: {
    character: Character;
    roles: Record<string, { label: string; badge: string }>;
}) {
    const [role, setRole] = useState(character.role);
    const cfg = roles[role] ?? roles.minor;
    return (
        <label className={cn("relative inline-flex items-center chamfered-sm border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors duration-200 hover:brightness-110", cfg.badge)}>
            {cfg.label}
            <span aria-hidden className="ml-1 opacity-60">▾</span>
            <select aria-label="บทบาท" value={role}
                onChange={async (e) => { const prev = role; setRole(e.target.value); if (!(await save(character.id, { role: e.target.value }))) setRole(prev); }}
                className="absolute inset-0 opacity-0 cursor-pointer">
                {Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
        </label>
    );
}

/** ชื่อเรียกอื่น — พิมพ์คั่นด้วยจุลภาค บันทึกตอนคลิกออก/Enter · Esc = คืนค่าเดิม */
export function AliasesField({ character }: { character: Character }) {
    const initial = ((Array.isArray(character.aliases) ? character.aliases : []) as string[]).filter(Boolean).join(", ");
    const [value, setValue] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const commit = async () => {
        if (value === saved) return;
        const list = value.split(/[,،、]/).map((s) => s.trim()).filter(Boolean);
        if (await save(character.id, { aliases: list })) setSaved(list.join(", "));
        setValue(list.join(", "));
    };
    return (
        <input aria-label="ชื่อเรียกอื่น (คั่นด้วยจุลภาค)" value={value} placeholder="+ ชื่อเรียกอื่น"
            onChange={(e) => setValue(e.target.value)} onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLElement).blur();
                if (e.key === "Escape") { setValue(saved); (e.target as HTMLElement).blur(); }
            }}
            style={{ width: `${Math.max(12, value.length + 2)}ch` }}
            className="max-w-full bg-transparent font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground outline-none rounded-sm px-1 placeholder:text-muted-foreground/45 hover:bg-muted/40 focus:bg-muted/50 focus:ring-1 focus:ring-[var(--forge-gold)]/50 transition-colors duration-200" />
    );
}

/** ปุ่มเปลี่ยนรูป — โผล่เมื่อชี้ที่รูป (จอสัมผัสเห็นตลอด) · รูปเก่าถูกลบจาก Cloudinary ใน updateCharacter */
export function PortraitUpload({ character }: { character: Character }) {
    const router = useRouter();
    return (
        <ImageUpload
            value={character.image ?? undefined}
            onChange={async (url) => { if (await save(character.id, { image: url })) router.refresh(); }}
            trigger={
                <button type="button" aria-label="เปลี่ยนรูป"
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 chamfered-sm border border-border bg-background/85 backdrop-blur px-2.5 py-1 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 cursor-pointer">
                    <Camera className="w-3.5 h-3.5" /> {character.image ? "เปลี่ยนรูป" : "ใส่รูป"}
                </button>
            }
        />
    );
}

/** จุดทองบอกว่าช่องนี้ AI เติม — ชี้/โฟกัสเห็นประโยคอ้างอิง · หายเมื่อผู้ใช้แก้ช่องนั้น */
export function AiDot({ quote }: { quote?: string }) {
    if (!quote) return null;
    return (
        <span tabIndex={0} title={`AI เติมจากภาพรวม: “${quote}” — แก้ได้เลยถ้าไม่ถูก`}
            aria-label={`AI เติมจากภาพรวม: ${quote}`}
            className="inline-block w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--forge-gold)] animate-in fade-in zoom-in-50 duration-300 motion-reduce:animate-none cursor-help" />
    );
}
