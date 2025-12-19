DO $$ BEGIN
    CREATE TYPE "public"."assignment_status" AS ENUM('DRAFT', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETE', 'NOT_DONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."blue_book_status" AS ENUM('PENDING', 'COMPLETE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."dispatch_status" AS ENUM('DRAFT', 'SENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."ticket_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."preferred_lang" AS ENUM('EN', 'ES_MX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."role" AS ENUM('ADMIN', 'DISPATCHER', 'FOREMAN', 'CREW', 'OFFICE', 'CUSTOMER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."unit_kind" AS ENUM('PER_JOB', 'PER_SQFT', 'PER_UNIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'PAID', 'VOID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."log_kind" AS ENUM('sms', 'email');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."org_role" AS ENUM('admin', 'backoffice', 'contractor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_request_service_id" uuid,
	"crew_id" uuid,
	"dispatch_batch_id" uuid,
	"scheduled_start" timestamp,
	"scheduled_end" timestamp,
	"status" "assignment_status" DEFAULT 'DRAFT',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "blue_book_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_id" uuid,
	"community_id" uuid,
	"lot" text,
	"model_plan_id" uuid,
	"service_id" uuid,
	"po_number" text,
	"status" "blue_book_status" DEFAULT 'PENDING',
	"assignment_id" uuid,
	"ticket_id" uuid,
	"invoice_line_id" uuid,
	"amount" numeric,
	"check_number" text,
	"check_date" date,
	"check_total" numeric,
	"is_ach" boolean DEFAULT false,
	"account_category_code" text,
	"account_category_name" text,
	"start_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "builders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true,
	CONSTRAINT "builders_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_id" uuid,
	"name" text NOT NULL,
	"city" text,
	"state" text,
	"lat" text,
	"lng" text,
	"active" boolean DEFAULT true,
	CONSTRAINT "builder_id_name_unique" UNIQUE("builder_id","name")
);
--> statement-breakpoint
CREATE TABLE "contract_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_id" uuid,
	"service_id" uuid,
	"model_plan_id" uuid,
	"basis" text,
	"rate" numeric,
	"unit_label" text,
	"effective_on" date,
	"expires_on" date
);
--> statement-breakpoint
CREATE TABLE "crews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"foreman_id" uuid,
	"skills" text[],
	"capacity_per_day" integer
);
--> statement-breakpoint
CREATE TABLE "dispatch_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_date" date,
	"status" "dispatch_status" DEFAULT 'DRAFT',
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid,
	"submitted_by_id" uuid,
	"submitted_at" timestamp,
	"status" "ticket_status" DEFAULT 'DRAFT',
	"items" json,
	"notes" text,
	"customer_sig" text,
	"foreman_sig" text,
	"ticket_pdf_url" text,
	CONSTRAINT "field_tickets_assignment_id_unique" UNIQUE("assignment_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"name" text,
	"role" "role" DEFAULT 'CUSTOMER' NOT NULL,
	"preferred_lang" "preferred_lang" DEFAULT 'EN',
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "model_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_id" uuid,
	"code" text,
	"name" text NOT NULL,
	"sqft" text,
	"defaults" json,
	CONSTRAINT "builder_id_code_unique" UNIQUE("builder_id","code")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"unit_kind" "unit_kind",
	CONSTRAINT "services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "job_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_via" text,
	"requested_by" text,
	"contact_phone" text,
	"contact_email" text,
	"builder_id" uuid,
	"community_id" uuid,
	"lot" text,
	"address" text,
	"model_plan_id" uuid,
	"due_date" date,
	"notes" text,
	"po_number" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_request_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_request_id" uuid,
	"service_id" uuid,
	"requested_data" json,
	"walk_time" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_id" uuid,
	"po_number" text,
	"status" "invoice_status" DEFAULT 'DRAFT',
	"issued_on" date,
	"due_on" date,
	"subtotal" numeric,
	"tax" numeric,
	"total" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"blue_book_id" uuid,
	"description" text,
	"qty" numeric,
	"unit" text,
	"unit_price" numeric,
	"amount" numeric
);
--> statement-breakpoint
CREATE TABLE "sms_email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "log_kind",
	"to" text,
	"body" text,
	"meta" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'contractor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" date NOT NULL,
	"project_name" text,
	"builder" text,
	"community" text,
	"address" text,
	"lot" text,
	"unit_lot" text,
	"service_type" text,
	"category" text,
	"status" text,
	"time_in" time,
	"time_out" time,
	"hours" numeric(6, 2),
	"team" text[],
	"extras" text,
	"supervisor" text,
	"foreman" text,
	"crew_leader" text,
	"explain_work" text,
	"amount" numeric(12, 2),
	"source" text DEFAULT 'manual' NOT NULL,
	"photos" text[],
	"external_id" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_job_request_service_id_job_request_services_id_fk" FOREIGN KEY ("job_request_service_id") REFERENCES "public"."job_request_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_dispatch_batch_id_dispatch_batches_id_fk" FOREIGN KEY ("dispatch_batch_id") REFERENCES "public"."dispatch_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_model_plan_id_model_plans_id_fk" FOREIGN KEY ("model_plan_id") REFERENCES "public"."model_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_ticket_id_field_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."field_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blue_book_entries" ADD CONSTRAINT "blue_book_entries_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_rates" ADD CONSTRAINT "contract_rates_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_rates" ADD CONSTRAINT "contract_rates_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_rates" ADD CONSTRAINT "contract_rates_model_plan_id_model_plans_id_fk" FOREIGN KEY ("model_plan_id") REFERENCES "public"."model_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_foreman_id_users_id_fk" FOREIGN KEY ("foreman_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_batches" ADD CONSTRAINT "dispatch_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_tickets" ADD CONSTRAINT "field_tickets_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_tickets" ADD CONSTRAINT "field_tickets_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_plans" ADD CONSTRAINT "model_plans_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_model_plan_id_model_plans_id_fk" FOREIGN KEY ("model_plan_id") REFERENCES "public"."model_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_request_services" ADD CONSTRAINT "job_request_services_job_request_id_job_requests_id_fk" FOREIGN KEY ("job_request_id") REFERENCES "public"."job_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_request_services" ADD CONSTRAINT "job_request_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_logs" ADD CONSTRAINT "service_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_logs" ADD CONSTRAINT "service_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_key" ON "org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "service_logs_org_date_idx" ON "service_logs" USING btree ("org_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "service_logs_org_external_idx" ON "service_logs" USING btree ("org_id","external_id");