"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { updateCharacter, updateCharacterSection } from "@/server/character";
import type { CharacterSection } from "@/lib/character-profile";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * State ของ jsonb หนึ่งก้อน + บันทึกอัตโนมัติ (debounce)
 * set(key, value) แทนที่ key ชั้นบนทั้งก้อน — server merge แบบตื้น จึงต้องส่ง sub-object ทั้งก้อนเสมอ
 */
export function useSection<T extends Record<string, unknown>>(
    characterId: string,
    section: CharacterSection,
    initial: T | null | undefined,
    delay = 800,
) {
    const [value, setValue] = useState<T>((initial ?? {}) as T);
    const [state, setState] = useState<SaveState>("idle");
    const pending = useRef<Partial<T>>({});
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flush = async () => {
        const patch = pending.current;
        pending.current = {};
        if (Object.keys(patch).length === 0) return;
        setState("saving");
        const res = await updateCharacterSection(characterId, section, patch);
        if (res.success) setState("saved");
        else {
            setState("error");
            toast.error("บันทึกไม่สำเร็จ", { description: res.error });
        }
    };

    const set = <K extends keyof T>(key: K, v: T[K]) => {
        setValue((prev) => ({ ...prev, [key]: v }));
        // undefined หายตอน serialize — ส่ง null ให้ server ลบ key ทิ้ง
        pending.current = { ...pending.current, [key]: v === undefined ? null : v };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, delay);
    };

    // ออกจากหน้าก่อนครบเวลา — บันทึกของค้างทันที
    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
        void flush();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { value, set, state };
}

/**
 * ช่องเดี่ยวในคอลัมน์เดิมของ characters (description/appearance/…) — บันทึกผ่าน updateCharacter
 * required = ห้ามว่าง (ชื่อ): ค่าว่างไม่บันทึก และ revert() คืนค่าที่บันทึกล่าสุด
 */
export function useCharacterText(
    characterId: string,
    field: CharacterTextField,
    initial: string | null | undefined,
    { required = false, delay = 800 } = {},
) {
    const [value, setValue] = useState(initial ?? "");
    const [state, setState] = useState<SaveState>("idle");
    const saved = useRef(initial ?? "");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const save = async (v: string) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (v === saved.current || (required && !v.trim())) return;
        setState("saving");
        const res = await updateCharacter(characterId, { [field]: v });
        if (res.success) { saved.current = v; setState("saved"); }
        else { setState("error"); toast.error("บันทึกไม่สำเร็จ", { description: res.error }); }
    };

    const change = (v: string) => {
        setValue(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(v), delay);
    };

    return {
        value,
        state,
        change,
        /** blur = บันทึกทันที · ชื่อว่างตอน blur = คืนค่าเดิม */
        commit: () => { if (required && !value.trim()) setValue(saved.current); void save(value); },
        revert: () => { if (timer.current) clearTimeout(timer.current); setValue(saved.current); },
    };
}

export type CharacterTextField =
    | "name" | "description" | "appearance" | "personality" | "backstory"
    | "age" | "gender" | "species" | "goals" | "motivation" | "conflict" | "strengths" | "weaknesses";
