import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";

/**
 * GET /api/google-drive/auth
 *
 * สร้าง Google OAuth URL แยกต่างหากจาก better-auth
 * รองรับ Google account ที่ต่าง email กับที่ใช้ login ในแอป
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/google-drive/callback`
  );

  // เก็บ userId ใน state เพื่อใช้ตอน callback (ไม่ต้องการ session อีก)
  const state = Buffer.from(JSON.stringify({ userId: session.user.id })).toString("base64url");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",  // บังคับขอ refresh_token ทุกครั้ง
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",   // รู้ว่า connect ด้วย email อะไร
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    state,
  });

  return NextResponse.redirect(authUrl);
}
