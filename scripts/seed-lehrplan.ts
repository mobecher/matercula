import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/lib/db";
import {
  anwendungsbereiche,
  kompetenzbereiche,
  kompetenzen,
  lehrplaene,
  lehrplanKlassen,
  type KompetenzPerspektive,
} from "@/lib/db/schema/lehrplan";

interface RawCompetency {
  perspective?: string;
  description: string;
}

interface RawArea {
  title: string;
  description?: string;
  competencies: RawCompetency[];
  applications: string[];
}

interface RawYear {
  title: string;
  competence_areas: RawArea[];
}

interface RawLehrplan {
  title: string;
  years: Record<string, RawYear>;
}

const PERSPEKTIVEN: KompetenzPerspektive[] = ["T", "G", "I"];

function parsePerspektive(
  value: string | undefined,
): KompetenzPerspektive | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (PERSPEKTIVEN as string[]).includes(upper)
    ? (upper as KompetenzPerspektive)
    : null;
}

function shortTitle(text: string, maxLen = 80): string {
  const trimmed = text.trim();
  const cutoff = trimmed.match(/^(.{10,80}?)(?:[.,;:]|$)/);
  const candidate = cutoff ? cutoff[1] : trimmed;
  if (candidate.length <= maxLen) return candidate;
  return `${candidate.slice(0, maxLen - 1).trim()}…`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function upsertLehrplan(slug: string, titel: string) {
  const existing = await db
    .select()
    .from(lehrplaene)
    .where(eq(lehrplaene.slug, slug))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(lehrplaene)
    .values({ slug, titel, fach: titel, schulstufe: "Sekundarstufe I" })
    .returning();
  return created;
}

async function upsertKlasse(
  lehrplanId: string,
  klasseNr: number,
  titel: string,
) {
  const existing = (
    await db
      .select()
      .from(lehrplanKlassen)
      .where(eq(lehrplanKlassen.lehrplanId, lehrplanId))
  ).find((k) => k.klasse === klasseNr);
  if (existing) return existing;
  const [created] = await db
    .insert(lehrplanKlassen)
    .values({ lehrplanId, klasse: klasseNr, titel, sortierung: klasseNr })
    .returning();
  return created;
}

async function upsertBereich(
  klasseId: string,
  code: string,
  titel: string,
  beschreibung: string | null,
  sortierung: number,
) {
  const existing = (
    await db
      .select()
      .from(kompetenzbereiche)
      .where(eq(kompetenzbereiche.klasseId, klasseId))
  ).find((b) => b.code === code);
  if (existing) return existing;
  const [created] = await db
    .insert(kompetenzbereiche)
    .values({ klasseId, code, titel, beschreibung, sortierung })
    .returning();
  return created;
}

async function seedLehrplan(slug: string, raw: RawLehrplan) {
  const lp = await upsertLehrplan(slug, raw.title);

  for (const [yearKey, year] of Object.entries(raw.years)) {
    const klasseNr = Number.parseInt(yearKey, 10);
    if (!Number.isFinite(klasseNr)) continue;

    const klasse = await upsertKlasse(lp.id, klasseNr, year.title);

    let bereichSort = 0;
    for (const area of year.competence_areas) {
      bereichSort += 1;
      const bereichCode = slugify(area.title);
      const bereich = await upsertBereich(
        klasse.id,
        bereichCode,
        area.title,
        area.description ?? null,
        bereichSort,
      );

      const existingKomp = await db
        .select()
        .from(kompetenzen)
        .where(eq(kompetenzen.kompetenzbereichId, bereich.id));
      const kompCodes = new Set(existingKomp.map((k) => k.code));

      let kompSort = 0;
      for (const c of area.competencies) {
        kompSort += 1;
        const code = `${bereichCode}-k${kompSort}`;
        if (kompCodes.has(code)) continue;
        const beschr = c.description.trim();
        await db.insert(kompetenzen).values({
          kompetenzbereichId: bereich.id,
          code,
          titel: shortTitle(beschr),
          beschreibung: beschr,
          perspektive: parsePerspektive(c.perspective),
          uebergreifendeThemen: [],
          sortierung: kompSort,
        });
      }

      const existingApp = await db
        .select()
        .from(anwendungsbereiche)
        .where(eq(anwendungsbereiche.kompetenzbereichId, bereich.id));
      const appCodes = new Set(existingApp.map((a) => a.code));

      let appSort = 0;
      for (const app of area.applications) {
        appSort += 1;
        const code = `${bereichCode}-a${appSort}`;
        if (appCodes.has(code)) continue;
        const beschr = app.trim();
        await db.insert(anwendungsbereiche).values({
          kompetenzbereichId: bereich.id,
          code,
          titel: shortTitle(beschr),
          beschreibung: beschr,
          uebergreifendeThemen: [],
          sortierung: appSort,
        });
      }
    }
    console.log(
      `  ${year.title}: ${year.competence_areas.length} Kompetenzbereiche verarbeitet`,
    );
  }

  console.log(`✓ Lehrplan „${raw.title}“ gespeichert (slug=${slug}).`);
}

async function main() {
  const folder = path.join(process.cwd(), "data", "lehrplan");
  const files = (await fs.readdir(folder)).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} Lehrplan JSON file(s).`);

  for (const file of files) {
    const baseSlug = slugify(file.replace(/\.json$/, ""));
    const raw = JSON.parse(
      await fs.readFile(path.join(folder, file), "utf8"),
    ) as Record<string, RawLehrplan>;
    const entries = Object.entries(raw);
    for (const [key, value] of entries) {
      const entrySlug =
        entries.length === 1 ? baseSlug : `${baseSlug}-${slugify(key)}`;
      await seedLehrplan(entrySlug, value);
    }
  }

  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
