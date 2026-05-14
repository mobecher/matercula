ALTER TYPE "public"."dokument_typ" ADD VALUE 'pdf';--> statement-breakpoint
ALTER TABLE "dokumente" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_material_id_materialien_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materialien"("id") ON DELETE set null ON UPDATE no action;