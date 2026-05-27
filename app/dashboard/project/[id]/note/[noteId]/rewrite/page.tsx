import { notFound } from "next/navigation"
import { getNote } from "@/server/note"
import { getNovelById } from "@/server/novel"
import { RewriteWorkspace } from "@/components/project/rewrite-workspace"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"

interface Props {
    params: Promise<{
        id: string;
        noteId: string;
    }>;
}

export default async function RewritePage({ params }: Props) {
    const { id, noteId } = await params;

    const [noteRes, novelRes] = await Promise.all([
        getNote(noteId),
        getNovelById(id)
    ]);

    if (!noteRes.success || !noteRes.note) {
        notFound();
    }

    const novelTitle = novelRes.novel?.title || "Project";

    return (
        <div className="container mx-auto px-4 py-2">
            <ProjectBreadcrumb
                novelId={id}
                novelTitle={novelTitle}
                items={[
                    { label: noteRes.note.title, href: `/dashboard/project/${id}/note/${noteId}` },
                    { label: "Rewrite Workspace" }
                ]}
            />
            <RewriteWorkspace 
                initialNote={noteRes.note} 
                novelId={id} 
            />
        </div>
    )
}
