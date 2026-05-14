import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { type AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { materialien } from "./materials";

export const dokumentTypEnum = pgEnum("dokument_typ", ["ordner", "seite", "pdf"]);

/**
 * Hierarchischer Dokumentbaum im Notion-/Confluence-Stil.
 *
 * - `parentId` als Self-Reference erlaubt beliebige Verschachtelung.
 * - `sortierung` als `double precision` ermöglicht günstiges Reordering
 *   (zwischen zwei Knoten kann der Mittelwert eingefügt werden).
 * - Inhalte werden als Markdown direkt in der Spalte `inhaltMarkdown` gehalten.
 *   Spätere Migration zu Block-basierten Inhalten ist additiv möglich.
 * - Für Datei-Dokumente (Typ `pdf`) verweist `materialId` auf das hochgeladene
 *   Material in `materialien`. Andere Typen lassen das Feld leer.
 * - Löschen eines Ordners kaskadiert auf alle Kinder; Verschieben
 *   geschieht über Update von `parentId` + `sortierung`.
 */
export const dokumente = pgTable(
  "dokumente",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => dokumente.id, {
      onDelete: "cascade",
    }),
    typ: dokumentTypEnum("typ").notNull(),
    titel: text("titel").notNull(),
    icon: text("icon"),
    inhaltMarkdown: text("inhalt_markdown"),
    materialId: uuid("material_id").references(() => materialien.id, {
      onDelete: "set null",
    }),
    sortierung: doublePrecision("sortierung").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("dokumente_owner_idx").on(table.ownerId),
    ownerParentIdx: index("dokumente_owner_parent_idx").on(table.ownerId, table.parentId),
  }),
);

export const dokumenteRelations = relations(dokumente, ({ one, many }) => ({
  parent: one(dokumente, {
    fields: [dokumente.parentId],
    references: [dokumente.id],
    relationName: "dokumente_parent",
  }),
  children: many(dokumente, { relationName: "dokumente_parent" }),
  owner: one(users, {
    fields: [dokumente.ownerId],
    references: [users.id],
  }),
}));

export type Dokument = typeof dokumente.$inferSelect;
export type NeuesDokument = typeof dokumente.$inferInsert;
