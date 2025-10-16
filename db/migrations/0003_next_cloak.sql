ALTER TABLE "communities" DROP CONSTRAINT "communities_name_unique";--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "builder_id_name_unique" UNIQUE("builder_id","name");