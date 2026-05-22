import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

config({ path: ".env" });

const connectionString = process.env.DB_TARGET === 'local'
    ? process.env.LOCAL_DATABASE_URL
    : (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

let dbInstance;

if (process.env.NODE_ENV === "production") {
    const pool = new Pool({
        connectionString: connectionString!,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });
    dbInstance = drizzle(pool, { schema });
} else {
    const globalRef = globalThis as unknown as { db: any };
    if (!globalRef.db) {
        const pool = new Pool({
            connectionString: connectionString!,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
        globalRef.db = drizzle(pool, { schema });
    }
    dbInstance = globalRef.db;
}

export const db = dbInstance;
