"use client"

import { useSearchParams } from "next/navigation"
import { ResetPasswordForm } from "@/components/forms/reset-password-form"

export default function Page() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  )
}
