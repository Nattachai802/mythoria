import { NextResponse } from "next/server";
import { initializeDriveSync } from "@/server/drive-sync";

export async function POST(req: Request) {
  try {
    const { novelId } = await req.json();

    if (!novelId) {
      return NextResponse.json({ error: "Missing novelId" }, { status: 400 });
    }

    const result = await initializeDriveSync(novelId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[DRIVE_CONNECT_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize Drive sync" },
      { status: 500 }
    );
  }
}
