import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle"; // your drizzle 
import { schema } from "@/db/schema";
import { nextCookies } from "better-auth/next-js";
import { resend } from "@/lib/email";


export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await resend.emails.send({
        from: "mythoria.noreply@gmail.com",
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
  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),

  plugins: [nextCookies()]
});