import { config } from 'dotenv';
import { defineConfig } from "drizzle-kit";

config({ path: '.env' });

const connectionString = process.env.DB_TARGET === 'local'
  ? process.env.LOCAL_DATABASE_URL
  : (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString!,
  },
  verbose: true,
  strict: true,
});
