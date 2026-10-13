import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { getSpellEntities } from "@/lib/spell-entities";

type Props = { params: Promise<{ novelId: string }> };

// GET — คำเฉพาะของเรื่อง (ตัวละคร ฝ่าย สถานที่ ฯลฯ) สำหรับปุ่มตรวจคำผิดฝั่ง client
export async function GET(_request: NextRequest, { params }: Props) {
    const { novelId } = await params;
    const denied = await guardNovel(novelId); if (denied) return denied;
    try {
        return NextResponse.json({ success: true, entities: await getSpellEntities(novelId) });
    } catch (error) {
        console.error("Error fetching spell entities:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch entities" }, { status: 500 });
    }
}
