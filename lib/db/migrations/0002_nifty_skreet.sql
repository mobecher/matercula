CREATE TYPE "public"."kompetenz_perspektive" AS ENUM('T', 'G', 'I');--> statement-breakpoint
CREATE TABLE "anwendungsbereiche" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kompetenzbereich_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"uebergreifende_themen" text[] DEFAULT '{}' NOT NULL,
	"sortierung" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lehrplaene" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(128) NOT NULL,
	"titel" text NOT NULL,
	"fach" text NOT NULL,
	"schulstufe" varchar(64),
	"beschreibung" text,
	"schuljahr" varchar(32),
	"gueltig_ab" timestamp with time zone,
	"gueltig_bis" timestamp with time zone,
	"sortierung" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lehrplaene_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lehrplan_klassen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lehrplan_id" uuid NOT NULL,
	"klasse" integer NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"sortierung" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dokument_anwendungsbereich_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dokument_id" uuid NOT NULL,
	"anwendungsbereich_id" uuid NOT NULL,
	"notiz" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dokument_kompetenz_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dokument_id" uuid NOT NULL,
	"kompetenz_id" uuid NOT NULL,
	"notiz" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deskriptoren" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lehrplan_versionen" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "deskriptoren" CASCADE;--> statement-breakpoint
DROP TABLE "lehrplan_versionen" CASCADE;--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" DROP CONSTRAINT IF EXISTS "kompetenzbereiche_lehrplan_version_id_lehrplan_versionen_id_fk";
--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" ADD COLUMN "klasse_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "kompetenzen" ADD COLUMN "perspektive" "kompetenz_perspektive";--> statement-breakpoint
ALTER TABLE "kompetenzen" ADD COLUMN "uebergreifende_themen" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "anwendungsbereiche" ADD CONSTRAINT "anwendungsbereiche_kompetenzbereich_id_kompetenzbereiche_id_fk" FOREIGN KEY ("kompetenzbereich_id") REFERENCES "public"."kompetenzbereiche"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lehrplan_klassen" ADD CONSTRAINT "lehrplan_klassen_lehrplan_id_lehrplaene_id_fk" FOREIGN KEY ("lehrplan_id") REFERENCES "public"."lehrplaene"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_anwendungsbereich_links" ADD CONSTRAINT "dokument_anwendungsbereich_links_dokument_id_dokumente_id_fk" FOREIGN KEY ("dokument_id") REFERENCES "public"."dokumente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_anwendungsbereich_links" ADD CONSTRAINT "dokument_anwendungsbereich_links_anwendungsbereich_id_anwendungsbereiche_id_fk" FOREIGN KEY ("anwendungsbereich_id") REFERENCES "public"."anwendungsbereiche"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_kompetenz_links" ADD CONSTRAINT "dokument_kompetenz_links_dokument_id_dokumente_id_fk" FOREIGN KEY ("dokument_id") REFERENCES "public"."dokumente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_kompetenz_links" ADD CONSTRAINT "dokument_kompetenz_links_kompetenz_id_kompetenzen_id_fk" FOREIGN KEY ("kompetenz_id") REFERENCES "public"."kompetenzen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anwendungsbereiche_bereich_code_unique" ON "anwendungsbereiche" USING btree ("kompetenzbereich_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "lehrplan_klassen_unique" ON "lehrplan_klassen" USING btree ("lehrplan_id","klasse");--> statement-breakpoint
CREATE UNIQUE INDEX "dokument_anwendungsbereich_links_unique" ON "dokument_anwendungsbereich_links" USING btree ("dokument_id","anwendungsbereich_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dokument_kompetenz_links_unique" ON "dokument_kompetenz_links" USING btree ("dokument_id","kompetenz_id");--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" ADD CONSTRAINT "kompetenzbereiche_klasse_id_lehrplan_klassen_id_fk" FOREIGN KEY ("klasse_id") REFERENCES "public"."lehrplan_klassen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kompetenzbereiche_klasse_code_unique" ON "kompetenzbereiche" USING btree ("klasse_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "kompetenzen_bereich_code_unique" ON "kompetenzen" USING btree ("kompetenzbereich_id","code");--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" DROP COLUMN "lehrplan_version_id";
