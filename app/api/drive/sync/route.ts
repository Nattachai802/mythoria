import { NextResponse } from "next/server";
import { syncNoteToDrive } from "@/server/drive-sync";

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
    return NextResponse.json(
      { error: error.message || "Failed to sync note to Google Drive" },
      { status: 500 }
    );
  }
}
