import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const lehrplanVersionen = pgTable("lehrplan_versionen", {
  id: uuid("id").defaultRandom().primaryKey(),
  schuljahr: varchar("schuljahr", { length: 32 }).notNull(),
  fach: text("fach").notNull(),
  schulstufe: varchar("schulstufe", { length: 64 }).notNull(),
  gueltigAb: timestamp("gueltig_ab", { withTimezone: true }).notNull(),
  gueltigBis: timestamp("gueltig_bis", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kompetenzbereiche = pgTable("kompetenzbereiche", {
  id: uuid("id").defaultRandom().primaryKey(),
  lehrplanVersionId: uuid("lehrplan_version_id")
    .notNull()
    .references(() => lehrplanVersionen.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  titel: text("titel").notNull(),
  beschreibung: text("beschreibung"),
  sortierung: integer("sortierung").notNull().default(0),
});

export const kompetenzen = pgTable("kompetenzen", {
  id: uuid("id").defaultRandom().primaryKey(),
  kompetenzbereichId: uuid("kompetenzbereich_id")
    .notNull()
    .references(() => kompetenzbereiche.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  titel: text("titel").notNull(),
  beschreibung: text("beschreibung"),
  sortierung: integer("sortierung").notNull().default(0),
});

export const deskriptoren = pgTable("deskriptoren", {
  id: uuid("id").defaultRandom().primaryKey(),
  kompetenzId: uuid("kompetenz_id")
    .notNull()
    .references(() => kompetenzen.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  text: text("text").notNull(),
  sortierung: integer("sortierung").notNull().default(0),
});
