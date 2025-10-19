ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS account_category_code text;

ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS account_category_name text;

ALTER TABLE blue_book_entries
  ADD COLUMN IF NOT EXISTS start_date date;
