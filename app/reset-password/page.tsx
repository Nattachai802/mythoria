"use client"

import { useSearchParams } from "next/navigation"
import { ResetPasswordForm } from "@/components/forms/reset-password-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function Page() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  return (
    <AuthShell
      title="ตั้งรหัสผ่านใหม่"
      description="เลือกรหัสผ่านใหม่เพื่อความปลอดภัยของบัญชี"
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  )
}
