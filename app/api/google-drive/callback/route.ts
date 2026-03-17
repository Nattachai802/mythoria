import { NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/drizzle";
import { driveCredentials } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/google-drive/callback
 *
 * รับ authorization code จาก Google แล้วแลก Token เก็บลง DB
 * ผูก Token กับ userId ของแอป — ไม่สนใจว่า email จะตรงกับ login หรือไม่
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateB64 = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/dashboard/settings`;

  // User ยกเลิก consent screen
  if (error) {
    console.error("[DRIVE_CALLBACK] Google OAuth error:", error);
    return NextResponse.redirect(`${settingsUrl}?drive_status=cancelled`);
  }

  if (!code || !stateB64) {
    return NextResponse.redirect(`${settingsUrl}?drive_status=error&reason=missing_params`);
  }

  try {
    // ถอด userId จาก state
    const { userId } = JSON.parse(Buffer.from(stateB64, "base64url").toString());

    if (!userId) {
      return NextResponse.redirect(`${settingsUrl}?drive_status=error&reason=invalid_state`);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/google-drive/callback`
    );

    // แลก code เป็น tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(`${settingsUrl}?drive_status=error&reason=no_token`);
    }

    // ดึง email ของ Google account ที่ user เลือก (เพื่อแสดงใน UI)
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    // บันทึก/อัปเดต Token ใน DB — ผูกกับ userId ของแอป
    await db
      .insert(driveCredentials)
      .values({
        userId,
        googleEmail: googleUser.email!,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      })
      .onConflictDoUpdate({
        target: [driveCredentials.userId],  // upsert by userId
        set: {
          googleEmail: googleUser.email!,
          accessToken: tokens.access_token,
          // refresh_token อาจไม่ส่งมาถ้าเคย grant แล้ว — อัปเดตเฉพาะเมื่อมี
          ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          updatedAt: new Date(),
        },
      });

    console.log(`[DRIVE_CALLBACK] Connected Google Drive for userId=${userId} (${googleUser.email})`);

    return NextResponse.redirect(`${settingsUrl}?drive_status=connected`);
  } catch (err) {
    console.error("[DRIVE_CALLBACK] Error:", err);
    return NextResponse.redirect(`${settingsUrl}?drive_status=error&reason=server_error`);
  }
}
