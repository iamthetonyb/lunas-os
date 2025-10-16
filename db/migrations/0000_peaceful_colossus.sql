CREATE TYPE "public"."assignment_status" AS ENUM('DRAFT', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETE', 'NOT_DONE');--> statement-breakpoint
CREATE TYPE "public"."blue_book_status" AS ENUM('PENDING', 'COMPLETE');--> statement-breakpoint
CREATE TYPE "public"."dispatch_status" AS ENUM('DRAFT', 'SENT');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."preferred_lang" AS ENUM('EN', 'ES_MX');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'DISPATCHER', 'FOREMAN', 'CREW', 'OFFICE', 'CUSTOMER');--> statement-breakpoint
CREATE TYPE "public"."unit_kind" AS ENUM('PER_JOB', 'PER_SQFT', 'PER_UNIT');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'PAID', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."log_kind" AS ENUM('sms', 'email');--> statement-breakpoint
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
	"active" boolean DEFAULT true
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
	"role" "role" NOT NULL,
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
	"defaults" json
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
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;