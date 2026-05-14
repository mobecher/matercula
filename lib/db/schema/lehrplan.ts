import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Curriculum domain ("Lehrplan").
 *
 * Hierarchy:
 *   lehrplaene (Fach, z. B. "Digitale Grundbildung")
 *     └─ lehrplan_klassen (Schulstufe, z. B. 1.-4. Klasse)
 *          └─ kompetenzbereiche (z. B. "Orientierung")
 *                 ├─ kompetenzen (mit Tag T/G/I + übergreifenden Themen)
 *                 └─ anwendungsbereiche (mit übergreifenden Themen)
 *
 * Daten werden vom App-Anbieter rigide gepflegt (Read-only für Lehrkräfte).
 */

export const kompetenzPerspektiveEnum = pgEnum("kompetenz_perspektive", [
  "T",
  "G",
  "I",
]);

export const lehrplaene = pgTable("lehrplaene", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Stabiler, menschenlesbarer Schlüssel (z. B. "digitale-grundbildung"). */
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  titel: text("titel").notNull(),
  fach: text("fach").notNull(),
  schulstufe: varchar("schulstufe", { length: 64 }),
  beschreibung: text("beschreibung"),
  schuljahr: varchar("schuljahr", { length: 32 }),
  gueltigAb: timestamp("gueltig_ab", { withTimezone: true }),
  gueltigBis: timestamp("gueltig_bis", { withTimezone: true }),
  sortierung: integer("sortierung").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const lehrplanKlassen = pgTable(
  "lehrplan_klassen",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lehrplanId: uuid("lehrplan_id")
      .notNull()
      .references(() => lehrplaene.id, { onDelete: "cascade" }),
    klasse: integer("klasse").notNull(),
    titel: text("titel").notNull(),
    beschreibung: text("beschreibung"),
    sortierung: integer("sortierung").notNull().default(0),
  },
  (t) => ({
    uniqLehrplanKlasse: uniqueIndex("lehrplan_klassen_unique").on(
      t.lehrplanId,
      t.klasse,
    ),
  }),
);

export const kompetenzbereiche = pgTable(
  "kompetenzbereiche",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    klasseId: uuid("klasse_id")
      .notNull()
      .references(() => lehrplanKlassen.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    titel: text("titel").notNull(),
    beschreibung: text("beschreibung"),
    sortierung: integer("sortierung").notNull().default(0),
  },
  (t) => ({
    uniqKlasseCode: uniqueIndex("kompetenzbereiche_klasse_code_unique").on(
      t.klasseId,
      t.code,
    ),
  }),
);

export const kompetenzen = pgTable(
  "kompetenzen",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kompetenzbereichId: uuid("kompetenzbereich_id")
      .notNull()
      .references(() => kompetenzbereiche.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    titel: text("titel").notNull(),
    beschreibung: text("beschreibung"),
    perspektive: kompetenzPerspektiveEnum("perspektive"),
    /** "Übergreifende Themen" wie Bildung, Berufsorientierung, Entrepreneurship, … */
    uebergreifendeThemen: text("uebergreifende_themen")
      .array()
      .notNull()
      .default([]),
    sortierung: integer("sortierung").notNull().default(0),
  },
  (t) => ({
    uniqBereichCode: uniqueIndex("kompetenzen_bereich_code_unique").on(
      t.kompetenzbereichId,
      t.code,
    ),
  }),
);

export const anwendungsbereiche = pgTable(
  "anwendungsbereiche",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kompetenzbereichId: uuid("kompetenzbereich_id")
      .notNull()
      .references(() => kompetenzbereiche.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    titel: text("titel").notNull(),
    beschreibung: text("beschreibung"),
    uebergreifendeThemen: text("uebergreifende_themen")
      .array()
      .notNull()
      .default([]),
    sortierung: integer("sortierung").notNull().default(0),
  },
  (t) => ({
    uniqBereichCode: uniqueIndex("anwendungsbereiche_bereich_code_unique").on(
      t.kompetenzbereichId,
      t.code,
    ),
  }),
);

// Relations -----------------------------------------------------------------

export const lehrplaeneRelations = relations(lehrplaene, ({ many }) => ({
  klassen: many(lehrplanKlassen),
}));

export const lehrplanKlassenRelations = relations(
  lehrplanKlassen,
  ({ one, many }) => ({
    lehrplan: one(lehrplaene, {
      fields: [lehrplanKlassen.lehrplanId],
      references: [lehrplaene.id],
    }),
    kompetenzbereiche: many(kompetenzbereiche),
  }),
);

export const kompetenzbereicheRelations = relations(
  kompetenzbereiche,
  ({ one, many }) => ({
    klasse: one(lehrplanKlassen, {
      fields: [kompetenzbereiche.klasseId],
      references: [lehrplanKlassen.id],
    }),
    kompetenzen: many(kompetenzen),
    anwendungsbereiche: many(anwendungsbereiche),
  }),
);

export const kompetenzenRelations = relations(kompetenzen, ({ one }) => ({
  kompetenzbereich: one(kompetenzbereiche, {
    fields: [kompetenzen.kompetenzbereichId],
    references: [kompetenzbereiche.id],
  }),
}));

export const anwendungsbereicheRelations = relations(
  anwendungsbereiche,
  ({ one }) => ({
    kompetenzbereich: one(kompetenzbereiche, {
      fields: [anwendungsbereiche.kompetenzbereichId],
      references: [kompetenzbereiche.id],
    }),
  }),
);

// Types ---------------------------------------------------------------------

export type Lehrplan = typeof lehrplaene.$inferSelect;
export type LehrplanKlasse = typeof lehrplanKlassen.$inferSelect;
export type Kompetenzbereich = typeof kompetenzbereiche.$inferSelect;
export type Kompetenz = typeof kompetenzen.$inferSelect;
export type Anwendungsbereich = typeof anwendungsbereiche.$inferSelect;
export type KompetenzPerspektive =
  (typeof kompetenzPerspektiveEnum.enumValues)[number];
