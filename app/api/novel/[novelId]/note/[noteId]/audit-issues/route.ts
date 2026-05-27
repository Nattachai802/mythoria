import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { noteAuditIssues } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Props = {
    params: Promise<{
        novelId: string;
        noteId: string;
    }>;
};

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { novelId, noteId } = await params;
        const issues = await db.query.noteAuditIssues.findMany({
            where: and(
                eq(noteAuditIssues.novelId, novelId),
                eq(noteAuditIssues.noteId, noteId)
            ),
        });
        return NextResponse.json({ success: true, issues });
    } catch (error) {
        console.error("Error fetching audit issues:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch audit issues" }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: Props) {
    try {
        const { novelId, noteId } = await params;
        const body = await request.json();
        const { level, category, startIndex, endIndex, flaggedText, issueDescription, suggestedText, suggestionNotes } = body;

        if (!level || !category || startIndex === undefined || endIndex === undefined || !flaggedText || !issueDescription) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        const [newIssue] = await db.insert(noteAuditIssues).values({
            novelId,
            noteId,
            level,
            category,
            startIndex,
            endIndex,
            flaggedText,
            issueDescription,
            suggestedText,
            suggestionNotes,
            status: "unresolved",
        }).returning();

        return NextResponse.json({ success: true, issue: newIssue }, { status: 201 });
    } catch (error) {
        console.error("Error creating audit issue:", error);
        return NextResponse.json({ success: false, error: "Failed to create audit issue" }, { status: 500 });
    }
}
