import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Inline-Assets im Block-Editor (Bilder, Videos, Audio).
 *
 * Diese Tabelle ist bewusst getrennt von `materialien`:
 * - Materialien werden für die KI-Tagging-Pipeline indexiert (Chunks,
 *   Embeddings, Lehrplan-Verknüpfungen).
 * - Assets sind reine Anhang-Dateien innerhalb eines Dokuments und
 *   werden nicht extrahiert oder getaggt.
 *
 * Ein Asset gehört direkt einem Nutzer; die Verknüpfung zum Dokument
 * geschieht implizit über den im Dokumentinhalt gespeicherten Asset-URL.
 */
export const dokumentAssets = pgTable(
  "dokument_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateiname: text("dateiname").notNull(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("dokument_assets_owner_idx").on(table.ownerId),
  }),
);

export type DokumentAsset = typeof dokumentAssets.$inferSelect;
export type NeuesDokumentAsset = typeof dokumentAssets.$inferInsert;
