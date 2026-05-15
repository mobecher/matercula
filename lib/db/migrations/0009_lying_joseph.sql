ALTER TYPE "public"."dokument_typ" RENAME TO "document_type";--> statement-breakpoint
ALTER TYPE "public"."link_vorschlag_status" RENAME TO "link_suggestion_status";--> statement-breakpoint
ALTER TYPE "public"."link_vorschlag_ziel_typ" RENAME TO "link_suggestion_target_type";--> statement-breakpoint
ALTER TABLE "dokument_assets" RENAME TO "document_assets";--> statement-breakpoint
ALTER TABLE "dokumente" RENAME TO "documents";--> statement-breakpoint
ALTER TABLE "dokument_anwendungsbereich_links" RENAME TO "document_anwendungsbereich_links";--> statement-breakpoint
ALTER TABLE "dokument_kompetenz_links" RENAME TO "document_kompetenz_links";--> statement-breakpoint
ALTER TABLE "dokument_link_vorschlaege" RENAME TO "document_link_suggestions";--> statement-breakpoint
ALTER TABLE "document_assets" RENAME COLUMN "dateiname" TO "file_name";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "typ" TO "type";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "inhalt_markdown" TO "content_markdown";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "sortierung" TO "sort_order";--> statement-breakpoint
ALTER TABLE "anwendungsbereiche" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "anwendungsbereiche" RENAME COLUMN "beschreibung" TO "description";--> statement-breakpoint
ALTER TABLE "anwendungsbereiche" RENAME COLUMN "uebergreifende_themen" TO "cross_cutting_topics";--> statement-breakpoint
ALTER TABLE "anwendungsbereiche" RENAME COLUMN "sortierung" TO "sort_order";--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" RENAME COLUMN "beschreibung" TO "description";--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" RENAME COLUMN "sortierung" TO "sort_order";--> statement-breakpoint
ALTER TABLE "kompetenzen" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "kompetenzen" RENAME COLUMN "beschreibung" TO "description";--> statement-breakpoint
ALTER TABLE "kompetenzen" RENAME COLUMN "uebergreifende_themen" TO "cross_cutting_topics";--> statement-breakpoint
ALTER TABLE "kompetenzen" RENAME COLUMN "sortierung" TO "sort_order";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "fach" TO "subject";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "beschreibung" TO "description";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "schuljahr" TO "school_year";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "gueltig_ab" TO "valid_from";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "gueltig_bis" TO "valid_until";--> statement-breakpoint
ALTER TABLE "lehrplaene" RENAME COLUMN "sortierung" TO "sort_order";--> statement-breakpoint
ALTER TABLE "lehrplan_klassen" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "lehrplan_klassen" RENAME COLUMN "beschreibung" TO "description";--> statement-breakpoint
ALTER TABLE "lehrplan_klassen" RENAME COLUMN "sortierung" TO "sort_order";--> statement-breakpoint
ALTER TABLE "document_anwendungsbereich_links" RENAME COLUMN "dokument_id" TO "document_id";--> statement-breakpoint
ALTER TABLE "document_anwendungsbereich_links" RENAME COLUMN "notiz" TO "note";--> statement-breakpoint
ALTER TABLE "document_kompetenz_links" RENAME COLUMN "dokument_id" TO "document_id";--> statement-breakpoint
ALTER TABLE "document_kompetenz_links" RENAME COLUMN "notiz" TO "note";--> statement-breakpoint
ALTER TABLE "document_link_suggestions" RENAME COLUMN "dokument_id" TO "document_id";--> statement-breakpoint
ALTER TABLE "document_link_suggestions" RENAME COLUMN "ziel_typ" TO "target_type";--> statement-breakpoint
ALTER TABLE "document_link_suggestions" RENAME COLUMN "begruendung" TO "rationale";--> statement-breakpoint
ALTER TABLE "document_link_suggestions" RENAME COLUMN "modell" TO "model";--> statement-breakpoint
ALTER TABLE "material_chunks" RENAME COLUMN "seitenzahl" TO "page_number";--> statement-breakpoint
ALTER TABLE "material_chunks" RENAME COLUMN "abschnitt" TO "section";--> statement-breakpoint
ALTER TABLE "materialien" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "materialien" RENAME COLUMN "dateiname" TO "file_name";--> statement-breakpoint
ALTER TABLE "materialien" RENAME COLUMN "zusammenfassung" TO "summary";--> statement-breakpoint
ALTER TABLE "pages" RENAME COLUMN "titel" TO "title";--> statement-breakpoint
ALTER TABLE "document_assets" DROP CONSTRAINT "dokument_assets_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "dokumente_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "dokumente_parent_id_dokumente_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "dokumente_material_id_materialien_id_fk";
--> statement-breakpoint
ALTER TABLE "document_anwendungsbereich_links" DROP CONSTRAINT "dokument_anwendungsbereich_links_dokument_id_dokumente_id_fk";
--> statement-breakpoint
ALTER TABLE "document_anwendungsbereich_links" DROP CONSTRAINT "dokument_anwendungsbereich_links_anwendungsbereich_id_anwendungsbereiche_id_fk";
--> statement-breakpoint
ALTER TABLE "document_kompetenz_links" DROP CONSTRAINT "dokument_kompetenz_links_dokument_id_dokumente_id_fk";
--> statement-breakpoint
ALTER TABLE "document_kompetenz_links" DROP CONSTRAINT "dokument_kompetenz_links_kompetenz_id_kompetenzen_id_fk";
--> statement-breakpoint
ALTER TABLE "document_link_suggestions" DROP CONSTRAINT "dokument_link_vorschlaege_dokument_id_dokumente_id_fk";
--> statement-breakpoint
ALTER TABLE "document_link_suggestions" DROP CONSTRAINT "dokument_link_vorschlaege_kompetenz_id_kompetenzen_id_fk";
--> statement-breakpoint
ALTER TABLE "document_link_suggestions" DROP CONSTRAINT "dokument_link_vorschlaege_anwendungsbereich_id_anwendungsbereiche_id_fk";
--> statement-breakpoint
DROP INDEX "dokument_assets_owner_idx";--> statement-breakpoint
DROP INDEX "dokumente_owner_idx";--> statement-breakpoint
DROP INDEX "dokumente_owner_parent_idx";--> statement-breakpoint
DROP INDEX "dokument_anwendungsbereich_links_unique";--> statement-breakpoint
DROP INDEX "dokument_kompetenz_links_unique";--> statement-breakpoint
DROP INDEX "dokument_link_vorschlaege_dokument_idx";--> statement-breakpoint
DROP INDEX "dokument_link_vorschlaege_kompetenz_unique";--> statement-breakpoint
DROP INDEX "dokument_link_vorschlaege_anwendungsbereich_unique";--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_material_id_materialien_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materialien"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_anwendungsbereich_links" ADD CONSTRAINT "document_anwendungsbereich_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_anwendungsbereich_links" ADD CONSTRAINT "document_anwendungsbereich_links_anwendungsbereich_id_anwendungsbereiche_id_fk" FOREIGN KEY ("anwendungsbereich_id") REFERENCES "public"."anwendungsbereiche"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_kompetenz_links" ADD CONSTRAINT "document_kompetenz_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_kompetenz_links" ADD CONSTRAINT "document_kompetenz_links_kompetenz_id_kompetenzen_id_fk" FOREIGN KEY ("kompetenz_id") REFERENCES "public"."kompetenzen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_link_suggestions" ADD CONSTRAINT "document_link_suggestions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_link_suggestions" ADD CONSTRAINT "document_link_suggestions_kompetenz_id_kompetenzen_id_fk" FOREIGN KEY ("kompetenz_id") REFERENCES "public"."kompetenzen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_link_suggestions" ADD CONSTRAINT "document_link_suggestions_anwendungsbereich_id_anwendungsbereiche_id_fk" FOREIGN KEY ("anwendungsbereich_id") REFERENCES "public"."anwendungsbereiche"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_assets_owner_idx" ON "document_assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "documents_owner_parent_idx" ON "documents" USING btree ("owner_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_anwendungsbereich_links_unique" ON "document_anwendungsbereich_links" USING btree ("document_id","anwendungsbereich_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_kompetenz_links_unique" ON "document_kompetenz_links" USING btree ("document_id","kompetenz_id");--> statement-breakpoint
CREATE INDEX "document_link_suggestions_document_idx" ON "document_link_suggestions" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_link_suggestions_kompetenz_unique" ON "document_link_suggestions" USING btree ("document_id","kompetenz_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_link_suggestions_anwendungsbereich_unique" ON "document_link_suggestions" USING btree ("document_id","anwendungsbereich_id");