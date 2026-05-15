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
 *   lehrplaene (subject, e.g. "Digitale Grundbildung")
 *     └─ lehrplan_klassen (Schulstufe, e.g. grades 1-4)
 *          └─ kompetenzbereiche (e.g. "Orientierung")
 *                 ├─ kompetenzen (with Tag T/G/I and cross-cutting topics)
 *                 └─ anwendungsbereiche (with cross-cutting topics)
 *
 * Data is curated rigidly by the app provider (read-only for teachers).
 *
 * Note: `Lehrplan`, `Kompetenzbereich`, `Kompetenz`, `Anwendungsbereich`,
 * `Schulstufe` are domain glossary terms and stay German in code, DB and
 * API payloads (see `CLAUDE.md`).
 */

export const kompetenzPerspektiveEnum = pgEnum("kompetenz_perspektive", ["T", "G", "I"]);

export const lehrplaene = pgTable("lehrplaene", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Stable, human-readable key (e.g. "digitale-grundbildung"). */
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  schulstufe: varchar("schulstufe", { length: 64 }),
  description: text("description"),
  schoolYear: varchar("school_year", { length: 32 }),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
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
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
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
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
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
    title: text("title").notNull(),
    description: text("description"),
    perspektive: kompetenzPerspektiveEnum("perspektive"),
    /** "Übergreifende Themen" such as Bildung, Berufsorientierung, Entrepreneurship, … */
    crossCuttingTopics: text("cross_cutting_topics")
      .array()
      .notNull()
      .default([]),
    sortOrder: integer("sort_order").notNull().default(0),
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
    title: text("title").notNull(),
    description: text("description"),
    crossCuttingTopics: text("cross_cutting_topics")
      .array()
      .notNull()
      .default([]),
    sortOrder: integer("sort_order").notNull().default(0),
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

export const lehrplanKlassenRelations = relations(lehrplanKlassen, ({ one, many }) => ({
  lehrplan: one(lehrplaene, {
    fields: [lehrplanKlassen.lehrplanId],
    references: [lehrplaene.id],
  }),
  kompetenzbereiche: many(kompetenzbereiche),
}));

export const kompetenzbereicheRelations = relations(kompetenzbereiche, ({ one, many }) => ({
  klasse: one(lehrplanKlassen, {
    fields: [kompetenzbereiche.klasseId],
    references: [lehrplanKlassen.id],
  }),
  kompetenzen: many(kompetenzen),
  anwendungsbereiche: many(anwendungsbereiche),
}));

export const kompetenzenRelations = relations(kompetenzen, ({ one }) => ({
  kompetenzbereich: one(kompetenzbereiche, {
    fields: [kompetenzen.kompetenzbereichId],
    references: [kompetenzbereiche.id],
  }),
}));

export const anwendungsbereicheRelations = relations(anwendungsbereiche, ({ one }) => ({
  kompetenzbereich: one(kompetenzbereiche, {
    fields: [anwendungsbereiche.kompetenzbereichId],
    references: [kompetenzbereiche.id],
  }),
}));

// Types ---------------------------------------------------------------------

export type Lehrplan = typeof lehrplaene.$inferSelect;
export type LehrplanKlasse = typeof lehrplanKlassen.$inferSelect;
export type Kompetenzbereich = typeof kompetenzbereiche.$inferSelect;
export type Kompetenz = typeof kompetenzen.$inferSelect;
export type Anwendungsbereich = typeof anwendungsbereiche.$inferSelect;
export type KompetenzPerspektive = (typeof kompetenzPerspektiveEnum.enumValues)[number];
