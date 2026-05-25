import { google } from "googleapis";
import { db } from "./db/drizzle";
import { novels, driveSettings, driveCredentials } from "./db/schema";
import { eq } from "drizzle-orm";
import { oauth2Client, setCredentials } from "./lib/google-drive";

const sheets = google.sheets({ version: "v4", auth: oauth2Client });

async function main() {
  const novelId = "c54c3a84-ec7d-49cf-b087-374030a8c192";
  
  const novel = await db.query.novels.findFirst({
    where: eq(novels.id, novelId),
  });
  if (!novel) {
    console.error("Novel not found");
    return;
  }
  
  const settings = await db.query.driveSettings.findFirst({
    where: eq(driveSettings.novelId, novelId)
  });
  
  const spreadsheetId = settings?.worldbuildingSpreadsheetId;
  if (!spreadsheetId) {
    console.error("No spreadsheet ID found");
    return;
  }
  console.log(`Reading from spreadsheet: ${spreadsheetId}`);
  
  const creds = await db.query.driveCredentials.findFirst({
    where: eq(driveCredentials.userId, novel.userId)
  });
  if (!creds?.accessToken) {
    console.error("No credentials found");
    return;
  }
  
  setCredentials(creds.accessToken, creds.refreshToken ?? undefined);
  
  const ranges = ["Locations!A1:Z", "Items!A1:Z", "Lore!A1:Z", "Entities!A1:Z"];
  for (const range of ranges) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      console.log(`Range [${range}] values length: ${res.data.values?.length || 0}`);
      if (res.data.values && res.data.values.length > 0) {
        console.log("First row:", res.data.values[0]);
      }
    } catch (err: any) {
      console.error(`Error reading range ${range}:`, err.message);
    }
  }
  process.exit(0);
}

main();
