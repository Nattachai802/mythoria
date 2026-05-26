const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT name, image FROM characters');
    console.log("--- DB CHARACTER IMAGES ---");
    for (const row of res.rows) {
      console.log(`Name: ${row.name} | Image: "${row.image}"`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
