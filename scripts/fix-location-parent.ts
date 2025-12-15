import { db } from "../db/drizzle";
import { sql } from "drizzle-orm";

async function fixLocationParentIds() {
    console.log("Fixing empty parentLocationId values...");

    try {
        // Update empty strings to NULL
        await db.execute(sql`
            UPDATE locations 
            SET parent_location_id = NULL 
            WHERE parent_location_id = ''
        `);

        console.log("✅ Fixed parentLocationId values");
        console.log("Now you can run: npx drizzle-kit push");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

fixLocationParentIds();
