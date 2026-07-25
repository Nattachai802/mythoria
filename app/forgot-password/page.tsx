import { ForgotPasswordForm } from "@/components/forms/forgot-password-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function Page() {
  return (
    <AuthShell
      title="ลืมรหัสผ่าน"
      description="กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์สำหรับตั้งรหัสใหม่ไปให้"
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
