-- Run this in Supabase SQL Editor
-- Allows 'dental' as a valid section in the media table

ALTER TABLE media DROP CONSTRAINT IF EXISTS media_section_check;
ALTER TABLE media ADD CONSTRAINT media_section_check
  CHECK (section IN ('gallery', 'hero', 'dental'));
