import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { type Document, documents } from "@/lib/db/schema/documents";
import {
  anwendungsbereiche,
  kompetenzbereiche,
  kompetenzen,
  lehrplaene,
  lehrplanKlassen,
} from "@/lib/db/schema/lehrplan";
import {
  documentAnwendungsbereichLinks,
  documentKompetenzLinks,
  documentLinkSuggestions,
} from "@/lib/db/schema/links";

/**
 * Hält den Status passender KI-Vorschläge mit dem tatsächlichen Link-Stand
 * synchron, wenn ein Link manuell angelegt oder entfernt wurde.
 */
async function syncSuggestionStatusForLink(args: {
  documentId: string;
  targetType: "kompetenz" | "anwendungsbereich";
  zielId: string;
  neuerStatus: "accepted" | "open";
}): Promise<void> {
  const zielFilter =
    args.targetType === "kompetenz"
      ? eq(documentLinkSuggestions.kompetenzId, args.zielId)
      : eq(documentLinkSuggestions.anwendungsbereichId, args.zielId);
  await db
    .update(documentLinkSuggestions)
    .set({
      status: args.neuerStatus,
      decidedAt: args.neuerStatus === "accepted" ? new Date() : null,
    })
    .where(
      and(
        eq(documentLinkSuggestions.documentId, args.documentId),
        eq(documentLinkSuggestions.targetType, args.targetType),
        zielFilter,
        ne(documentLinkSuggestions.status, args.neuerStatus),
      ),
    );
}

export interface VerknuepftesDokument {
  id: string;
  title: string;
  icon: string | null;
  note: string | null;
}

/** Reverse-Link-Eintrag: ein Lehrplan-Element, mit dem ein Document verknüpft ist. */
export interface DokumentLehrplanLink {
  id: string;
  code: string;
  title: string;
  /** Path label (Lehrplan › Klasse › Bereich) for tooltip/subtitle. */
  path: string;
}

export interface DokumentLehrplanLinks {
  kompetenzen: DokumentLehrplanLink[];
  anwendungsbereiche: DokumentLehrplanLink[];
}

/** Reverse-Lookup: zu welchen Kompetenzen/Anwendungsbereichen gehört das Document? */
export async function loadLehrplanLinksForDocument(
  documentId: string,
  ownerId: string,
): Promise<DokumentLehrplanLinks | null> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.ownerId, ownerId)))
    .limit(1);
  if (!doc) return null;

  const kompRows = await db
    .select({
      id: kompetenzen.id,
      code: kompetenzen.code,
      title: kompetenzen.title,
      bereichTitel: kompetenzbereiche.title,
      klasseTitel: lehrplanKlassen.title,
      lehrplanTitel: lehrplaene.title,
      createdAt: documentKompetenzLinks.createdAt,
    })
    .from(documentKompetenzLinks)
    .innerJoin(
      kompetenzen,
      eq(kompetenzen.id, documentKompetenzLinks.kompetenzId),
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
    .where(eq(documentKompetenzLinks.documentId, documentId))
    .orderBy(asc(documentKompetenzLinks.createdAt));

  const awbRows = await db
    .select({
      id: anwendungsbereiche.id,
      code: anwendungsbereiche.code,
      title: anwendungsbereiche.title,
      bereichTitel: kompetenzbereiche.title,
      klasseTitel: lehrplanKlassen.title,
      lehrplanTitel: lehrplaene.title,
      createdAt: documentAnwendungsbereichLinks.createdAt,
    })
    .from(documentAnwendungsbereichLinks)
    .innerJoin(
      anwendungsbereiche,
      eq(
        anwendungsbereiche.id,
        documentAnwendungsbereichLinks.anwendungsbereichId,
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
    .where(eq(documentAnwendungsbereichLinks.documentId, documentId))
    .orderBy(asc(documentAnwendungsbereichLinks.createdAt));

  return {
    kompetenzen: kompRows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      path: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
    })),
    anwendungsbereiche: awbRows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      path: `${r.lehrplanTitel} › ${r.klasseTitel} › ${r.bereichTitel}`,
    })),
  };
}

