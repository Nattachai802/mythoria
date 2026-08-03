"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteAllIdeas } from "@/server/idea";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteAllIdeasButtonProps {
    novelId: string;
    ideaCount: number;
}

export function DeleteAllIdeasButton({ novelId, ideaCount }: DeleteAllIdeasButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteAllIdeas(novelId);

            if (result.success) {
                toast.success(`ลบไอเดียทั้งหมด ${result.count} อันแล้ว`);
                window.location.reload();
            } else {
                toast.error(result.error || "ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
        } finally {
            setIsDeleting(false);
        }
    };

    if (ideaCount === 0) return null;

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                >
                    <Trash2 className="w-4 h-4" />
                    ลบทั้งหมด
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        ลบไอเดียทั้งหมด?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        จะลบไอเดียทั้งหมด <strong>{ideaCount} อัน</strong> ของนิยายเรื่องนี้อย่างถาวร — รวมทั้งที่ใช้ไปแล้วและที่ AI ตรวจพบ กู้คืนไม่ได้
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? "กำลังลบ..." : `ลบทั้ง ${ideaCount} อัน`}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
