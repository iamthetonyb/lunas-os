ALTER TABLE "blue_book_entries" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'scraped';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expiry" timestamp;