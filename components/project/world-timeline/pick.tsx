"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Select ของระบบ (shadcn) แบบสั้น — ใช้แทน <select> ดิบให้หน้าตาตรงกับฟอร์มอื่นในแอป */
export function Pick({ value, onChange, options, ariaLabel, className }: {
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
    ariaLabel: string
    className?: string
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger aria-label={ariaLabel} className={cn("h-9 min-w-0", className)}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
        </Select>
    )
}
