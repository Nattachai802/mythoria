"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * ช่องรหัสผ่านพร้อมปุ่มดู/ซ่อน — ใช้ร่วมกันทั้ง login, signup (2 ช่อง) และ reset password
 * รับ props เหมือน Input ทุกอย่าง ({...field} ของ react-hook-form ส่งผ่านได้ตรงๆ)
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = React.useState(false)

    return (
        <div className="relative">
            <Input
                type={visible ? "text" : "password"}
                className={cn("pr-9", className)}
                {...props}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                aria-pressed={visible}
                className={cn(
                    "absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-sm",
                    "text-muted-foreground transition-colors hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                )}
            >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    )
}

export { PasswordInput }
