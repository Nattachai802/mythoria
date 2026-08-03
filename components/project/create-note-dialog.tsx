"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createNote } from "@/server/note"
import { toast } from "sonner"

interface CreateNoteDialogProps {
    novelId: string
    chapterId?: string
    trigger?: React.ReactNode
}

export function CreateNoteDialog({ novelId, chapterId, trigger }: CreateNoteDialogProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleCreate() {
        if (loading) return
        setLoading(true)

        try {
            const result = await createNote({
                title: "Untitled Note",
                content: { text: "" }, // Default empty content
                novelId,
                linkedToChapterId: chapterId,
                type: "general"
            })

            if (result.success && result.note) {
                toast.success("สร้างตอนใหม่แล้ว กำลังเปิด...")
                // Navigate ไปหน้า note ใหม่เลย (SPA navigation ไม่ต้อง reload)
                //
                // ไม่ setLoading(false) ตรงนี้ — router.push() แค่สั่งให้เริ่มเปลี่ยนหน้า ไม่ได้รอจนโหลดเสร็จ
                // ถ้าปลด loading ทันทีปุ่มจะกลับเป็นปกติทั้งที่หน้ายังไม่ขยับ ผู้ใช้อ่านว่า "กดแล้วไม่มีอะไรเกิดขึ้น"
                // ปล่อยให้ค้างสถานะไว้จน component ถูก unmount ตอนเปลี่ยนหน้าสำเร็จ
                router.push(`/dashboard/project/${novelId}/note/${result.note.id}`)
                return
            }

            toast.error(result.message)
        } catch (error) {
            toast.error("Something went wrong")
        }

        setLoading(false)
    }

    if (trigger) {
        return (
            <div
                onClick={handleCreate}
                aria-busy={loading}
                className={loading ? "cursor-wait opacity-60 pointer-events-none" : "cursor-pointer"}
            >
                {trigger}
            </div>
        )
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] ml-auto px-2"
            onClick={handleCreate}
            disabled={loading}
        >
            <Plus className="mr-1 h-2.5 w-2.5" />
            {loading ? "Adding..." : "Add"}
        </Button>
    )
}
