import { jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { kompetenzen } from "./lehrplan";
import { materialien } from "./materials";

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
