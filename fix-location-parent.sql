-- Fix empty string parentLocationId to NULL before adding foreign key constraint
UPDATE locations SET parent_location_id = NULL WHERE parent_location_id = '';

-- Now add the foreign key constraint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" 
FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
