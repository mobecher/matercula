import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const pageReferenceTargetEnum = pgEnum("page_reference_target", [
  "page",
  "material",
  "kompetenz",
]);

export const pages = pgTable("pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  slug: text("slug").notNull().unique(),
  contentMarkdown: text("content_markdown").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const pageReferences = pgTable("page_references", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourcePageId: uuid("source_page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  targetType: pageReferenceTargetEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
