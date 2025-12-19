ALTER TABLE "assignments" ADD COLUMN "blue_book_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD COLUMN "original_start_date" date;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD COLUMN "assigned_foreman_name" text;--> statement-breakpoint
ALTER TABLE "dispatch_batches" ADD COLUMN "crew_name" text;--> statement-breakpoint
ALTER TABLE "dispatch_batches" ADD COLUMN "foreman_name" text;--> statement-breakpoint
ALTER TABLE "job_requests" ADD COLUMN "original_due_date" date;--> statement-breakpoint
ALTER TABLE "job_request_services" ADD COLUMN "assigned_foreman_name" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_blue_book_entry_id_blue_book_entries_id_fk" FOREIGN KEY ("blue_book_entry_id") REFERENCES "public"."blue_book_entries"("id") ON DELETE no action ON UPDATE no action;