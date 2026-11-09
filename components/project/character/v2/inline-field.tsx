"use client";

import { cn } from "@/lib/utils";

/** ช่องแบบ "เขียนลงหน้ากระดาษ" — ดูเป็นข้อความ กดแล้วพิมพ์ได้ทันที ไม่มีกรอบฟอร์ม */
export function InlineField({
    label,
    value,
    onChange,
    placeholder = "—",
    type = "text",
    suffix,
    className,
}: {
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
            <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
                {label}
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
                            "h-6 flex-1 chamfered-sm border text-[10px] tabular-nums transition-colors cursor-pointer",
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
                className="mt-1 w-full resize-none [field-sizing:content] min-h-[2.5rem] bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40 border-b border-transparent hover:border-border focus:border-[var(--forge-gold)] transition-colors"
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
                            "chamfered-sm border px-2.5 py-1 text-xs transition-colors cursor-pointer",
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
