import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle"; // your drizzle
import { schema } from "@/db/schema";
import { nextCookies } from "better-auth/next-js";
import { resend } from "@/lib/email";
import { assertInviteUsable, consumeInvite, INVITE_COOKIE } from "@/lib/invitations";


export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${url}`,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
      // ขอแค่ระบุตัวตน — Google Drive/Docs/Sheets ใช้ OAuth คนละชุด (ดู app/api/google-drive/auth)
      // เก็บ token แยกในตาราง driveCredentials จึงไม่ต้องขอสิทธิ์ไฟล์ตั้งแต่ตอนล็อกอิน
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&prompt=consent",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    }
  },

  /**
   * ด่านเดียวคุมการสมัครทุกทาง
   *
   * ทั้ง createUser (ทางอีเมล) และ createOAuthUser (ทาง Google) เรียก createWithHooks
   * ตัวเดียวกัน จุดนี้จึงเป็นคอขวดที่ทุกวิธีสมัครต้องผ่าน — ต่างจากของเดิมที่ดักไว้ใน
   * route handler ด้วยการเทียบชื่อ path ซึ่งดักได้แค่ทางอีเมลทางเดียว
   *
   * ต้อง throw ไม่ใช่ return false — ถ้าคืน false ทาง Google จะได้ createdUser เป็น null
   * แล้วโค้ดข้างในอ่าน createdUser.id ต่อทันที กลายเป็น TypeError ที่ผู้ใช้อ่านไม่รู้เรื่อง
   * ส่วน APIError จะถูกส่งต่อพร้อมข้อความของเราไปถึงผู้ใช้ทั้งสองทาง
   *
   * hook นี้ทำงานเฉพาะตอนสร้างบัญชีใหม่ ไม่กระทบคนที่มีบัญชีอยู่แล้ว
   */
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          await assertInviteUsable(context?.getCookie(INVITE_COOKIE));
        },
        after: async (user, context) => {
          // บัญชีถูกสร้างสำเร็จไปแล้วตรงนี้ การหักโควตาเป็นแค่การลงบัญชี
          // ถ้าพลาดก็ไม่ควรทำให้การสมัครที่สำเร็จแล้วล้มตาม — แค่บันทึก log ไว้
          try {
            const code = context?.getCookie(INVITE_COOKIE);
            await consumeInvite(code);
            if (code) context?.setCookie(INVITE_COOKIE, "", { maxAge: 0, path: "/" });
          } catch (error) {
            console.error("[Auth] หักโควตารหัสเชิญไม่สำเร็จ", error);
          }
        },
      },
    },
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),

  plugins: [nextCookies()]
});
