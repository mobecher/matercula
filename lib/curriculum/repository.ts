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

export interface LehrplanUebersicht {
  lehrplan: Lehrplan;
  klassen: LehrplanKlasse[];
}

export async function ladeAlleLehrplaene(): Promise<LehrplanUebersicht[]> {
  const plaene = await db
    .select()
    .from(lehrplaene)
    .orderBy(asc(lehrplaene.sortierung), asc(lehrplaene.titel));
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
    .orderBy(asc(lehrplanKlassen.sortierung));
  const byLp = new Map<string, LehrplanKlasse[]>();
  for (const k of klassen) {
    const arr = byLp.get(k.lehrplanId) ?? [];
    arr.push(k);
    byLp.set(k.lehrplanId, arr);
  }
  return plaene.map((lp) => ({ lehrplan: lp, klassen: byLp.get(lp.id) ?? [] }));
}

export async function ladeLehrplanBySlug(slug: string): Promise<LehrplanUebersicht | null> {
  const [lp] = await db.select().from(lehrplaene).where(eq(lehrplaene.slug, slug)).limit(1);
  if (!lp) return null;
  const klassen = await db
    .select()
    .from(lehrplanKlassen)
    .where(eq(lehrplanKlassen.lehrplanId, lp.id))
    .orderBy(asc(lehrplanKlassen.sortierung));
  return { lehrplan: lp, klassen };
}

export interface KlasseUebersicht {
  lehrplan: Lehrplan;
  klasse: LehrplanKlasse;
  bereiche: Array<{
    bereich: Kompetenzbereich;
    kompetenzenAnzahl: number;
    anwendungsbereicheAnzahl: number;
  }>;
}

export async function ladeKlasseUebersicht(
  lehrplanSlug: string,
  klasseNr: number,
): Promise<KlasseUebersicht | null> {
  const [lp] = await db.select().from(lehrplaene).where(eq(lehrplaene.slug, lehrplanSlug)).limit(1);
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
    .orderBy(asc(kompetenzbereiche.sortierung));
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
    kompCount.set(k.kompetenzbereichId, (kompCount.get(k.kompetenzbereichId) ?? 0) + 1);
  const appCount = new Map<string, number>();
  for (const a of apps)
    appCount.set(a.kompetenzbereichId, (appCount.get(a.kompetenzbereichId) ?? 0) + 1);
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

export async function ladeKompetenzbereichDetail(
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
    .orderBy(asc(kompetenzen.sortierung));
  const apps = await db
    .select()
    .from(anwendungsbereiche)
    .where(eq(anwendungsbereiche.kompetenzbereichId, bereich.id))
    .orderBy(asc(anwendungsbereiche.sortierung));
  return { lehrplan: lp, klasse, bereich, kompetenzen: komp, anwendungsbereiche: apps };
}

export interface KompetenzDetail {
  lehrplan: Lehrplan;
  klasse: LehrplanKlasse;
  bereich: Kompetenzbereich;
  kompetenz: Kompetenz;
}

export async function ladeKompetenzDetail(kompetenzId: string): Promise<KompetenzDetail | null> {
  const [k] = await db.select().from(kompetenzen).where(eq(kompetenzen.id, kompetenzId)).limit(1);
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

export async function ladeAnwendungsbereichDetail(
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
  titel: string;
}
export interface SidebarBereich {
  id: string;
  titel: string;
  kompetenzen: SidebarBereichItem[];
  anwendungsbereiche: SidebarBereichItem[];
}
export interface SidebarLehrplanKlasse {
  id: string;
  klasse: number;
  titel: string;
  bereiche: SidebarBereich[];
}

export interface SidebarLehrplan {
  id: string;
  slug: string;
  titel: string;
  klassen: SidebarLehrplanKlasse[];
}

/**
 * Liefert eine kompakte Baumstruktur für die Sidebar:
 * Lehrplan → Klassen → Kompetenzbereiche.
 */
export async function ladeLehrplanSidebar(): Promise<SidebarLehrplan[]> {
  const plaene = await db.select().from(lehrplaene).orderBy(asc(lehrplaene.titel));
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
    .orderBy(asc(lehrplanKlassen.sortierung));
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
        .orderBy(asc(kompetenzbereiche.sortierung))
    : [];
  const bereichIds = bereiche.map((b) => b.id);
  const komps = bereichIds.length
    ? await db
        .select()
        .from(kompetenzen)
        .where(inArray(kompetenzen.kompetenzbereichId, bereichIds))
        .orderBy(asc(kompetenzen.sortierung))
    : [];
  const awbs = bereichIds.length
    ? await db
        .select()
        .from(anwendungsbereiche)
        .where(inArray(anwendungsbereiche.kompetenzbereichId, bereichIds))
        .orderBy(asc(anwendungsbereiche.sortierung))
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
    titel: lp.titel,
    klassen: (klassenByLp.get(lp.id) ?? []).map((k) => ({
      id: k.id,
      klasse: k.klasse,
      titel: k.titel,
      bereiche: (bereicheByKlasse.get(k.id) ?? []).map((b) => ({
        id: b.id,
        titel: b.titel,
        kompetenzen: (kompsByBereich.get(b.id) ?? []).map((k) => ({
          id: k.id,
          titel: k.titel,
        })),
        anwendungsbereiche: (awbsByBereich.get(b.id) ?? []).map((a) => ({
          id: a.id,
          titel: a.titel,
        })),
      })),
    })),
  }));
}
