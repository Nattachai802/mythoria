-- Add linkedIdeaIds column to factions table
ALTER TABLE factions ADD COLUMN IF NOT EXISTS linked_idea_ids jsonb;
