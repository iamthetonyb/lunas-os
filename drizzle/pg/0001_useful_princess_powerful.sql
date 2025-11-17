ALTER TABLE "blue_book_entries" ADD COLUMN "source" text DEFAULT 'scraped';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" timestamp;