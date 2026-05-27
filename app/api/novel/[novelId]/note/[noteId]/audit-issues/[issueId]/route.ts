import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { noteAuditIssues } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Props = {
    params: Promise<{
        novelId: string;
        noteId: string;
        issueId: string;
    }>;
};

export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { novelId, noteId, issueId } = await params;
        const body = await request.json();
        const { startIndex, endIndex, status, suggestedText, suggestionNotes, issueDescription } = body;

        const [updatedIssue] = await db
            .update(noteAuditIssues)
            .set({
                ...(startIndex !== undefined && { startIndex }),
                ...(endIndex !== undefined && { endIndex }),
                ...(status !== undefined && { status }),
                ...(suggestedText !== undefined && { suggestedText }),
                ...(suggestionNotes !== undefined && { suggestionNotes }),
                ...(issueDescription !== undefined && { issueDescription }),
            })
            .where(
                and(
                    eq(noteAuditIssues.id, issueId),
                    eq(noteAuditIssues.noteId, noteId),
                    eq(noteAuditIssues.novelId, novelId)
                )
            )
            .returning();

        if (!updatedIssue) {
            return NextResponse.json({ success: false, error: "Issue not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, issue: updatedIssue });
    } catch (error) {
        console.error("Error updating audit issue:", error);
        return NextResponse.json({ success: false, error: "Failed to update audit issue" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Props) {
    try {
        const { novelId, noteId, issueId } = await params;
        const [deletedIssue] = await db
            .delete(noteAuditIssues)
            .where(
                and(
                    eq(noteAuditIssues.id, issueId),
                    eq(noteAuditIssues.noteId, noteId),
                    eq(noteAuditIssues.novelId, novelId)
                )
            )
            .returning();

        if (!deletedIssue) {
            return NextResponse.json({ success: false, error: "Issue not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, issue: deletedIssue });
    } catch (error) {
        console.error("Error deleting audit issue:", error);
        return NextResponse.json({ success: false, error: "Failed to delete audit issue" }, { status: 500 });
    }
}
