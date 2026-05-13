CREATE TYPE "public"."material_status" AS ENUM('uploaded', 'processing', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."page_reference_target" AS ENUM('page', 'material', 'kompetenz');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "deskriptoren" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kompetenz_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"sortierung" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kompetenzbereiche" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lehrplan_version_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"sortierung" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kompetenzen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kompetenzbereich_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"sortierung" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lehrplan_versionen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schuljahr" varchar(32) NOT NULL,
	"fach" text NOT NULL,
	"schulstufe" varchar(64) NOT NULL,
	"gueltig_ab" timestamp with time zone NOT NULL,
	"gueltig_bis" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_kompetenz_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"kompetenz_id" uuid NOT NULL,
	"confidence" real NOT NULL,
	"rationale" text NOT NULL,
	"source_chunk_ids" jsonb NOT NULL,
	"generated_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"seitenzahl" integer,
	"abschnitt" text,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materialien" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"titel" text NOT NULL,
	"dateiname" text NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"status" "material_status" DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_page_id" uuid NOT NULL,
	"target_type" "page_reference_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"titel" text NOT NULL,
	"slug" text NOT NULL,
	"content_markdown" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deskriptoren" ADD CONSTRAINT "deskriptoren_kompetenz_id_kompetenzen_id_fk" FOREIGN KEY ("kompetenz_id") REFERENCES "public"."kompetenzen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kompetenzbereiche" ADD CONSTRAINT "kompetenzbereiche_lehrplan_version_id_lehrplan_versionen_id_fk" FOREIGN KEY ("lehrplan_version_id") REFERENCES "public"."lehrplan_versionen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kompetenzen" ADD CONSTRAINT "kompetenzen_kompetenzbereich_id_kompetenzbereiche_id_fk" FOREIGN KEY ("kompetenzbereich_id") REFERENCES "public"."kompetenzbereiche"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_kompetenz_links" ADD CONSTRAINT "material_kompetenz_links_material_id_materialien_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materialien"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_kompetenz_links" ADD CONSTRAINT "material_kompetenz_links_kompetenz_id_kompetenzen_id_fk" FOREIGN KEY ("kompetenz_id") REFERENCES "public"."kompetenzen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_materialien_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materialien"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materialien" ADD CONSTRAINT "materialien_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_references" ADD CONSTRAINT "page_references_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_chunks_embedding_hnsw_idx" ON "material_chunks" USING hnsw ("embedding" vector_l2_ops);