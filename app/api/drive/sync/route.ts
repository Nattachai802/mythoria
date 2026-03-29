import { NextResponse } from "next/server";
import { syncNoteToDrive } from "@/server/drive-sync";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { driveCredentials } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { noteId, forceContent } = await req.json();

    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const result = await syncNoteToDrive(noteId, forceContent);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[DRIVE_SYNC_ERROR]", error);

    // Google OAuth token expired / revoked → clear credentials, force re-auth
    const isAuthExpired =
      error.message?.includes("invalid_grant") ||
      error.code === 400 ||
      error.response?.data?.error === "invalid_grant";

    if (isAuthExpired) {
      try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (session?.user?.id) {
          await db.delete(driveCredentials).where(eq(driveCredentials.userId, session.user.id));
          console.log("[DRIVE_SYNC] Cleared expired credentials for user:", session.user.id);
        }
      } catch (clearErr) {
        console.error("[DRIVE_SYNC] Failed to clear credentials:", clearErr);
      }

      return NextResponse.json(
        { error: "Google Drive token has expired. Please reconnect.", code: "auth_expired" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to sync note to Google Drive" },
      { status: 500 }
    );
  }
}
