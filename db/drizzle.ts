import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from "./schema";

config({ path: ".env" }); // or .env.local

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });
