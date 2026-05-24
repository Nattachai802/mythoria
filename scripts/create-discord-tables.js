const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error("NEON_DATABASE_URL is not defined in env");
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  console.log("Connected to database.");
  
  const query = `
    -- 1. สร้างตารางเก็บไอเดียจาก Discord
    CREATE TABLE IF NOT EXISTS discord_ideas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        novel_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        tags TEXT[] DEFAULT '{}',
        discord_user_id VARCHAR(100),
        discord_username VARCHAR(100),
        discord_channel_id VARCHAR(100),
        discord_message_id VARCHAR(100),
        is_synced BOOLEAN DEFAULT FALSE,
        synced_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 2. สร้างตารางเก็บการตั้งค่า Channel ของ Discord
    CREATE TABLE IF NOT EXISTS discord_channel_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id VARCHAR(100) UNIQUE NOT NULL,
        novel_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  console.log("Executing table creation queries...");
  await client.query(query);
  console.log("Tables created successfully.");
  await client.end();
}

main().catch(err => {
  console.error("Error creating tables:", err);
  process.exit(1);
});
