ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "blue_book_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD COLUMN IF NOT EXISTS "original_start_date" date;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD COLUMN IF NOT EXISTS "assigned_foreman_name" text;--> statement-breakpoint
ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "crew_name" text;--> statement-breakpoint
ALTER TABLE "dispatch_batches" ADD COLUMN IF NOT EXISTS "foreman_name" text;--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN IF NOT EXISTS "original_due_date" date;--> statement-breakpoint
ALTER TABLE "job_request_services" ADD COLUMN IF NOT EXISTS "assigned_foreman_name" text;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "assignments" ADD CONSTRAINT "assignments_blue_book_entry_id_blue_book_entries_id_fk" FOREIGN KEY ("blue_book_entry_id") REFERENCES "public"."blue_book_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;