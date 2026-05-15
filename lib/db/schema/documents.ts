import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { materialien } from "./materials";

export const documentTypeEnum = pgEnum("document_type", ["folder", "page", "file"]);

/**
 * Hierarchical document tree in the Notion / Confluence style.
 *
 * - `parentId` is a self-reference and allows arbitrary nesting.
 * - `sortOrder` as `double precision` enables cheap reordering (the midpoint
 *   between two siblings can be inserted).
 * - Content is stored as Markdown directly in `contentMarkdown`. A future
 *   migration to block-based content can be done additively.
 * - For file documents (`type = "file"`), `materialId` references the
 *   uploaded material in `materialien`. Other types leave the field empty.
 * - Deleting a folder cascades to all children; moving is done by updating
 *   `parentId` + `sortOrder`.
 *
 * The `type` enum string values stay German for now and will be migrated in
 * a separate pass (see `TRANSLATION-TODO.md`).
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => documents.id, {
      onDelete: "cascade",
    }),
    type: documentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    icon: text("icon"),
    contentMarkdown: text("content_markdown"),
    materialId: uuid("material_id").references(() => materialien.id, {
      onDelete: "set null",
    }),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("documents_owner_idx").on(table.ownerId),
    ownerParentIdx: index("documents_owner_parent_idx").on(table.ownerId, table.parentId),
  }),
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  parent: one(documents, {
    fields: [documents.parentId],
    references: [documents.id],
    relationName: "documents_parent",
  }),
  children: many(documents, { relationName: "documents_parent" }),
  owner: one(users, {
    fields: [documents.ownerId],
    references: [users.id],
  }),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
