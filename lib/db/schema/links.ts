import {
  index,
  jsonb,
  pgEnum,
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

/**
 * AI-generierte Vorschläge für Verknüpfungen Dokument ↔ Lehrplanelement.
 *
 * - `zielTyp` schaltet zwischen Kompetenz und Anwendungsbereich um; das
 *   jeweils passende Fremdschlüssel-Feld ist befüllt, das andere `null`.
 * - `status` hält den Review-Zustand des Vorschlags (offen / akzeptiert /
 *   abgelehnt). Akzeptierte Vorschläge erzeugen separat einen Eintrag in
 *   `dokument_*_links`; der Vorschlag selbst bleibt für Audit-Zwecke erhalten.
 * - `confidence` ist der Modell-Score (0..1).
 * - `begruendung` ist der vom LLM generierte deutsche Begründungstext.
 * - `modell` ist der ID-String des verwendeten LLMs (für Reproduzierbarkeit).
 */
export const linkVorschlagStatusEnum = pgEnum("link_vorschlag_status", [
  "offen",
  "akzeptiert",
  "abgelehnt",
]);

export const linkVorschlagZielTypEnum = pgEnum("link_vorschlag_ziel_typ", [
  "kompetenz",
  "anwendungsbereich",
]);

export const dokumentLinkVorschlaege = pgTable(
  "dokument_link_vorschlaege",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dokumentId: uuid("dokument_id")
      .notNull()
      .references(() => dokumente.id, { onDelete: "cascade" }),
    zielTyp: linkVorschlagZielTypEnum("ziel_typ").notNull(),
    kompetenzId: uuid("kompetenz_id").references(() => kompetenzen.id, {
      onDelete: "cascade",
    }),
    anwendungsbereichId: uuid("anwendungsbereich_id").references(() => anwendungsbereiche.id, {
      onDelete: "cascade",
    }),
    confidence: real("confidence").notNull(),
    begruendung: text("begruendung").notNull(),
    modell: text("modell").notNull(),
    status: linkVorschlagStatusEnum("status").notNull().default("offen"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => ({
    docIdx: index("dokument_link_vorschlaege_dokument_idx").on(t.dokumentId),
    uniqKomp: uniqueIndex("dokument_link_vorschlaege_kompetenz_unique").on(
      t.dokumentId,
      t.kompetenzId,
    ),
    uniqAwb: uniqueIndex("dokument_link_vorschlaege_anwendungsbereich_unique").on(
      t.dokumentId,
      t.anwendungsbereichId,
    ),
  }),
);

export type DokumentLinkVorschlag = typeof dokumentLinkVorschlaege.$inferSelect;
export type NeuerDokumentLinkVorschlag = typeof dokumentLinkVorschlaege.$inferInsert;
