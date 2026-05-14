CREATE TYPE "public"."dokument_typ" AS ENUM('ordner', 'seite');--> statement-breakpoint
CREATE TABLE "dokumente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"parent_id" uuid,
	"typ" "dokument_typ" NOT NULL,
	"titel" text NOT NULL,
	"icon" text,
	"inhalt_markdown" text,
	"sortierung" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_parent_id_dokumente_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."dokumente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dokumente_owner_idx" ON "dokumente" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "dokumente_owner_parent_idx" ON "dokumente" USING btree ("owner_id","parent_id");