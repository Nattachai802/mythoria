import { syncWorldBuilding2Way } from "../server/sheets-sync";
import { db } from "../db/drizzle";
import { novels, driveCredentials } from "../db/schema";
import { eq } from "drizzle-orm";
import { setCredentials } from "../lib/google-drive";

async function main() {
  const args = process.argv.slice(2);
  let novelId = args[0];

  if (!novelId) {
    console.log("No Novel ID provided. Checking database for available novels...");
    const allNovels = await db.select().from(novels);
    if (allNovels.length === 0) {
      console.error("No novels found in the database.");
      process.exit(1);
    }
    
    console.log("Available novels:");
    allNovels.forEach(n => {
      console.log(`- ID: ${n.id}  (Title: ${n.title})`);
    });
    
    // Pick the first one as default
    novelId = allNovels[0].id;
    console.log(`Using default novel ID: ${novelId} ("${allNovels[0].title}")`);
  }

  console.log(`\n[CLI_SYNC] Initiating sync for novel: ${novelId}`);

  try {
    const novel = await db.query.novels.findFirst({
      where: eq(novels.id, novelId),
    });

    if (!novel) {
      console.error(`Error: Novel with ID ${novelId} not found.`);
      process.exit(1);
    }

    const creds = await db.query.driveCredentials.findFirst({
      where: eq(driveCredentials.userId, novel.userId),
    });

    if (!creds || !creds.accessToken) {
      console.error(`Error: Google Drive credentials not found or not connected for user of novel: "${novel.title}".`);
      process.exit(1);
    }

    // Set OAuth credentials and set flag to bypass request-bound session auth
    setCredentials(creds.accessToken, creds.refreshToken ?? undefined);
    process.env.CLI_SYNC = "true";

    console.log(`Connecting with Google Account: ${creds.googleEmail || "Unknown"}`);
    console.log("Starting 2-way Google Sheets synchronization...");
    
    const result = await syncWorldBuilding2Way(novelId);
    
    if (result.success) {
      console.log("\n✅ Sync Completed Successfully!");
      console.log(`Google Sheets URL: ${result.spreadsheetUrl}`);
    } else {
      console.error(`\n❌ Sync Failed: ${result.error}`);
    }

  } catch (error) {
    console.error("\n❌ Unexpected error during CLI sync:", error);
  } finally {
    process.exit(0);
  }
}

main();
