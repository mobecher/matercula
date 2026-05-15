import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Inline assets in the block editor (images, videos, audio).
 *
 * This table is intentionally separate from `materialien`:
 * - Materials are indexed for the AI tagging pipeline (chunks, embeddings,
 *   curriculum links).
 * - Assets are pure attachment files inside a document and are neither
 *   extracted nor tagged.
 *
 * An asset belongs directly to a user; the link to a document is implicit
 * via the asset URL stored in the document content.
 */
export const documentAssets = pgTable(
  "document_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    ownerIdx: index("document_assets_owner_idx").on(table.ownerId),
  }),
);

export type DocumentAsset = typeof documentAssets.$inferSelect;
export type NewDocumentAsset = typeof documentAssets.$inferInsert;
