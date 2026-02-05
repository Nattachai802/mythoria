
import { db } from "../db/drizzle";
import { timelineEvents } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const eventId = "f5349c2c-eba4-4afc-89cc-ff795c04648b";
    console.log("Checking for event ID:", eventId);

    try {
        const event = await db.query.timelineEvents.findFirst({
            where: eq(timelineEvents.id, eventId),
        });

        console.log("Event found:", event);

        // Also list all events just in case
        const allEvents = await db.query.timelineEvents.findMany();
        console.log("Total events count:", allEvents.length);
        console.log("All event IDs:", allEvents.map(e => e.id));

    } catch (error) {
        console.error("Error querying database:", error);
    }
}

main();
