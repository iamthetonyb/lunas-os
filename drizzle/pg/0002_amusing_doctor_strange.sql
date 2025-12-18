CREATE TABLE "community_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid,
	"job_number" text NOT NULL,
	"lot_number" text NOT NULL,
	"address" text,
	"model" text,
	"status" text DEFAULT 'active',
	"scraped_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_contact_method" text DEFAULT 'email';--> statement-breakpoint
ALTER TABLE "community_lots" ADD CONSTRAINT "community_lots_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;