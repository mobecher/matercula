-- Rename enum values from German to English. Uses ALTER TYPE ... RENAME
-- VALUE so existing rows are preserved (no data rewrite needed).
ALTER TABLE "document_link_suggestions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."link_suggestion_status" RENAME VALUE 'offen' TO 'open';--> statement-breakpoint
ALTER TYPE "public"."link_suggestion_status" RENAME VALUE 'akzeptiert' TO 'accepted';--> statement-breakpoint
ALTER TYPE "public"."link_suggestion_status" RENAME VALUE 'abgelehnt' TO 'rejected';--> statement-breakpoint
ALTER TABLE "document_link_suggestions" ALTER COLUMN "status" SET DEFAULT 'open'::"public"."link_suggestion_status";--> statement-breakpoint
ALTER TYPE "public"."document_type" RENAME VALUE 'ordner' TO 'folder';--> statement-breakpoint
ALTER TYPE "public"."document_type" RENAME VALUE 'seite' TO 'page';--> statement-breakpoint
ALTER TYPE "public"."document_type" RENAME VALUE 'pdf' TO 'file';
