-- Add linkedSystemIds column to factions table
ALTER TABLE factions ADD COLUMN IF NOT EXISTS linked_system_ids jsonb;
