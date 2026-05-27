const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');

// Load environment variables
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET
});

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set in environment variables.");
  process.exit(1);
}

if (!process.env.CLOUDINARY_API_SECRET) {
  console.error("Error: CLOUDINARY_API_SECRET is not set in environment variables. Please check your .env or .env.local file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to recursively find files in a directory
function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else {
      files.push(name);
    }
  }
  return files;
}

async function migrate() {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('No uploads directory found at public/uploads.');
    return;
  }

  const allFiles = getFiles(uploadsDir);
  console.log(`Found ${allFiles.length} files to migrate.`);

  const client = await pool.connect();
  let successCount = 0;

  try {
    for (const filePath of allFiles) {
      // Relative path for matching in database (e.g. /uploads/characters/1765567388238-nftzzn.png)
      const relativePath = filePath.replace(path.join(process.cwd(), 'public'), '').replace(/\\/g, '/');
      console.log(`\n--------------------------------------------`);
      console.log(`Processing local file: ${relativePath}`);

      // Folder structure mirroring (e.g. /uploads/characters -> characters)
      const folderName = path.dirname(relativePath).replace(/^\/uploads\/?/, '');
      
      console.log(`Uploading to Cloudinary folder: mythoria/${folderName}...`);
      
      try {
        const uploadResult = await cloudinary.uploader.upload(filePath, {
          folder: `mythoria/${folderName}`,
          use_filename: true,
          unique_filename: false,
          resource_type: "auto"
        });

        const cloudinaryUrl = uploadResult.secure_url;
        console.log(`Uploaded! Cloudinary URL: ${cloudinaryUrl}`);

        // Update tables
        const tablesToUpdate = [
          { name: 'characters', column: 'image' },
          { name: 'locations', column: 'image' },
          { name: 'character_design_elements', column: 'value' },
          { name: 'novels', column: 'cover_image' },
          { name: 'scenes', column: 'image' },
          { name: 'objects', column: 'image' }
        ];

        let totalUpdatedRows = 0;
        for (const table of tablesToUpdate) {
          try {
            const query = `UPDATE ${table.name} SET ${table.column} = $1 WHERE ${table.column} = $2`;
            const res = await client.query(query, [cloudinaryUrl, relativePath]);
            if (res.rowCount > 0) {
              console.log(`Updated ${res.rowCount} row(s) in table "${table.name}" (column "${table.column}")`);
              totalUpdatedRows += res.rowCount;
            }
          } catch (dbErr) {
            // Silently ignore if table doesn't exist or table has different schema in database
          }
        }
        
        successCount++;
        console.log(`Successfully migrated file and updated ${totalUpdatedRows} reference(s) in DB.`);
      } catch (uploadErr) {
        console.error(`Failed to upload/migrate ${relativePath}:`, uploadErr);
      }
    }
    
    console.log(`\n============================================`);
    console.log(`Migration summary: Successfully processed ${successCount}/${allFiles.length} files.`);
  } catch (error) {
    console.error('Error during migration process:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
