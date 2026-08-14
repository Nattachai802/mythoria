"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * "ใครใช้พลังนี้ได้" เขียนเป็นประโยคเติมคำ ไม่ใช่ฟอร์มให้ติ๊กหมวด
 *
 * คนเขียนนิยายกำลังเขียนกฎของโลกตัวเอง อ่านทวนแล้วต้องรู้ทันทีว่ากฎจริงหรือยัง
 * ซึ่งตารางให้ติ๊กไม่บอกอะไรตอนอ่านทวน ส่วนระดับการเข้าถึงเป็นสิ่งที่สรุปได้จากประโยค
 *
 * ช่องที่สองเปลี่ยนความหมายตามคำแรก แต่เก็บคนละคอลัมน์ —
 * สลับ access แล้วข้อความเดิมต้องไม่ถูกตีความใหม่เงียบ ๆ
 */

export const ACCESS_LEVELS = {
    universal: { label: "ทุกคน", verb: "ใช้พลังนี้ได้" },
    learnable: { label: "ใครก็ตามที่ได้เรียน", verb: "ใช้พลังนี้ได้" },
    restricted: { label: "เฉพาะคนในกลุ่ม", verb: "ใช้พลังนี้ได้" },
    unique: { label: "คนเดียวในโลก", verb: "ใช้พลังนี้ได้" },
} as const;

export type AccessLevel = keyof typeof ACCESS_LEVELS;

export const asAccess = (v: string | null | undefined): AccessLevel =>
    v && v in ACCESS_LEVELS ? (v as AccessLevel) : "unique";

interface Props {
    access: AccessLevel;
    accessNote: string;
    baseline: string;
    onChange: (patch: { access?: AccessLevel; accessNote?: string; baseline?: string }) => void;
    className?: string;
}

export function PowerAccessField({ access, accessNote, baseline, onChange, className }: Props) {
    const showBaseline = access === "universal" || access === "learnable";
    const showNote = access === "restricted";

    return (
        <div className={cn("space-y-2", className)}>
            <label htmlFor="power-access" className="text-sm font-medium">
                ใครใช้พลังนี้ได้
            </label>

            {/* leading-loose + items-baseline ให้ตกบรรทัดแล้วยังอ่านเป็นประโยคอยู่ */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-loose">
                <select
                    id="power-access"
                    value={access}
                    onChange={(e) => onChange({ access: e.target.value as AccessLevel })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                    {Object.entries(ACCESS_LEVELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>

                <span className="text-sm">{ACCESS_LEVELS[access].verb}</span>

                {showBaseline && (
                    <>
                        <span className="text-sm text-muted-foreground">— ระดับปกติคือ</span>
                        <Input
                            aria-label="ระดับที่คนทั่วไปทำได้"
                            value={baseline}
                            onChange={(e) => onChange({ baseline: e.target.value })}
                            placeholder="จุดไฟเท่าปลายเทียน ค้างได้สิบวินาที"
                            className="h-9 w-full sm:w-72 text-sm"
                        />
                    </>
                )}

                {showNote && (
                    <>
                        <span className="text-sm text-muted-foreground">— กลุ่มคือ</span>
                        <Input
                            aria-label="กลุ่มที่ใช้พลังนี้ได้"
                            value={accessNote}
                            onChange={(e) => onChange({ accessNote: e.target.value })}
                            placeholder="คนที่เกิดในตระกูลคาเงะ"
                            className="h-9 w-full sm:w-72 text-sm"
                        />
                    </>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                {showBaseline
                    ? "อ่านออกมาแล้วต้องเป็นประโยคที่จริงในโลกของคุณ — ถ้าไม่รู้ระดับปกติ คนอ่านจะไม่รู้ว่าอะไรน่าทึ่ง"
                    : "อ่านออกมาแล้วต้องเป็นประโยคที่จริงในโลกของคุณ ถ้าฟังดูผิด แปลว่ากฎยังไม่นิ่ง"}
            </p>
        </div>
    );
}
