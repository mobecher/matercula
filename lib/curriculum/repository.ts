import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  type Anwendungsbereich,
  anwendungsbereiche,
  type Kompetenz,
  type Kompetenzbereich,
  kompetenzbereiche,
  kompetenzen,
  type Lehrplan,
  type LehrplanKlasse,
  lehrplaene,
  lehrplanKlassen,
} from "@/lib/db/schema/lehrplan";

export interface LehrplanOverview {
  lehrplan: Lehrplan;
  klassen: LehrplanKlasse[];
}

export async function loadAllLehrplaene(): Promise<LehrplanOverview[]> {
  const plaene = await db
    .select()
    .from(lehrplaene)
    .orderBy(asc(lehrplaene.sortOrder), asc(lehrplaene.title));
  if (plaene.length === 0) return [];
  const klassen = await db
    .select()
    .from(lehrplanKlassen)
    .where(
      inArray(
        lehrplanKlassen.lehrplanId,
        plaene.map((p) => p.id),
      ),
    )
    .orderBy(asc(lehrplanKlassen.sortOrder));
  const byLp = new Map<string, LehrplanKlasse[]>();
  for (const k of klassen) {
    const arr = byLp.get(k.lehrplanId) ?? [];
    arr.push(k);
    byLp.set(k.lehrplanId, arr);
  }
  return plaene.map((lp) => ({ lehrplan: lp, klassen: byLp.get(lp.id) ?? [] }));
}

export async function loadLehrplanBySlug(
  slug: string,
): Promise<LehrplanOverview | null> {
  const [lp] = await db
    .select()
    .from(lehrplaene)
    .where(eq(lehrplaene.slug, slug))
    .limit(1);
  if (!lp) return null;
  const klassen = await db
    .select()
    .from(lehrplanKlassen)
    .where(eq(lehrplanKlassen.lehrplanId, lp.id))
    .orderBy(asc(lehrplanKlassen.sortOrder));
  return { lehrplan: lp, klassen };
}

export interface KlasseOverview {
  lehrplan: Lehrplan;
  klasse: LehrplanKlasse;
  bereiche: Array<{
    bereich: Kompetenzbereich;
    kompetenzenAnzahl: number;
    anwendungsbereicheAnzahl: number;
  }>;
}

export async function loadKlasseOverview(
  lehrplanSlug: string,
  klasseNr: number,
): Promise<KlasseOverview | null> {
  const [lp] = await db
    .select()
    .from(lehrplaene)
    .where(eq(lehrplaene.slug, lehrplanSlug))
    .limit(1);
  if (!lp) return null;
  const allKlassen = await db
    .select()
    .from(lehrplanKlassen)
    .where(eq(lehrplanKlassen.lehrplanId, lp.id));
  const klasse = allKlassen.find((k) => k.klasse === klasseNr);
  if (!klasse) return null;
  const bereiche = await db
    .select()
    .from(kompetenzbereiche)
    .where(eq(kompetenzbereiche.klasseId, klasse.id))
    .orderBy(asc(kompetenzbereiche.sortOrder));
  if (bereiche.length === 0) {
    return { lehrplan: lp, klasse, bereiche: [] };
  }
  const ids = bereiche.map((b) => b.id);
  const komp = await db
    .select()
    .from(kompetenzen)
    .where(inArray(kompetenzen.kompetenzbereichId, ids));
  const apps = await db
    .select()
    .from(anwendungsbereiche)
    .where(inArray(anwendungsbereiche.kompetenzbereichId, ids));
  const kompCount = new Map<string, number>();
  for (const k of komp)
    kompCount.set(
      k.kompetenzbereichId,
      (kompCount.get(k.kompetenzbereichId) ?? 0) + 1,
    );
  const appCount = new Map<string, number>();
  for (const a of apps)
    appCount.set(
      a.kompetenzbereichId,
      (appCount.get(a.kompetenzbereichId) ?? 0) + 1,
    );
  return {
    lehrplan: lp,
    klasse,
    bereiche: bereiche.map((b) => ({
      bereich: b,
      kompetenzenAnzahl: kompCount.get(b.id) ?? 0,
      anwendungsbereicheAnzahl: appCount.get(b.id) ?? 0,
    })),
  };
}

