"use client"

import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "./ui/button"

export function Logout() {
  const router = useRouter()
  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Logout
    </Button>
  )
}
