
import { getTimelineEventById } from "../server/timeline";

async function main() {
    const eventId = "f5349c2c-eba4-4afc-89cc-ff795c04648b";
    console.log("Testing getTimelineEventById with ID:", eventId);

    try {
        const result = await getTimelineEventById(eventId);
        console.log("Result:", result);
    } catch (error) {
        console.error("Error calling getTimelineEventById:", error);
    }
}

main();
