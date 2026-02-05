-- Migration: Retroactively update isUsed for ideas already on canvas
-- This updates existing ideas that have canvas positions to be marked as "used"

UPDATE ideas 
SET is_used = true 
WHERE canvas_x IS NOT NULL 
  AND canvas_y IS NOT NULL 
  AND is_used = false;