export interface KompetenzbereichDetail {
  lehrplan: Lehrplan;
  klasse: LehrplanKlasse;
  bereich: Kompetenzbereich;
  kompetenzen: Kompetenz[];
  anwendungsbereiche: Anwendungsbereich[];
}

export async function loadKompetenzbereichDetail(
  bereichId: string,
): Promise<KompetenzbereichDetail | null> {
  const [bereich] = await db
    .select()
    .from(kompetenzbereiche)
    .where(eq(kompetenzbereiche.id, bereichId))
    .limit(1);
  if (!bereich) return null;
  const [klasse] = await db
    .select()
    .from(lehrplanKlassen)
    .where(eq(lehrplanKlassen.id, bereich.klasseId))
    .limit(1);
  if (!klasse) return null;
  const [lp] = await db
    .select()
    .from(lehrplaene)
    .where(eq(lehrplaene.id, klasse.lehrplanId))
    .limit(1);
  if (!lp) return null;
  const komp = await db
    .select()
    .from(kompetenzen)
    .where(eq(kompetenzen.kompetenzbereichId, bereich.id))
    .orderBy(asc(kompetenzen.sortOrder));
  const apps = await db
    .select()
    .from(anwendungsbereiche)
    .where(eq(anwendungsbereiche.kompetenzbereichId, bereich.id))
    .orderBy(asc(anwendungsbereiche.sortOrder));
  return {
    lehrplan: lp,
    klasse,
    bereich,
    kompetenzen: komp,
    anwendungsbereiche: apps,
  };
}

export interface KompetenzDetail {
  lehrplan: Lehrplan;
  klasse: LehrplanKlasse;
  bereich: Kompetenzbereich;
  kompetenz: Kompetenz;
}

export async function loadKompetenzDetail(
  kompetenzId: string,
): Promise<KompetenzDetail | null> {
  const [k] = await db
    .select()
    .from(kompetenzen)
    .where(eq(kompetenzen.id, kompetenzId))
    .limit(1);
  if (!k) return null;
  const [bereich] = await db
    .select()
    .from(kompetenzbereiche)
    .where(eq(kompetenzbereiche.id, k.kompetenzbereichId))
    .limit(1);
  if (!bereich) return null;
  const [klasse] = await db
    .select()
    .from(lehrplanKlassen)
    .where(eq(lehrplanKlassen.id, bereich.klasseId))
    .limit(1);
  if (!klasse) return null;
  const [lp] = await db
    .select()
    .from(lehrplaene)
    .where(eq(lehrplaene.id, klasse.lehrplanId))
    .limit(1);
  if (!lp) return null;
  return { lehrplan: lp, klasse, bereich, kompetenz: k };
}

export interface AnwendungsbereichDetail {
  lehrplan: Lehrplan;
  klasse: LehrplanKlasse;
  bereich: Kompetenzbereich;
  anwendungsbereich: Anwendungsbereich;
}

export async function loadAnwendungsbereichDetail(
  anwendungsbereichId: string,
): Promise<AnwendungsbereichDetail | null> {
  const [a] = await db
    .select()
    .from(anwendungsbereiche)
    .where(eq(anwendungsbereiche.id, anwendungsbereichId))
    .limit(1);
  if (!a) return null;
  const [bereich] = await db
    .select()
    .from(kompetenzbereiche)
    .where(eq(kompetenzbereiche.id, a.kompetenzbereichId))
    .limit(1);
  if (!bereich) return null;
  const [klasse] = await db
    .select()
    .from(lehrplanKlassen)
    .where(eq(lehrplanKlassen.id, bereich.klasseId))
    .limit(1);
  if (!klasse) return null;
  const [lp] = await db
    .select()
    .from(lehrplaene)
    .where(eq(lehrplaene.id, klasse.lehrplanId))
    .limit(1);
  if (!lp) return null;
  return { lehrplan: lp, klasse, bereich, anwendungsbereich: a };
}

