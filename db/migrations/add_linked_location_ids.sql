-- Add linkedLocationIds column to ideas table
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS linked_location_ids jsonb;
