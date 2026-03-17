import { notFound } from "next/navigation"
import { getNote } from "@/server/note"
import { getNovelById } from "@/server/novel"
import { NoteEditor } from "@/components/project/note-editor"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"

interface Props {
    params: Promise<{
        id: string
        noteId: string
    }>
}

export default async function NotePage({ params }: Props) {
    const { id, noteId } = await params

    const [result, novelResult] = await Promise.all([
        getNote(noteId),
        getNovelById(id)
    ]);

    if (!result.success || !result.note) {
        notFound()
    }

    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="container mx-auto px-4 py-2">
            <ProjectBreadcrumb
                novelId={id}
                novelTitle={novelTitle}
                items={[{ label: result.note.title }]}
            />
            <NoteEditor note={result.note} novelId={id} />
        </div>
    )
}