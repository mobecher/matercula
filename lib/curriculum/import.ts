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
 * Curriculum-Import aus JSON-Quelldateien.
 *
 * Datenformat (vgl. data/lehrplan/curriculum.json):
 *   { <Fachschluessel>: { title, years: { <klasse>: { title, competence_areas: [...] } } } }
 *
 * Eine Quelldatei kann mehrere Fächer enthalten. Pro Fach wird ein Lehrplan
 * mit dem Slug `slugify(fachKey)` angelegt (z. B. "Digitale_Grundbildung"
 * → "digitale-grundbildung"). Der Import ist idempotent: bereits vorhandene
 * Einträge (gleicher Slug/Code) werden übersprungen.
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
// Katalog (JSON-Quelle)
// ---------------------------------------------------------------------------

export interface CurriculumKatalogKlasse {
  klasse: number;
  titel: string;
  kompetenzbereicheAnzahl: number;
  kompetenzenAnzahl: number;
  anwendungsbereicheAnzahl: number;
}

export interface CurriculumKatalogFach {
  /** Schlüssel innerhalb der JSON-Datei (z. B. "Digitale_Grundbildung"). */
  fachKey: string;
  /** Stabiler Slug, unter dem dieser Lehrplan in der DB abgelegt wird. */
  slug: string;
  titel: string;
  klassen: CurriculumKatalogKlasse[];
}

export interface CurriculumKatalog {
  /** Quelldatei (Basename), aus der die Einträge stammen. */
  quelle: string;
  faecher: CurriculumKatalogFach[];
}

export const DEFAULT_CURRICULUM_FILE = "curriculum.json";

function curriculumFolder(): string {
  return path.join(process.cwd(), "data", "lehrplan");
}

export async function ladeCurriculumKatalog(
  fileName: string = DEFAULT_CURRICULUM_FILE,
): Promise<CurriculumKatalog> {
  const file = path.join(curriculumFolder(), fileName);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawCurriculumFile;
  const entries = Object.entries(raw);

  const faecher: CurriculumKatalogFach[] = entries.map(([fachKey, lp]) => {
    const slug = slugify(fachKey);
    const klassen: CurriculumKatalogKlasse[] = Object.entries(lp.years)
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
          titel: year.title,
          kompetenzbereicheAnzahl: year.competence_areas.length,
          kompetenzenAnzahl: kompCount,
          anwendungsbereicheAnzahl: awbCount,
        } satisfies CurriculumKatalogKlasse;
      })
      .filter((k): k is CurriculumKatalogKlasse => k !== null)
      .sort((a, b) => a.klasse - b.klasse);
    return { fachKey, slug, titel: lp.title, klassen };
  });

  return { quelle: fileName, faecher };
}

// ---------------------------------------------------------------------------
// Import in die Datenbank
// ---------------------------------------------------------------------------

export interface ImportAuswahl {
  fachKey: string;
  /** Wenn leer/`null`, werden alle vorhandenen Klassen importiert. */
  klassen?: number[] | null;
}

export interface ImportErgebnis {
  fachKey: string;
  slug: string;
  titel: string;
  klassen: Array<{
    klasse: number;
    bereiche: number;
    neueKompetenzen: number;
    neueAnwendungsbereiche: number;
  }>;
}

async function upsertLehrplan(slug: string, titel: string) {
  const existing = await db.select().from(lehrplaene).where(eq(lehrplaene.slug, slug)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(lehrplaene)
    .values({ slug, titel, fach: titel, schulstufe: "Sekundarstufe I" })
    .returning();
  return created;
}

async function upsertKlasse(lehrplanId: string, klasseNr: number, titel: string) {
  const existing = (
    await db.select().from(lehrplanKlassen).where(eq(lehrplanKlassen.lehrplanId, lehrplanId))
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
    await db.select().from(kompetenzbereiche).where(eq(kompetenzbereiche.klasseId, klasseId))
  ).find((b) => b.code === code);
  if (existing) return existing;
  const [created] = await db
    .insert(kompetenzbereiche)
    .values({ klasseId, code, titel, beschreibung, sortierung })
    .returning();
  return created;
}

async function importLehrplan(
  slug: string,
  raw: RawLehrplan,
  klassenFilter: Set<number> | null,
): Promise<ImportErgebnis> {
  const lp = await upsertLehrplan(slug, raw.title);
  const ergebnis: ImportErgebnis = {
    fachKey: raw.title,
    slug,
    titel: raw.title,
    klassen: [],
  };

  for (const [yearKey, year] of Object.entries(raw.years)) {
    const klasseNr = Number.parseInt(yearKey, 10);
    if (!Number.isFinite(klasseNr)) continue;
    if (klassenFilter && !klassenFilter.has(klasseNr)) continue;

    const klasse = await upsertKlasse(lp.id, klasseNr, year.title);
    let neueKomp = 0;
    let neueAwb = 0;

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
        neueKomp += 1;
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
        neueAwb += 1;
      }
    }

    ergebnis.klassen.push({
      klasse: klasseNr,
      bereiche: year.competence_areas.length,
      neueKompetenzen: neueKomp,
      neueAnwendungsbereiche: neueAwb,
    });
  }

  return ergebnis;
}

/**
 * Importiert die in `auswahl` benannten Fächer/Klassen aus der Quelldatei.
 * Wenn `auswahl` leer ist, wird ALLES importiert.
 */
export async function importiereCurriculum(
  auswahl: ImportAuswahl[] = [],
  fileName: string = DEFAULT_CURRICULUM_FILE,
): Promise<ImportErgebnis[]> {
  const file = path.join(curriculumFolder(), fileName);
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawCurriculumFile;
  const entries = Object.entries(raw);

  const auswahlByFach = new Map<string, ImportAuswahl>();
  for (const a of auswahl) auswahlByFach.set(a.fachKey, a);
  const importAlles = auswahl.length === 0;

  const ergebnisse: ImportErgebnis[] = [];
  for (const [fachKey, lp] of entries) {
    if (!importAlles && !auswahlByFach.has(fachKey)) continue;
    const slug = slugify(fachKey);
    const sel = auswahlByFach.get(fachKey);
    const klassenFilter = sel?.klassen && sel.klassen.length > 0 ? new Set(sel.klassen) : null;
    const ergebnis = await importLehrplan(slug, lp, klassenFilter);
    ergebnis.fachKey = fachKey;
    ergebnisse.push(ergebnis);
  }
  return ergebnisse;
}
