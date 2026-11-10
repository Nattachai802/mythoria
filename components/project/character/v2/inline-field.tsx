"use client";

import { cn } from "@/lib/utils";
import { AiDot } from "./header-controls";

/** ช่องแบบ "เขียนลงหน้ากระดาษ" — ดูเป็นข้อความ กดแล้วพิมพ์ได้ทันที ไม่มีกรอบฟอร์ม */
export function InlineField({
    label,
    value,
    onChange,
    placeholder = "—",
    type = "text",
    suffix,
    className,
    ai,
}: {
    /** ประโยคอ้างอิงถ้าช่องนี้ AI เติม — แสดงจุดทอง */
    ai?: string;
    label: string;
    value: string | number | undefined;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "number";
    suffix?: string;
    className?: string;
}) {
    return (
        <label className={cn("flex items-baseline justify-between gap-3 py-1.5 group", className)}>
            <span className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
                {label}
                <AiDot quote={ai} />
            </span>
            <span className="flex items-baseline gap-1 min-w-0 flex-1 justify-end">
                <input
                    type={type}
                    inputMode={type === "number" ? "numeric" : undefined}
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full min-w-0 bg-transparent text-right text-sm font-medium outline-none placeholder:text-muted-foreground/40 border-b border-transparent group-hover:border-border focus:border-[var(--forge-gold)] transition-colors"
                />
                {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
            </span>
        </label>
    );
}

/** สเกล 1–5 แบบปุ่ม — กดซ้ำค่าเดิมเพื่อล้าง */
export function LevelPicker({
    label,
    value,
    onChange,
    lowLabel,
    highLabel,
}: {
    label: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    lowLabel?: string;
    highLabel?: string;
}) {
    return (
        <div className="py-1.5">
            <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground/70">
                    {lowLabel} {lowLabel && highLabel && "→"} {highLabel}
                </span>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label={label}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === n}
                        aria-label={`${label} ${n}`}
                        onClick={() => onChange(value === n ? undefined : n)}
                        className={cn(
                            "h-6 flex-1 chamfered-sm border text-[10px] tabular-nums transition-[color,background-color,border-color,transform] duration-200 active:scale-95 motion-reduce:active:scale-100 cursor-pointer",
                            value !== undefined && n <= value
                                ? "bg-[var(--forge-gold)]/80 border-[var(--forge-gold)] text-background"
                                : "border-border text-muted-foreground hover:border-[var(--forge-gold)]/60",
                        )}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
}

export const numOrUndef = (s: string) => {
    if (s.trim() === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : undefined;
};

/** ย่อหน้าเขียนอิสระ — field-sizing ให้สูงตามเนื้อหา (เบราว์เซอร์ที่ไม่รองรับ = 3 บรรทัด) */
export function TextBlock({
    label,
    hint,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    hint?: string;
    value: string | undefined;
    onChange: (v: string | undefined) => void;
    placeholder?: string;
}) {
    return (
        <label className="block py-1.5">
            <span className="flex items-baseline justify-between gap-3">
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
                {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
            </span>
            <textarea
                rows={2}
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value.trim() === "" ? undefined : e.target.value)}
                placeholder={placeholder ?? "—"}
                className="mt-1 w-full resize-none [field-sizing:content] min-h-[2.5rem] bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/40 border-b border-transparent hover:border-border focus:border-[var(--forge-gold)] transition-colors"
            />
        </label>
    );
}

/** ชิปเลือกหนึ่งค่า — กดซ้ำเพื่อล้าง */
export function ChipPicker<T extends string>({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: readonly { value: T; label: string; hint?: string }[];
    value: T | undefined;
    onChange: (v: T | undefined) => void;
}) {
    return (
        <div className="py-1.5">
            <div className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">{label}</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
                {options.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={value === o.value}
                        title={o.hint}
                        onClick={() => onChange(value === o.value ? undefined : o.value)}
                        className={cn(
                            "chamfered-sm border px-2.5 py-1 text-xs transition-[color,background-color,border-color,transform] duration-200 active:scale-95 motion-reduce:active:scale-100 cursor-pointer",
                            value === o.value
                                ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/15 text-foreground"
                                : "border-border text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

/**
 * สเกล 1–5 แบบรางบาง (แทนปุ่มเต็มแถวที่หนักตา) — native range ข้างใต้ = คลิก/ลาก/คีย์บอร์ดได้
 * ยังไม่ตั้งค่า: รางจาง + "ยังไม่ตั้ง" · ปุ่ม × ล้างค่า
 */
export function ScaleBar({ label, value, onChange, lowLabel, highLabel }: {
    label: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    lowLabel?: string;
    highLabel?: string;
}) {
    const set = value !== undefined;
    const pct = set ? ((value - 1) / 4) * 100 : 0;
    return (
        <div className="py-2">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
                <span className="flex items-center gap-1.5">
                    <span className={cn("font-display text-sm tabular-nums", !set && "text-muted-foreground/50 text-[10px] font-sans")}>{set ? value : "ยังไม่ตั้ง"}</span>
                    {set && (
                        <button type="button" aria-label={`ล้างค่า ${label}`} onClick={() => onChange(undefined)}
                            className="text-muted-foreground/60 hover:text-foreground text-xs leading-none cursor-pointer">×</button>
                    )}
                </span>
            </div>
            <div className="relative h-5 flex items-center">
                <div className="absolute inset-x-0 h-1 rounded-full bg-muted" />
                {set && <div className="absolute left-0 h-1 rounded-full bg-[var(--forge-gold)]/40 transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />}
                {[0, 25, 50, 75, 100].map((t) => (
                    <span key={t} className="absolute w-px h-2 bg-border" style={{ left: `${t}%` }} aria-hidden />
                ))}
                {set && (
                    <span className="absolute w-3.5 h-3.5 -ml-[7px] rounded-full bg-[var(--forge-gold)] ring-2 ring-background shadow-sm transition-[left] duration-200 ease-out pointer-events-none"
                        style={{ left: `${pct}%` }} aria-hidden />
                )}
                <input type="range" min={1} max={5} step={1} aria-label={label} value={value ?? 3}
                    onChange={(e) => onChange(Number(e.target.value))}
                    onClick={(e) => { if (!set) onChange(Number((e.target as HTMLInputElement).value)); }}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            </div>
            {(lowLabel || highLabel) && (
                <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground/70">
                    <span>{lowLabel}</span><span>{highLabel}</span>
                </div>
            )}
        </div>
    );
}

/**
 * รางบางสองขั้ว 0–100 (<50 = ฝั่งซ้าย) — ใช้กับแกน MBTI · ขีดกลาง = ก้ำกึ่ง
 * ตัวอักษรฝั่งที่เอียงไปเป็นสีทอง · ยังไม่ตั้ง = รางจาง ไม่มีจุด
 */
export function BipolarBar({ left, right, value, onChange, label }: {
    left: string;
    right: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    label: string;
}) {
    const set = value !== undefined;
    const v = value ?? 50;
    const lean = !set ? null : v < 50 ? "L" : "R";
    return (
        <div className="flex items-center gap-2.5 py-1.5">
            <span className={cn("w-4 text-center text-xs font-technical transition-colors duration-200", lean === "L" ? "text-[var(--forge-amber)] font-bold" : "text-muted-foreground")}>{left}</span>
            <div className="relative flex-1 h-5 flex items-center">
                <div className={cn("absolute inset-x-0 h-1 rounded-full bg-muted", !set && "opacity-60")} />
                <span className="absolute left-1/2 w-px h-2.5 -ml-px bg-border" aria-hidden />
                {set && (
                    <>
                        <div className="absolute h-1 rounded-full bg-[var(--forge-gold)]/40 transition-all duration-200 ease-out"
                            style={v < 50 ? { left: `${v}%`, width: `${50 - v}%` } : { left: "50%", width: `${v - 50}%` }} />
                        <span className="absolute w-3.5 h-3.5 -ml-[7px] rounded-full bg-[var(--forge-gold)] ring-2 ring-background shadow-sm transition-[left] duration-200 ease-out pointer-events-none"
                            style={{ left: `${v}%` }} aria-hidden />
                    </>
                )}
                <input type="range" min={0} max={100} aria-label={label} value={v}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            </div>
            <span className={cn("w-4 text-center text-xs font-technical transition-colors duration-200", lean === "R" ? "text-[var(--forge-amber)] font-bold" : "text-muted-foreground")}>{right}</span>
            {set
                ? <button type="button" aria-label={`ล้างค่า ${label}`} onClick={() => onChange(undefined)} className="w-3 text-muted-foreground/60 hover:text-foreground text-xs leading-none cursor-pointer">×</button>
                : <span className="w-3" aria-hidden />}
        </div>
    );
}

/** รางบางทางเดียว 0–100 (ความเข้มของ facet) */
export function ThinBar({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
    return (
        <div className="relative h-5 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-muted" />
            <div className="absolute left-0 h-1 rounded-full bg-[var(--forge-gold)]/50 transition-[width] duration-200 ease-out" style={{ width: `${value}%` }} />
            <span className="absolute w-3 h-3 -ml-1.5 rounded-full bg-[var(--forge-gold)] ring-2 ring-background pointer-events-none transition-[left] duration-200 ease-out" style={{ left: `${value}%` }} aria-hidden />
            <input type="range" min={0} max={100} aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer" />
        </div>
    );
}
