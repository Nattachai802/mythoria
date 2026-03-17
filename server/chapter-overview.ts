"use server"

import { db } from "@/db/drizzle";
import { timelineEvents, sceneElementDetails } from "@/db/schema"
import { eq, asc, inArray } from "drizzle-orm"

export async function getChapterOverview(chapterId: string) {
    try {
        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.relatedChapterId, chapterId),
            orderBy: [asc(timelineEvents.orderIndex)],
        })

        // Fetch scene element details (notes) for all events in one query
        const eventIds = events.map(e => e.id);
        let allDetails: any[] = [];
        if (eventIds.length > 0) {
            allDetails = await db.query.sceneElementDetails.findMany({
                where: inArray(sceneElementDetails.sceneId, eventIds),
            });
        }

        // Attach details to each event
        const eventsWithDetails = events.map(event => ({
            ...event,
            elementDetails: allDetails.filter(d => d.sceneId === event.id),
        }));

        return { success: true, events: eventsWithDetails }
    } catch (error) {
        console.error("Error fetching chapter overview:", error)
        return { success: false, error: "Failed to fetch chapter overview" }
    }
}
