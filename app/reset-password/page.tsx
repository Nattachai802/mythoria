"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ResetPasswordForm } from "@/components/forms/reset-password-form"
import { AuthShell } from "@/components/auth/auth-shell"

// useSearchParams() บังคับให้ต้องมี Suspense คร่อม ไม่งั้น build จะล้มตอน prerender หน้านี้
// คร่อมเฉพาะส่วนที่อ่าน token — โครงหน้ากับหัวข้อ render ได้ทันทีโดยไม่ต้องรอ
function ResetPasswordFields() {
  const token = useSearchParams().get("token")
  return <ResetPasswordForm token={token} />
}

export default function Page() {
  return (
    <AuthShell
      title="ตั้งรหัสผ่านใหม่"
      description="เลือกรหัสผ่านใหม่เพื่อความปลอดภัยของบัญชี"
    >
      <Suspense fallback={<div className="h-40" />}>
        <ResetPasswordFields />
      </Suspense>
    </AuthShell>
  )
}
