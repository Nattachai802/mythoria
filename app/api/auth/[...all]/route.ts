import { auth } from "@/lib/auth"; // path to your auth file
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";

const handler = toNextJsHandler(auth);

export async function POST(req: NextRequest) {
  // If the request is for email signup, intercept it and validate the registration code
  if (req.nextUrl.pathname.endsWith("/api/auth/sign-up/email")) {
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.json().catch(() => null);

      const inviteCode = body?.inviteCode;
      const expectedCode = process.env.REGISTRATION_CODE;

      // If a registration code is configured in .env, check if the input matches
      if (expectedCode && inviteCode !== expectedCode) {
        console.warn("[Auth] Registration attempt with invalid or missing invite code");
        return NextResponse.json(
          {
            error: {
              message: "Invalid or missing invite/authentication code. Registration is restricted.",
            },
          },
          { status: 400 }
        );
      }

      // Strip inviteCode ออกก่อนส่งไปยัง better-auth เพื่อป้องกัน schema validation error
      if (body && "inviteCode" in body) {
        console.info("[Auth] Sign-up: stripping inviteCode before forwarding to better-auth");
        const { inviteCode: _, ...cleanBody } = body;
        const cleanReq = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(cleanBody),
        });
        return handler.POST(cleanReq);
      }
    } catch (e) {
      console.error("[Auth] Error during signup code validation:", e);
    }
  }

  return handler.POST(req);
}

export async function GET(req: NextRequest) {
  return handler.GET(req);
}