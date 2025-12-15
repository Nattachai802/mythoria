'use server';

import { db } from "@/db/drizzle";
import { notes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createIdea(data: {
    title: string;
    content: any; // jsonb content from rich text editor
    novelId: string;
    tags?: string[];
    linkedToChapterId?: string;
    linkedToCharacterId?: string;
    linkedToLocationId?: string;
}) {
    try {
        const [newIdea] = await db
            .insert(notes)
            .values({
                ...data,
                type: "idea",
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/idea`);

        return { success: true, data: newIdea };
    } catch (error) {
        console.error("Error creating idea:", error);
        return { success: false, error: "Failed to create idea" };
    }
}

export async function getIdeasByNovelId(novelId: string) {
    try {
        const allIdeas = await db
            .select()
            .from(notes)
            .where(
                and(
                    eq(notes.novelId, novelId),
                    eq(notes.type, "idea") // filter เฉพาะ type = idea
                )
            )
            .orderBy(notes.createdAt);

        return { success: true, data: allIdeas };
    } catch (error) {
        console.error("Error fetching ideas:", error);
        return { success: false, error: "Failed to fetch ideas" };
    }
}

export async function getIdeaById(ideaId: string) {
    try {
        const [idea] = await db
            .select()
            .from(notes)
            .where(
                and(
                    eq(notes.id, ideaId),
                    eq(notes.type, "idea")
                )
            )
            .limit(1);

        if (!idea) {
            return { success: false, error: "Idea not found" };
        }

        return { success: true, data: idea };
    } catch (error) {
        console.error("Error fetching idea:", error);
        return { success: false, error: "Failed to fetch idea" };
    }
}

export async function updateIdea(
    ideaId: string,
    data: Partial<{
        title: string;
        content: any;
        tags: string[];
        linkedToChapterId: string;
        linkedToCharacterId: string;
        linkedToLocationId: string;
    }>
) {
    try {
        const [updatedIdea] = await db
            .update(notes)
            .set({ ...data, updatedAt: new Date() })
            .where(
                and(
                    eq(notes.id, ideaId),
                    eq(notes.type, "idea")
                )
            )
            .returning();

        if (!updatedIdea) {
            return { success: false, error: "Idea not found" };
        }

        revalidatePath(`/dashboard/project/${updatedIdea.novelId}/idea`);

        return { success: true, data: updatedIdea };
    } catch (error) {
        console.error("Error updating idea:", error);
        return { success: false, error: "Failed to update idea" };
    }
}

export async function deleteIdea(ideaId: string) {
    try {
        const [deletedIdea] = await db
            .delete(notes)
            .where(
                and(
                    eq(notes.id, ideaId),
                    eq(notes.type, "idea")
                )
            )
            .returning();

        if (!deletedIdea) {
            return { success: false, error: "Idea not found" };
        }

        revalidatePath(`/dashboard/project/${deletedIdea.novelId}/idea`);

        return { success: true, data: deletedIdea };
    } catch (error) {
        console.error("Error deleting idea:", error);
        return { success: false, error: "Failed to delete idea" };
    }
}