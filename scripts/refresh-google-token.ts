/**
 * scripts/refresh-google-token.ts
 *
 * สร้าง Google OAuth URL → คุณเปิดในบราวเซอร์ → copy code กลับมาวาง
 * Script จะแลก code เป็น tokens และบันทึกลง DB โดยไม่ต้องรัน Next.js
 *
 * วิธีใช้:
 *   npx tsx scripts/refresh-google-token.ts
 *   (แล้วทำตาม prompt ที่ปรากฏ)
 */

import { google } from "googleapis";
import { db } from "../db/drizzle";
import { driveCredentials, user } from "../db/schema";
import { eq } from "drizzle-orm";
import * as readline from "readline";

const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/google-drive/callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n=== Google OAuth Token Refresh ===\n");

  // 1. หา user ทั้งหมดในระบบ
  const users = await db.select({ id: user.id, name: user.name, email: user.email }).from(user);
  if (users.length === 0) {
    console.error("❌ ไม่มี user ในฐานข้อมูล");
    process.exit(1);
  }

  console.log("Users ที่มีในระบบ:");
  users.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name} (${u.email}) — id: ${u.id}`);
  });

  let targetUserId: string;
  if (users.length === 1) {
    targetUserId = users[0].id;
    console.log(`\nใช้ user: ${users[0].name} (${users[0].email})`);
  } else {
    const input = await prompt("\nเลือกหมายเลข user (หรือวาง userId โดยตรง): ");
    const idx = parseInt(input) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < users.length) {
      targetUserId = users[idx].id;
    } else {
      // ถ้าไม่ใช่ตัวเลข ให้ถือว่าเป็น userId โดยตรง
      targetUserId = input;
    }
  }

  // 2. สร้าง state แบบเดียวกับ /api/google-drive/auth
  const state = Buffer.from(JSON.stringify({ userId: targetUserId })).toString("base64url");

  // 3. Generate Auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // บังคับขอ refresh_token ใหม่
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    state,
  });

  console.log("\n📋 เปิด URL นี้ในบราวเซอร์ของคุณ:\n");
  console.log(authUrl);
  console.log("\n⚠️  หลังจาก Google redirect กลับมา บราวเซอร์จะแสดง error (เพราะ localhost:3000 อาจไม่ทำงาน)");
  console.log("   → ให้ copy URL ทั้งหมดจาก address bar ของบราวเซอร์แล้ววางที่นี่\n");

  const redirectedUrl = await prompt("วาง URL ที่ redirect มา (หรือวาง code= ส่วนเดียว): ");

  // 4. Extract code จาก URL หรือ code โดยตรง
  let code: string;
  let extractedUserId = targetUserId;

  if (redirectedUrl.startsWith("http")) {
    const url = new URL(redirectedUrl);
    const urlCode = url.searchParams.get("code");
    const urlState = url.searchParams.get("state");

    if (!urlCode) {
      console.error("❌ ไม่พบ code ใน URL ที่วางมา");
      process.exit(1);
    }
    code = urlCode;

    if (urlState) {
      try {
        const decoded = JSON.parse(Buffer.from(urlState, "base64url").toString());
        if (decoded.userId) extractedUserId = decoded.userId;
      } catch {}
    }
  } else {
    // วาง code โดยตรง
    code = redirectedUrl;
  }

  console.log(`\n🔄 กำลังแลก code เป็น tokens...`);

  try {
    // 5. แลก code เป็น tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      console.error("❌ ไม่ได้รับ access_token จาก Google");
      process.exit(1);
    }

    // 6. ดึง email ของ Google account
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    console.log(`✅ ได้รับ token สำหรับ: ${googleUser.email}`);
    console.log(`   access_token: ${tokens.access_token?.substring(0, 20)}...`);
    console.log(`   refresh_token: ${tokens.refresh_token ? "มี ✓" : "ไม่มี (ใช้อันเก่า)"}`);

    // 7. บันทึกลง DB
    await db
      .insert(driveCredentials)
      .values({
        userId: extractedUserId,
        googleEmail: googleUser.email!,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      })
      .onConflictDoUpdate({
        target: [driveCredentials.userId],
        set: {
          googleEmail: googleUser.email!,
          accessToken: tokens.access_token,
          ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          updatedAt: new Date(),
        },
      });

    console.log(`\n✅ บันทึก token ลง DB สำเร็จ! (userId: ${extractedUserId})`);
    console.log("\nตอนนี้รัน sync ได้เลย:");
    console.log("  npx tsx scripts/sync-sheets.ts c54c3a84-ec7d-49cf-b087-374030a8c192\n");
  } catch (err: any) {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
