const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: '.env' });

// Configure Cloudinary from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set in environment variables.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function sync() {
  const client = await pool.connect();
  try {
    console.log("Fetching image assets from Cloudinary...");
    const result = await cloudinary.api.resources({
      max_results: 500,
      resource_type: 'image'
    });

    const assets = result.resources;
    console.log(`Found ${assets.length} images in Cloudinary.`);

    const tablesToUpdate = [
      { name: 'characters', column: 'image' },
      { name: 'locations', column: 'image' },
      { name: 'character_design_elements', column: 'value' },
      { name: 'novels', column: 'cover_image' },
      { name: 'scenes', column: 'image' },
      { name: 'objects', column: 'image' }
    ];

    let totalUpdated = 0;

    for (const asset of assets) {
      const publicId = asset.public_id;
      const secureUrl = asset.secure_url;
      
      // Extract the filename (e.g. "1765653169514-5kabvy")
      const filename = publicId.split('/').pop();

      for (const table of tablesToUpdate) {
        try {
          const checkQuery = `SELECT id, ${table.column} FROM ${table.name} WHERE ${table.column} LIKE $1`;
          const checkRes = await client.query(checkQuery, [`%${filename}%`]);

          for (const row of checkRes.rows) {
            const currentValue = row[table.column];
            
            // Skip if already a full URL
            if (currentValue && currentValue.startsWith('http')) {
              continue;
            }

            const updateQuery = `UPDATE ${table.name} SET ${table.column} = $1 WHERE id = $2`;
            await client.query(updateQuery, [secureUrl, row.id]);
            console.log(`Updated ${table.name} (ID: ${row.id}): "${currentValue}" -> "${secureUrl}"`);
            totalUpdated++;
          }
        } catch (dbErr) {
          // Ignore if table/column does not exist in schema
        }
      }
    }

    console.log(`\nSync completed! Updated references in database: ${totalUpdated}`);
  } catch (error) {
    console.error("Sync error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

sync();
