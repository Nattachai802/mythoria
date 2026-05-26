import { db } from "../db/drizzle";
import { loreEntries } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const novelId = "c54c3a84-ec7d-49cf-b087-374030a8c192";
  const lores = await db.query.loreEntries.findMany({
    where: eq(loreEntries.novelId, novelId),
    with: {
      parentLore: true,
    }
  });

  console.log("--- DB LORE ENTRIES ---");
  for (const l of lores) {
    console.log(`ID: ${l.id} | Title: "${l.title}" | parentLoreId: ${l.parentLoreId} | parentLoreTitle: "${l.parentLore?.title || 'None'}"`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
