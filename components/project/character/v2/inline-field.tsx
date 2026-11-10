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
    return (
        <div className="py-2">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
                <ClearValue label={label} value={value} onClear={() => onChange(undefined)} />
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label={label}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label} ${n}`}
                        onClick={() => onChange(value === n ? undefined : n)}
                        className={cn(CELL, "h-6 flex-1 text-[10px] tabular-nums", value !== undefined && n <= value ? CELL_ON : CELL_OFF)}>
                        {n}
                    </button>
                ))}
            </div>
            {(lowLabel || highLabel) && (
                <div className="flex justify-between mt-0.5 text-[10px] text-muted-foreground/70">
                    <span>{lowLabel}</span><span>{highLabel}</span>
                </div>
            )}
        </div>
    );
}

const CELL = "chamfered-sm border transition-[color,background-color,border-color,transform] duration-200 active:scale-95 motion-reduce:active:scale-100 cursor-pointer";
const CELL_ON = "bg-[var(--forge-gold)]/80 border-[var(--forge-gold)] text-background";
const CELL_OFF = "border-border text-muted-foreground hover:border-[var(--forge-gold)]/60";

function ClearValue({ label, value, onClear }: { label: string; value: number | undefined; onClear: () => void }) {
    if (value === undefined) return <span className="text-[10px] text-muted-foreground/50">ยังไม่ตั้ง</span>;
    return (
        <span className="flex items-center gap-1.5">
            <span className="font-display text-sm tabular-nums">{value}</span>
            <button type="button" aria-label={`ล้างค่า ${label}`} onClick={onClear}
                className="text-muted-foreground/60 hover:text-foreground text-xs leading-none cursor-pointer">×</button>
        </span>
    );
}

/** ช่องเหลี่ยม 10 ช่อง = 0–100 ทีละ 10 · ค่าเดิมที่ไม่ลงตัวปัดเข้าช่องใกล้สุด */
const STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/**
 * แกน MBTI 0–100 (<50 = ฝั่งซ้าย) — ซ้าย 5 ช่อง | เส้นกลาง | ขวา 5 ช่อง ระบายจากกลางออกไปฝั่งที่เอียง
 * ช่องซ้าย i (0=ริมสุด) = ค่า i*10 · ช่องขวา i = 60+i*10
 */
export function BipolarBar({ left, right, value, onChange, label }: {
    left: string;
    right: string;
    value: number | undefined;
    onChange: (v: number | undefined) => void;
    label: string;
}) {
    const set = value !== undefined;
    const v = Math.round((value ?? 50) / 10) * 10;
    const lean = !set || v === 50 ? null : v < 50 ? "L" : "R";
    const leftVals = [0, 10, 20, 30, 40];
    const rightVals = [60, 70, 80, 90, 100];
    const cell = (cv: number, on: boolean) => (
        <button key={cv} type="button" aria-label={`${label} ${cv}`} aria-pressed={set && v === cv}
            onClick={() => onChange(set && v === cv ? undefined : cv)}
            className={cn(CELL, "h-3.5 flex-1", on ? CELL_ON : CELL_OFF)} />
    );
    return (
        <div className="flex items-center gap-2.5 py-1.5">
            <span className={cn("w-4 text-center text-xs font-technical transition-colors duration-200", lean === "L" ? "text-[var(--forge-amber)] font-bold" : "text-muted-foreground")}>{left}</span>
            <div className="flex flex-1 items-center gap-[3px]" role="group" aria-label={label}>
                {leftVals.map((cv) => cell(cv, set && v < 50 && cv >= v))}
                <span className="w-px h-4 mx-1 bg-border" aria-hidden />
                {rightVals.map((cv) => cell(cv, set && v > 50 && cv <= v))}
            </div>
            <span className={cn("w-4 text-center text-xs font-technical transition-colors duration-200", lean === "R" ? "text-[var(--forge-amber)] font-bold" : "text-muted-foreground")}>{right}</span>
            {set
                ? <button type="button" aria-label={`ล้างค่า ${label}`} onClick={() => onChange(undefined)} className="w-3 text-muted-foreground/60 hover:text-foreground text-xs leading-none cursor-pointer">×</button>
                : <span className="w-3" aria-hidden />}
        </div>
    );
}

/** ความเข้มของ facet 0–100 — 10 ช่องเล็ก */
export function ThinBar({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
    return (
        <div className="flex items-center gap-[2px]" role="group" aria-label={label}>
            {STEPS.map((cv) => (
                <button key={cv} type="button" aria-label={`${label} ${cv}`} aria-pressed={value >= cv - 5 && value < cv + 5}
                    onClick={() => onChange(cv)}
                    className={cn(CELL, "h-2.5 flex-1", value >= cv - 5 ? CELL_ON : CELL_OFF)} />
            ))}
        </div>
    );
}
