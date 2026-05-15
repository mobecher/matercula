ALTER TABLE "material_chunks" ALTER COLUMN "embedding" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "materialien" ADD COLUMN "status_reason" text;