export interface SidebarBereichItem {
  id: string;
  title: string;
}
export interface SidebarBereich {
  id: string;
  title: string;
  kompetenzen: SidebarBereichItem[];
  anwendungsbereiche: SidebarBereichItem[];
}
export interface SidebarLehrplanKlasse {
  id: string;
  klasse: number;
  title: string;
  bereiche: SidebarBereich[];
}

export interface SidebarLehrplan {
  id: string;
  slug: string;
  title: string;
  klassen: SidebarLehrplanKlasse[];
}

/**
 * Returns a compact tree structure for the sidebar:
 * Lehrplan → Klassen → Kompetenzbereiche.
 */
export async function loadLehrplanSidebar(): Promise<SidebarLehrplan[]> {
  const plaene = await db
    .select()
    .from(lehrplaene)
    .orderBy(asc(lehrplaene.title));
  if (plaene.length === 0) return [];
  const klassen = await db
    .select()
    .from(lehrplanKlassen)
    .where(
      inArray(
        lehrplanKlassen.lehrplanId,
        plaene.map((p) => p.id),
      ),
    )
    .orderBy(asc(lehrplanKlassen.sortOrder));
  const bereiche = klassen.length
    ? await db
        .select()
        .from(kompetenzbereiche)
        .where(
          inArray(
            kompetenzbereiche.klasseId,
            klassen.map((k) => k.id),
          ),
        )
        .orderBy(asc(kompetenzbereiche.sortOrder))
    : [];
  const bereichIds = bereiche.map((b) => b.id);
  const komps = bereichIds.length
    ? await db
        .select()
        .from(kompetenzen)
        .where(inArray(kompetenzen.kompetenzbereichId, bereichIds))
        .orderBy(asc(kompetenzen.sortOrder))
    : [];
  const awbs = bereichIds.length
    ? await db
        .select()
        .from(anwendungsbereiche)
        .where(inArray(anwendungsbereiche.kompetenzbereichId, bereichIds))
        .orderBy(asc(anwendungsbereiche.sortOrder))
    : [];

  const kompsByBereich = new Map<string, Kompetenz[]>();
  for (const k of komps) {
    const arr = kompsByBereich.get(k.kompetenzbereichId) ?? [];
    arr.push(k);
    kompsByBereich.set(k.kompetenzbereichId, arr);
  }
  const awbsByBereich = new Map<string, Anwendungsbereich[]>();
  for (const a of awbs) {
    const arr = awbsByBereich.get(a.kompetenzbereichId) ?? [];
    arr.push(a);
    awbsByBereich.set(a.kompetenzbereichId, arr);
  }
  const bereicheByKlasse = new Map<string, Kompetenzbereich[]>();
  for (const b of bereiche) {
    const arr = bereicheByKlasse.get(b.klasseId) ?? [];
    arr.push(b);
    bereicheByKlasse.set(b.klasseId, arr);
  }
  const klassenByLp = new Map<string, LehrplanKlasse[]>();
  for (const k of klassen) {
    const arr = klassenByLp.get(k.lehrplanId) ?? [];
    arr.push(k);
    klassenByLp.set(k.lehrplanId, arr);
  }

  return plaene.map((lp) => ({
    id: lp.id,
    slug: lp.slug,
    title: lp.title,
    klassen: (klassenByLp.get(lp.id) ?? []).map((k) => ({
      id: k.id,
      klasse: k.klasse,
      title: k.title,
      bereiche: (bereicheByKlasse.get(k.id) ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        kompetenzen: (kompsByBereich.get(b.id) ?? []).map((k) => ({
          id: k.id,
          title: k.title,
        })),
        anwendungsbereiche: (awbsByBereich.get(b.id) ?? []).map((a) => ({
          id: a.id,
          title: a.title,
        })),
      })),
    })),
  }));
}
