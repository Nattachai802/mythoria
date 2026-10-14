// สั่งตรวจคำผิดเบื้องหลังตอนเปลี่ยนสถานะโน้ต — ใช้ร่วมกันทั้งหน้าเขียน (rewrite-workspace) และแถวบท (chapter-row)
//
//   รอพิสูจน์อักษร (proofreading) -> ตรวจ แล้วเปลี่ยนเป็น "รอตรวจสอบ" ตอนเสร็จ
//   รอ Rewrite (needs_rewrite)    -> ตรวจ แต่คงสถานะไว้ (ป้าย "ต้อง rewrite" ไม่หาย)
//
// ตรวจใหม่ = ลบผลตรวจคำผิดเดิมของตอนนั้นทิ้งแล้วใส่ผลใหม่ จึงถามก่อนถ้าตอนนั้นเคยตรวจแล้ว
// ข้อจำกัด: "เคยตรวจ" ดูจากว่ามีรายการคำผิดอยู่ไหม — ตอนที่ตรวจแล้วไม่เจออะไรเลยจะไม่ถาม (ไม่มีร่องรอยให้ดู)

export const SPELL_CHECK_STATUSES = ["proofreading", "needs_rewrite"] as const;

/** จำนวนรายการคำผิด (ทุกสถานะ รวมที่แก้แล้ว) ของโน้ต — 0 = ยังไม่เคยตรวจ หรือตรวจแล้วไม่เจอ */
export async function countSpellIssues(novelId: string, noteId: string): Promise<number> {
    try {
        const res = await fetch(`/api/novel/${novelId}/note/${noteId}/audit-issues`);
        const data = await res.json();
        return (data.issues ?? []).filter((i: { category: string }) => i.category === "spelling").length;
    } catch {
        return 0;
    }
}

/** สั่งตรวจ — คืน true ถ้าสั่งสำเร็จ */
export async function triggerSpellCheck(novelId: string, noteId: string, status: string): Promise<boolean> {
    const res = await fetch(`/api/novel/${novelId}/note/${noteId}/spell-check-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setStatus: status === "proofreading" }),
    }).catch(() => null);
    if (res?.ok) window.dispatchEvent(new CustomEvent("spell-job-started", { detail: noteId }));
    return !!res?.ok;
}

/**
 * หลังเปลี่ยนสถานะ: ถ้าเป็นสถานะที่ต้องตรวจ — เคยตรวจแล้วถามก่อน แล้วค่อยสั่ง
 * คืน "started" | "skipped" | "failed" | "none" (สถานะนี้ไม่ต้องตรวจ)
 */
export async function maybeTriggerSpellCheck(novelId: string, noteId: string, status: string) {
    if (!(SPELL_CHECK_STATUSES as readonly string[]).includes(status)) return "none" as const;
    const existing = await countSpellIssues(novelId, noteId);
    if (existing > 0 && !window.confirm(
        `ตอนนี้ตรวจคำผิดไว้แล้ว (${existing} รายการ)\n\nตรวจใหม่ไหม? ผลตรวจเดิมทั้งหมดของตอนนี้ (รวมที่แก้แล้ว) จะถูกแทนที่ด้วยผลใหม่`,
    )) return "skipped" as const;
    return (await triggerSpellCheck(novelId, noteId, status)) ? "started" as const : "failed" as const;
}
