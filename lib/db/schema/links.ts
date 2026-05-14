import {
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { dokumente } from "./dokumente";
import { anwendungsbereiche, kompetenzen } from "./lehrplan";
import { materialien } from "./materials";

/**
 * AI-tagging link between extracted material chunks and competencies.
 * Separate from user-driven `dokument_*_links`.
 */
export const materialKompetenzLinks = pgTable("material_kompetenz_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materialien.id, { onDelete: "cascade" }),
  kompetenzId: uuid("kompetenz_id")
    .notNull()
    .references(() => kompetenzen.id, { onDelete: "cascade" }),
  confidence: real("confidence").notNull(),
  rationale: text("rationale").notNull(),
  sourceChunkIds: jsonb("source_chunk_ids").$type<string[]>().notNull(),
  generatedBy: text("generated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Manuell von Lehrkräften gepflegter Link Dokument ↔ Kompetenz. */
export const dokumentKompetenzLinks = pgTable(
  "dokument_kompetenz_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dokumentId: uuid("dokument_id")
      .notNull()
      .references(() => dokumente.id, { onDelete: "cascade" }),
    kompetenzId: uuid("kompetenz_id")
      .notNull()
      .references(() => kompetenzen.id, { onDelete: "cascade" }),
    notiz: text("notiz"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("dokument_kompetenz_links_unique").on(
      t.dokumentId,
      t.kompetenzId,
    ),
  }),
);

/** Manuell von Lehrkräften gepflegter Link Dokument ↔ Anwendungsbereich. */
export const dokumentAnwendungsbereichLinks = pgTable(
  "dokument_anwendungsbereich_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dokumentId: uuid("dokument_id")
      .notNull()
      .references(() => dokumente.id, { onDelete: "cascade" }),
    anwendungsbereichId: uuid("anwendungsbereich_id")
      .notNull()
      .references(() => anwendungsbereiche.id, { onDelete: "cascade" }),
    notiz: text("notiz"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("dokument_anwendungsbereich_links_unique").on(
      t.dokumentId,
      t.anwendungsbereichId,
    ),
  }),
);
