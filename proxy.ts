import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

// Auth gate for dashboard routes. Proxy always runs on Node.js runtime,
// so route config is not needed here.
export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}
