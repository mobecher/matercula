import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { dokumente, type Dokument } from "@/lib/db/schema/dokumente";
import {
  dokumentAnwendungsbereichLinks,
  dokumentKompetenzLinks,
} from "@/lib/db/schema/links";

export interface VerknuepftesDokument {
  id: string;
  titel: string;
  icon: string | null;
  notiz: string | null;
}

export async function ladeDokumenteFuerKompetenz(
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

export async function ladeDokumenteFuerAnwendungsbereich(
  anwendungsbereichId: string,
  ownerId: string,
): Promise<VerknuepftesDokument[]> {
  const links = await db
    .select()
    .from(dokumentAnwendungsbereichLinks)
    .where(eq(dokumentAnwendungsbereichLinks.anwendungsbereichId, anwendungsbereichId))
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

export async function verknuepfeKompetenz(args: {
  dokumentId: string;
  kompetenzId: string;
  ownerId: string;
  notiz?: string | null;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(and(eq(dokumente.id, args.dokumentId), eq(dokumente.ownerId, args.ownerId)))
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
  return true;
}

export async function loescheKompetenzVerknuepfung(args: {
  dokumentId: string;
  kompetenzId: string;
  ownerId: string;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(and(eq(dokumente.id, args.dokumentId), eq(dokumente.ownerId, args.ownerId)))
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
  return result.length > 0;
}

export async function verknuepfeAnwendungsbereich(args: {
  dokumentId: string;
  anwendungsbereichId: string;
  ownerId: string;
  notiz?: string | null;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(and(eq(dokumente.id, args.dokumentId), eq(dokumente.ownerId, args.ownerId)))
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
  return true;
}

export async function loescheAnwendungsbereichVerknuepfung(args: {
  dokumentId: string;
  anwendungsbereichId: string;
  ownerId: string;
}): Promise<boolean> {
  const [doc] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(and(eq(dokumente.id, args.dokumentId), eq(dokumente.ownerId, args.ownerId)))
    .limit(1);
  if (!doc) return false;
  const result = await db
    .delete(dokumentAnwendungsbereichLinks)
    .where(
      and(
        eq(dokumentAnwendungsbereichLinks.dokumentId, args.dokumentId),
        eq(dokumentAnwendungsbereichLinks.anwendungsbereichId, args.anwendungsbereichId),
      ),
    )
    .returning({ id: dokumentAnwendungsbereichLinks.id });
  return result.length > 0;
}
