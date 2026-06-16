import { db } from "../db/drizzle";
import { driveCredentials } from "../db/schema";

async function main() {
  const credsList = await db.query.driveCredentials.findMany();

  console.log("--- GOOGLE DRIVE CREDENTIALS IN DB ---");
  for (const cred of credsList) {
    console.log({
      userId: cred.userId,
      googleEmail: cred.googleEmail,
      accessTokenExists: !!cred.accessToken,
      accessTokenPreview: cred.accessToken ? cred.accessToken.substring(0, 10) + "..." : "none",
      refreshTokenExists: !!cred.refreshToken,
      refreshTokenPreview: cred.refreshToken ? cred.refreshToken.substring(0, 10) + "..." : "none",
      expiresAt: cred.expiresAt,
    });
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