export async function loadDocumentsForKompetenz(
  kompetenzId: string,
  ownerId: string,
): Promise<VerknuepftesDokument[]> {
  const links = await db
    .select()
    .from(documentKompetenzLinks)
    .where(eq(documentKompetenzLinks.kompetenzId, kompetenzId))
    .orderBy(asc(documentKompetenzLinks.createdAt));
  if (links.length === 0) return [];
  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        inArray(
          documents.id,
          links.map((l) => l.documentId),
        ),
        eq(documents.ownerId, ownerId),
      ),
    );
  const byId = new Map<string, Document>(docs.map((d) => [d.id, d]));
  return links
    .map((l) => {
      const d = byId.get(l.documentId);
      if (!d) return null;
      return {
        id: d.id,
        title: d.title,
        icon: d.icon,
        note: l.note,
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
    .from(documentAnwendungsbereichLinks)
    .where(
      eq(
        documentAnwendungsbereichLinks.anwendungsbereichId,
        anwendungsbereichId,
      ),
    )
    .orderBy(asc(documentAnwendungsbereichLinks.createdAt));
  if (links.length === 0) return [];
  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        inArray(
          documents.id,
          links.map((l) => l.documentId),
        ),
        eq(documents.ownerId, ownerId),
      ),
    );
  const byId = new Map<string, Document>(docs.map((d) => [d.id, d]));
  return links
    .map((l) => {
      const d = byId.get(l.documentId);
      if (!d) return null;
      return { id: d.id, title: d.title, icon: d.icon, note: l.note };
    })
    .filter((x): x is VerknuepftesDokument => x !== null);
}

export async function linkKompetenz(args: {
  documentId: string;
  kompetenzId: string;
  ownerId: string;
  note?: string | null;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, args.documentId),
        eq(documents.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  await db
    .insert(documentKompetenzLinks)
    .values({
      documentId: args.documentId,
      kompetenzId: args.kompetenzId,
      note: args.note ?? null,
    })
    .onConflictDoNothing();
  await syncSuggestionStatusForLink({
    documentId: args.documentId,
    targetType: "kompetenz",
    zielId: args.kompetenzId,
    neuerStatus: "accepted",
  });
  return true;
}

export async function deleteKompetenzLink(args: {
  documentId: string;
  kompetenzId: string;
  ownerId: string;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, args.documentId),
        eq(documents.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  const result = await db
    .delete(documentKompetenzLinks)
    .where(
      and(
        eq(documentKompetenzLinks.documentId, args.documentId),
        eq(documentKompetenzLinks.kompetenzId, args.kompetenzId),
      ),
    )
    .returning({ id: documentKompetenzLinks.id });
  if (result.length > 0) {
    await syncSuggestionStatusForLink({
      documentId: args.documentId,
      targetType: "kompetenz",
      zielId: args.kompetenzId,
      neuerStatus: "open",
    });
  }
  return result.length > 0;
}

export async function linkAnwendungsbereich(args: {
  documentId: string;
  anwendungsbereichId: string;
  ownerId: string;
  note?: string | null;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, args.documentId),
        eq(documents.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  await db
    .insert(documentAnwendungsbereichLinks)
    .values({
      documentId: args.documentId,
      anwendungsbereichId: args.anwendungsbereichId,
      note: args.note ?? null,
    })
    .onConflictDoNothing();
  await syncSuggestionStatusForLink({
    documentId: args.documentId,
    targetType: "anwendungsbereich",
    zielId: args.anwendungsbereichId,
    neuerStatus: "accepted",
  });
  return true;
}

export async function deleteAnwendungsbereichLink(args: {
  documentId: string;
  anwendungsbereichId: string;
  ownerId: string;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, args.documentId),
        eq(documents.ownerId, args.ownerId),
      ),
    )
    .limit(1);
  if (!doc) return false;
  const result = await db
    .delete(documentAnwendungsbereichLinks)
    .where(
      and(
        eq(documentAnwendungsbereichLinks.documentId, args.documentId),
        eq(
          documentAnwendungsbereichLinks.anwendungsbereichId,
          args.anwendungsbereichId,
        ),
      ),
    )
    .returning({ id: documentAnwendungsbereichLinks.id });
  if (result.length > 0) {
    await syncSuggestionStatusForLink({
      documentId: args.documentId,
      targetType: "anwendungsbereich",
      zielId: args.anwendungsbereichId,
      neuerStatus: "open",
    });
  }
  return result.length > 0;
}
