import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const materialStatusEnum = pgEnum("material_status", [
  "uploaded",
  "processing",
  "ready",
  "error",
]);

/**
 * `Material` is a glossary term and stays German (see `CLAUDE.md`); the
 * table name `materialien` is therefore intentional. The `Material`
 * TypeScript type is also kept German.
 */
export const materialien = pgTable("materialien", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  status: materialStatusEnum("status").notNull().default("uploaded"),
  // Optional human-readable error reason set when status === 'error'.
  statusReason: text("status_reason"),
  // Heuristic content excerpt produced by the extractor (first chunks
  // joined and truncated). Surfaced in the UI as a quick preview for
  // formats the browser can't render natively (DOCX, PPTX, …).
  // Backfilled by the `tagMaterial` worker after extraction.
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const materialChunks = pgTable(
  "material_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materialien.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    pageNumber: integer("page_number"),
    section: text("section"),
    // Nullable: extraction (step 1) inserts chunks without embeddings;
    // the embedding step (step 2 of `tagMaterial`, not yet implemented)
    // backfills this column.
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("material_chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_l2_ops"),
    ),
  ],
);

export type Material = typeof materialien.$inferSelect;
export type NewMaterial = typeof materialien.$inferInsert;
export type MaterialChunk = typeof materialChunks.$inferSelect;
export type NewMaterialChunk = typeof materialChunks.$inferInsert;
