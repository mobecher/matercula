import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { type Dokument, dokumente } from "@/lib/db/schema/dokumente";
import {
  anwendungsbereiche,
  kompetenzbereiche,
  kompetenzen,
  lehrplaene,
  lehrplanKlassen,
} from "@/lib/db/schema/lehrplan";
import {
  dokumentAnwendungsbereichLinks,
  dokumentKompetenzLinks,
  dokumentLinkVorschlaege,
} from "@/lib/db/schema/links";

/**
 * Hält den Status passender KI-Vorschläge mit dem tatsächlichen Link-Stand
 * synchron, wenn ein Link manuell angelegt oder entfernt wurde.
 */
async function syncSuggestionStatusForLink(args: {
  dokumentId: string;
  zielTyp: "kompetenz" | "anwendungsbereich";
  zielId: string;
  neuerStatus: "akzeptiert" | "offen";
}): Promise<void> {
  const zielFilter =
    args.zielTyp === "kompetenz"
      ? eq(dokumentLinkVorschlaege.kompetenzId, args.zielId)
      : eq(dokumentLinkVorschlaege.anwendungsbereichId, args.zielId);
  await db
    .update(dokumentLinkVorschlaege)
    .set({
      status: args.neuerStatus,
      decidedAt: args.neuerStatus === "akzeptiert" ? new Date() : null,
    })
    .where(
      and(
        eq(dokumentLinkVorschlaege.dokumentId, args.dokumentId),
        eq(dokumentLinkVorschlaege.zielTyp, args.zielTyp),
        zielFilter,
        ne(dokumentLinkVorschlaege.status, args.neuerStatus),
      ),
    );
}

export interface VerknuepftesDokument {
  id: string;
  titel: string;
  icon: string | null;
  notiz: string | null;
}

/** Reverse-Link-Eintrag: ein Lehrplan-Element, mit dem ein Dokument verknüpft ist. */
export interface DokumentLehrplanLink {
  id: string;
  code: string;
  titel: string;
  /** Pfad-Beschriftung (Lehrplan › Klasse › Bereich) für Tooltip/Untertitel. */
  pfad: string;
}

export interface DokumentLehrplanLinks {
  kompetenzen: DokumentLehrplanLink[];
  anwendungsbereiche: DokumentLehrplanLink[];
}

/** Reverse-Lookup: zu welchen Kompetenzen/Anwendungsbereichen gehört das Dokument? */
export async function loadLehrplanLinksForDocument(
  dokumentId: string,
  ownerId: string,
): Promise<DokumentLehrplanLinks | null> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(and(eq(dokumente.id, dokumentId), eq(dokumente.ownerId, ownerId)))
    .limit(1);
  if (!doc) return null;

  const kompRows = await db
    .select({
      id: kompetenzen.id,
      code: kompetenzen.code,
      titel: kompetenzen.titel,
      bereichTitel: kompetenzbereiche.titel,
      klasseTitel: lehrplanKlassen.titel,
      lehrplanTitel: lehrplaene.titel,
      createdAt: dokumentKompetenzLinks.createdAt,
    })
    .from(dokumentKompetenzLinks)
    .innerJoin(
      kompetenzen,
      eq(kompetenzen.id, dokumentKompetenzLinks.kompetenzId),
    )
    .innerJoin(
      kompetenzbereiche,
      eq(kompetenzbereiche.id, kompetenzen.kompetenzbereichId),
    )
    .innerJoin(
      lehrplanKlassen,
      eq(lehrplanKlassen.id, kompetenzbereiche.klasseId),
    )
    .innerJoin(lehrplaene, eq(lehrplaene.id, lehrplanKlassen.lehrplanId))
    .where(eq(dokumentKompetenzLinks.dokumentId, dokumentId))
    .orderBy(asc(dokumentKompetenzLinks.createdAt));

  const awbRows = await db
    .select({
      id: anwendungsbereiche.id,
      code: anwendungsbereiche.code,
      titel: anwendungsbereiche.titel,
      bereichTitel: kompetenzbereiche.titel,
      klasseTitel: lehrplanKlassen.titel,
      lehrplanTitel: lehrplaene.titel,
      createdAt: dokumentAnwendungsbereichLinks.createdAt,
    })
    .from(dokumentAnwendungsbereichLinks)
    .innerJoin(
      anwendungsbereiche,
      eq(
        anwendungsbereiche.id,
        dokumentAnwendungsbereichLinks.anwendungsbereichId,
      ),
    )
    .innerJoin(
      kompetenzbereiche,
      eq(kompetenzbereiche.id, anwendungsbereiche.kompetenzbereichId),
    )
    .innerJoin(
      lehrplanKlassen,
      eq(lehrplanKlassen.id, kompetenzbereiche.klasseId),
    )
    .innerJoin(lehrplaene, eq(lehrplaene.id, lehrplanKlassen.lehrplanId))
    .where(eq(dokumentAnwendungsbereichLinks.dokumentId, dokumentId))
    .orderBy(asc(dokumentAnwendungsbereichLinks.createdAt));

  return {
    kompetenzen: kompRows.map((r) => ({
      id: r.id,
      code: r.code,
      titel: r.titel,
      pfad: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
    })),
    anwendungsbereiche: awbRows.map((r) => ({
      id: r.id,
      code: r.code,
      titel: r.titel,
      pfad: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
    })),
  };
}

