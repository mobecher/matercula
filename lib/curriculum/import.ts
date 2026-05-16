import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  anwendungsbereiche,
  type KompetenzPerspektive,
  kompetenzbereiche,
  kompetenzen,
  lehrplaene,
  lehrplanKlassen,
} from "@/lib/db/schema/lehrplan";

/**
 * Curriculum import from JSON source files.
 *
 * Data format (see data/lehrplan/curriculum.json):
 *   { <subjectKey>: { title, years: { <klasse>: { title, competence_areas: [...] } } } }
 *
 * A single source file may contain multiple subjects. For each subject one
 * Lehrplan is created with the slug `slugify(subjectKey)` (e.g.
 * "Digitale_Grundbildung" → "digitale-grundbildung"). The import is
 * idempotent: existing entries (same slug/code) are skipped.
 */

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

export type RawCurriculumFile = Record<string, RawLehrplan>;

const PERSPEKTIVEN: KompetenzPerspektive[] = ["T", "G", "I"];

function parsePerspektive(value: string | undefined): KompetenzPerspektive | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return (PERSPEKTIVEN as string[]).includes(upper) ? (upper as KompetenzPerspektive) : null;
}

function shortTitle(text: string, maxLen = 80): string {
  const trimmed = text.trim();
  const cutoff = trimmed.match(/^(.{10,80}?)(?:[.,;:]|$)/);
  const candidate = cutoff ? cutoff[1] : trimmed;
  if (candidate.length <= maxLen) return candidate;
  return `${candidate.slice(0, maxLen - 1).trim()}…`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Catalog (JSON source)
// ---------------------------------------------------------------------------

export interface CurriculumCatalogGrade {
  klasse: number;
  title: string;
  kompetenzbereicheAnzahl: number;
  kompetenzenAnzahl: number;
  anwendungsbereicheAnzahl: number;
}

export interface CurriculumCatalogSubject {
  /** Schlüssel innerhalb der JSON-Datei (z. B. "Digitale_Grundbildung"). */
  subjectKey: string;
  /** Stabiler Slug, unter dem dieser Lehrplan in der DB abgelegt wird. */
  slug: string;
  title: string;
  klassen: CurriculumCatalogGrade[];
}

export interface CurriculumCatalog {
  /** Quelldatei (Basename), aus der die Einträge stammen. */
  source: string;
  subjects: CurriculumCatalogSubject[];
}

export const DEFAULT_CURRICULUM_FILE = "curriculum.json";

function curriculumFolder(): string {
  return path.join(process.cwd(), "data", "lehrplan");
}

export async function loadCurriculumCatalogFromDb(
  fileName: string = DEFAULT_CURRICULUM_FILE,
): Promise<CurriculumCatalog> {
  const file = path.join(curriculumFolder(), fileName);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawCurriculumFile;
  const entries = Object.entries(raw);

  const subjects: CurriculumCatalogSubject[] = entries.map(
    ([subjectKey, lp]) => {
      const slug = slugify(subjectKey);
      const klassen: CurriculumCatalogGrade[] = Object.entries(lp.years)
        .map(([yearKey, year]) => {
          const klasse = Number.parseInt(yearKey, 10);
          if (!Number.isFinite(klasse)) return null;
          let kompCount = 0;
          let awbCount = 0;
          for (const area of year.competence_areas) {
            kompCount += area.competencies.length;
            awbCount += area.applications.length;
          }
          return {
            klasse,
            title: year.title,
            kompetenzbereicheAnzahl: year.competence_areas.length,
            kompetenzenAnzahl: kompCount,
            anwendungsbereicheAnzahl: awbCount,
          } satisfies CurriculumCatalogGrade;
        })
        .filter((k): k is CurriculumCatalogGrade => k !== null)
        .sort((a, b) => a.klasse - b.klasse);
      return { subjectKey, slug, title: lp.title, klassen };
    },
  );

  return { source: fileName, subjects };
}

// ---------------------------------------------------------------------------
// Import into the database
// ---------------------------------------------------------------------------

export interface ImportSelection {
  subjectKey: string;
  /** When empty/`null`, all available Klassen are imported. */
  klassen?: number[] | null;
}

export interface ImportResult {
  subjectKey: string;
  slug: string;
  title: string;
  klassen: Array<{
    klasse: number;
    bereiche: number;
    newKompetenzen: number;
    newAnwendungsbereiche: number;
  }>;
}

async function upsertLehrplan(slug: string, title: string) {
  const existing = await db.select().from(lehrplaene).where(eq(lehrplaene.slug, slug)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(lehrplaene)
    .values({ slug, title, subject: title, schulstufe: "Sekundarstufe I" })
    .returning();
  return created;
}

async function upsertKlasse(lehrplanId: string, klasseNr: number, title: string) {
  const existing = (
    await db.select().from(lehrplanKlassen).where(eq(lehrplanKlassen.lehrplanId, lehrplanId))
  ).find((k) => k.klasse === klasseNr);
  if (existing) return existing;
  const [created] = await db
    .insert(lehrplanKlassen)
    .values({ lehrplanId, klasse: klasseNr, title, sortOrder: klasseNr })
    .returning();
  return created;
}

async function upsertBereich(
  klasseId: string,
  code: string,
  title: string,
  description: string | null,
  sortOrder: number,
) {
  const existing = (
    await db.select().from(kompetenzbereiche).where(eq(kompetenzbereiche.klasseId, klasseId))
  ).find((b) => b.code === code);
  if (existing) return existing;
  const [created] = await db
    .insert(kompetenzbereiche)
    .values({ klasseId, code, title, description, sortOrder })
    .returning();
  return created;
}

async function importLehrplan(
  slug: string,
  raw: RawLehrplan,
  klassenFilter: Set<number> | null,
): Promise<ImportResult> {
  const lp = await upsertLehrplan(slug, raw.title);
  const result: ImportResult = {
    subjectKey: raw.title,
    slug,
    title: raw.title,
    klassen: [],
  };

  for (const [yearKey, year] of Object.entries(raw.years)) {
    const klasseNr = Number.parseInt(yearKey, 10);
    if (!Number.isFinite(klasseNr)) continue;
    if (klassenFilter && !klassenFilter.has(klasseNr)) continue;

    const klasse = await upsertKlasse(lp.id, klasseNr, year.title);
    let newKomp = 0;
    let newAwb = 0;

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
        const desc = c.description.trim();
        await db.insert(kompetenzen).values({
          kompetenzbereichId: bereich.id,
          code,
          title: shortTitle(desc),
          description: desc,
          perspektive: parsePerspektive(c.perspective),
          crossCuttingTopics: [],
          sortOrder: kompSort,
        });
        newKomp += 1;
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
        const desc = app.trim();
        await db.insert(anwendungsbereiche).values({
          kompetenzbereichId: bereich.id,
          code,
          title: shortTitle(desc),
          description: desc,
          crossCuttingTopics: [],
          sortOrder: appSort,
        });
        newAwb += 1;
      }
    }

    result.klassen.push({
      klasse: klasseNr,
      bereiche: year.competence_areas.length,
      newKompetenzen: newKomp,
      newAnwendungsbereiche: newAwb,
    });
  }

  return result;
}

/**
 * Imports the subjects/Klassen named in `selection` from the source file.
 * If `selection` is empty, EVERYTHING is imported.
 */
export async function importCurriculum(
  selection: ImportSelection[] = [],
  fileName: string = DEFAULT_CURRICULUM_FILE,
): Promise<ImportResult[]> {
  const file = path.join(curriculumFolder(), fileName);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawCurriculumFile;
  const entries = Object.entries(raw);

  const selectionBySubject = new Map<string, ImportSelection>();
  for (const a of selection) selectionBySubject.set(a.subjectKey, a);
  const importAlles = selection.length === 0;

  const results: ImportResult[] = [];
  for (const [subjectKey, lp] of entries) {
    if (!importAlles && !selectionBySubject.has(subjectKey)) continue;
    const slug = slugify(subjectKey);
    const sel = selectionBySubject.get(subjectKey);
    const klassenFilter =
      sel?.klassen && sel.klassen.length > 0 ? new Set(sel.klassen) : null;
    const result = await importLehrplan(slug, lp, klassenFilter);
    result.subjectKey = subjectKey;
    results.push(result);
  }
  return results;
}
