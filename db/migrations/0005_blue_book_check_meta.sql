ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS check_number text;

ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS check_date date;

ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS check_total numeric;

ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS is_ach boolean DEFAULT false;
