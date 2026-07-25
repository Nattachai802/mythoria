import { SignupForm } from "@/components/forms/signup-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function Page() {
  return (
    <AuthShell
      title="สร้างบัญชีใหม่"
      description="ต้องมีรหัสเชิญจึงจะสมัครได้ — Mythoria ยังไม่เปิดให้บุคคลทั่วไป"
    >
      <SignupForm />
    </AuthShell>
  )
}
