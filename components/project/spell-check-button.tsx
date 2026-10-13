"use client";

import { useState } from "react";
import { SpellCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { runSpellCheck } from "@/lib/spell-check-api";

interface SpellCheckButtonProps {
  novelId: string;
  noteId: string;
  getPlainText: () => string; // ดึง Quill getText() — index ตรงกับ editor.setSelection
  onComplete: () => void;     // callback refresh list เมื่อตรวจเสร็จ
}

export function SpellCheckButton({ novelId, noteId, getPlainText, onComplete }: SpellCheckButtonProps) {
  const [isChecking, setIsChecking] = useState(false);

  const handleSpellCheck = async () => {
    setIsChecking(true);
    try {
      const fullText = getPlainText();
      if (!fullText.trim()) {
        toast.info("ไม่มีเนื้อหาสำหรับตรวจสอบ");
        return;
      }

      const summary = await runSpellCheck({
        novelId,
        noteId,
        fullText,
        onProgress: (msg) => toast.info(msg),
      });

      if (summary.totalErrors === 0) {
        toast.success("ตรวจเสร็จ — ไม่พบคำผิด");
      } else {
        toast.success(`ตรวจเสร็จ — พบ ${summary.totalErrors} จุด เพิ่มในรายการตรวจทานแล้ว`);
      }
      onComplete();
    } catch (e) {
      console.error("[SpellCheck] ❌ Error:", e);
      toast.error(e instanceof Error && e.message ? e.message : "ตรวจคำผิดไม่สำเร็จ");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSpellCheck}
      disabled={isChecking}
      className="h-7 text-[10px] font-mono tracking-wide border-steel-700 hover:border-primary/50 hover:text-primary gap-1.5"
    >
      {isChecking ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          กำลังตรวจ...
        </>
      ) : (
        <>
          <SpellCheck className="h-3 w-3" />
          ตรวจคำผิด
        </>
      )}
    </Button>
  );
}
