CREATE TYPE "public"."link_vorschlag_status" AS ENUM('offen', 'akzeptiert', 'abgelehnt');--> statement-breakpoint
CREATE TYPE "public"."link_vorschlag_ziel_typ" AS ENUM('kompetenz', 'anwendungsbereich');--> statement-breakpoint
CREATE TABLE "dokument_link_vorschlaege" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dokument_id" uuid NOT NULL,
	"ziel_typ" "link_vorschlag_ziel_typ" NOT NULL,
	"kompetenz_id" uuid,
	"anwendungsbereich_id" uuid,
	"confidence" real NOT NULL,
	"begruendung" text NOT NULL,
	"modell" text NOT NULL,
	"status" "link_vorschlag_status" DEFAULT 'offen' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dokument_link_vorschlaege" ADD CONSTRAINT "dokument_link_vorschlaege_dokument_id_dokumente_id_fk" FOREIGN KEY ("dokument_id") REFERENCES "public"."dokumente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_link_vorschlaege" ADD CONSTRAINT "dokument_link_vorschlaege_kompetenz_id_kompetenzen_id_fk" FOREIGN KEY ("kompetenz_id") REFERENCES "public"."kompetenzen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_link_vorschlaege" ADD CONSTRAINT "dokument_link_vorschlaege_anwendungsbereich_id_anwendungsbereiche_id_fk" FOREIGN KEY ("anwendungsbereich_id") REFERENCES "public"."anwendungsbereiche"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dokument_link_vorschlaege_dokument_idx" ON "dokument_link_vorschlaege" USING btree ("dokument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dokument_link_vorschlaege_kompetenz_unique" ON "dokument_link_vorschlaege" USING btree ("dokument_id","kompetenz_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dokument_link_vorschlaege_anwendungsbereich_unique" ON "dokument_link_vorschlaege" USING btree ("dokument_id","anwendungsbereich_id");