export async function loadDocumentsForKompetenz(
  kompetenzId: string,
  ownerId: string,
): Promise<VerknuepftesDokument[]> {
  const links = await db
    .select()
    .from(dokumentKompetenzLinks)
    .where(eq(dokumentKompetenzLinks.kompetenzId, kompetenzId))
    .orderBy(asc(dokumentKompetenzLinks.createdAt));
  if (links.length === 0) return [];
  const docs = await db
    .select()
    .from(dokumente)
    .where(
      and(
        inArray(
          dokumente.id,
          links.map((l) => l.dokumentId),
        ),
        eq(dokumente.ownerId, ownerId),
      ),
    );
  const byId = new Map<string, Dokument>(docs.map((d) => [d.id, d]));
  return links
    .map((l) => {
      const d = byId.get(l.dokumentId);
      if (!d) return null;
      return {
        id: d.id,
        titel: d.titel,
        icon: d.icon,
        notiz: l.notiz,
      };
    })
    .filter((x): x is VerknuepftesDokument => x !== null);
}

export async function loadDocumentsForAnwendungsbereich(
  anwendungsbereichId: string,
  ownerId: string,
): Promise<VerknuepftesDokument[]> {
  const links = await db
    .select()
    .from(dokumentAnwendungsbereichLinks)
    .where(
      eq(
        dokumentAnwendungsbereichLinks.anwendungsbereichId,
        anwendungsbereichId,
      ),
    )
    .orderBy(asc(dokumentAnwendungsbereichLinks.createdAt));
  if (links.length === 0) return [];
  const docs = await db
    .select()
    .from(dokumente)
    .where(
      and(
        inArray(
          dokumente.id,
          links.map((l) => l.dokumentId),
        ),
        eq(dokumente.ownerId, ownerId),
      ),
    );
  const byId = new Map<string, Dokument>(docs.map((d) => [d.id, d]));
  return links
    .map((l) => {
      const d = byId.get(l.dokumentId);
      if (!d) return null;
      return { id: d.id, titel: d.titel, icon: d.icon, notiz: l.notiz };
    })
    .filter((x): x is VerknuepftesDokument => x !== null);
}

export async function linkKompetenz(args: {
  dokumentId: string;
  kompetenzId: string;
  ownerId: string;
  notiz?: string | null;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(
      and(
        eq(dokumente.id, args.dokumentId),
        eq(dokumente.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  await db
    .insert(dokumentKompetenzLinks)
    .values({
      dokumentId: args.dokumentId,
      kompetenzId: args.kompetenzId,
      notiz: args.notiz ?? null,
    })
    .onConflictDoNothing();
  await syncSuggestionStatusForLink({
    dokumentId: args.dokumentId,
    zielTyp: "kompetenz",
    zielId: args.kompetenzId,
    neuerStatus: "akzeptiert",
  });
  return true;
}

export async function deleteKompetenzLink(args: {
  dokumentId: string;
  kompetenzId: string;
  ownerId: string;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(
      and(
        eq(dokumente.id, args.dokumentId),
        eq(dokumente.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  const result = await db
    .delete(dokumentKompetenzLinks)
    .where(
      and(
        eq(dokumentKompetenzLinks.dokumentId, args.dokumentId),
        eq(dokumentKompetenzLinks.kompetenzId, args.kompetenzId),
      ),
    )
    .returning({ id: dokumentKompetenzLinks.id });
  if (result.length > 0) {
    await syncSuggestionStatusForLink({
      dokumentId: args.dokumentId,
      zielTyp: "kompetenz",
      zielId: args.kompetenzId,
      neuerStatus: "offen",
    });
  }
  return result.length > 0;
}

export async function linkAnwendungsbereich(args: {
  dokumentId: string;
  anwendungsbereichId: string;
  ownerId: string;
  notiz?: string | null;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(
      and(
        eq(dokumente.id, args.dokumentId),
        eq(dokumente.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  await db
    .insert(dokumentAnwendungsbereichLinks)
    .values({
      dokumentId: args.dokumentId,
      anwendungsbereichId: args.anwendungsbereichId,
      notiz: args.notiz ?? null,
    })
    .onConflictDoNothing();
  await syncSuggestionStatusForLink({
    dokumentId: args.dokumentId,
    zielTyp: "anwendungsbereich",
    zielId: args.anwendungsbereichId,
    neuerStatus: "akzeptiert",
  });
  return true;
}

export async function deleteAnwendungsbereichLink(args: {
  dokumentId: string;
  anwendungsbereichId: string;
  ownerId: string;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(
      and(
        eq(dokumente.id, args.dokumentId),
        eq(dokumente.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  const result = await db
    .delete(dokumentAnwendungsbereichLinks)
    .where(
      and(
        eq(dokumentAnwendungsbereichLinks.dokumentId, args.dokumentId),
        eq(
          dokumentAnwendungsbereichLinks.anwendungsbereichId,
          args.anwendungsbereichId,
        ),
      ),
    )
    .returning({ id: dokumentAnwendungsbereichLinks.id });
  if (result.length > 0) {
    await syncSuggestionStatusForLink({
      dokumentId: args.dokumentId,
      zielTyp: "anwendungsbereich",
      zielId: args.anwendungsbereichId,
      neuerStatus: "offen",
    });
  }
  return result.length > 0;
}
