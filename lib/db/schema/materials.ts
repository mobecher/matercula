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

export const materialien = pgTable("materialien", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  dateiname: text("dateiname").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  status: materialStatusEnum("status").notNull().default("uploaded"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    seitenzahl: integer("seitenzahl"),
    abschnitt: text("abschnitt"),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("material_chunks_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_l2_ops")),
  ],
);

export type Material = typeof materialien.$inferSelect;
export type NeuesMaterial = typeof materialien.$inferInsert;
