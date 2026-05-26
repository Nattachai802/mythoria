import { db } from "../db/drizzle";
import { characters } from "../db/schema";

async function main() {
  const charList = await db.query.characters.findMany();
  console.log("--- DB CHARACTER IMAGES ---");
  for (const c of charList) {
    console.log(`Name: ${c.name} | Image: "${c.image}"`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
