import { LoginForm } from "@/components/forms/login-form"
import { AuthShell } from "@/components/auth/auth-shell"

export default function Page() {
  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      description="ยินดีต้อนรับกลับ กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน"
    >
      <LoginForm />
    </AuthShell>
  )
}
