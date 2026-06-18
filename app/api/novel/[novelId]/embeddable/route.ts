import { NextRequest, NextResponse } from "next/server";
import { getEmbeddableContent } from "@/server/registry/entity-registry";

interface Props {
    params: Promise<{ novelId: string }>;
}

// เนื้อหา entity ทุก type (ยกเว้น note/chapter) ในรูปแบบ {type,id,title,text}
// สำหรับ python RAG sync ดึงไป embed — identity ตรงกับ reference layer
export async function GET(_request: NextRequest, { params }: Props) {
    try {
        const { novelId } = await params;
        const records = await getEmbeddableContent(novelId);
        return NextResponse.json({ success: true, records });
    } catch (error) {
        console.error("Error building embeddable content:", error);
        return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
    }
}
