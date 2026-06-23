"use client";

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { AssistantPanel } from "./assistant-panel";

/** ปุ่มลอยเปิดผู้ช่วยจัดการข้อมูล — mount ใน project layout ใช้ได้ทุกหน้า */
export function AssistantLauncher({ novelId }: { novelId: string }) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    size="icon"
                    className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                    title="ผู้ช่วยจัดการข้อมูล"
                    aria-label="เปิดผู้ช่วยจัดการข้อมูล"
                >
                    <Wand2 className="w-5 h-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-full sm:max-w-[400px] gap-0">
                <SheetTitle className="sr-only">ผู้ช่วยจัดการข้อมูล</SheetTitle>
                <AssistantPanel novelId={novelId} className="h-full" />
            </SheetContent>
        </Sheet>
    );
}
