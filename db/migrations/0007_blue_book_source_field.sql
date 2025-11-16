-- Add source field to track origin of blue book entries
ALTER TABLE blue_book_entries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'scraped' CHECK (source IN ('scraped', 'manual'));

-- Update existing entries to have scraped source
UPDATE blue_book_entries SET source = 'scraped' WHERE source IS NULL;
