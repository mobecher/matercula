import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { type Dokument, dokumente } from "@/lib/db/schema/dokumente";
import { materialien } from "@/lib/db/schema/materials";
import type { DokumentKnoten } from "@/lib/workspace/types";

export async function ladeDokumentBaumFuerBenutzer(ownerId: string): Promise<DokumentKnoten[]> {
  const alle = await db
    .select()
    .from(dokumente)
    .where(eq(dokumente.ownerId, ownerId))
    .orderBy(asc(dokumente.sortierung), asc(dokumente.createdAt));

  return baueBaum(alle);
}

function baueBaum(zeilen: Dokument[]): DokumentKnoten[] {
  const nachId = new Map<string, DokumentKnoten & { _parent: string | null }>();
  for (const z of zeilen) {
    nachId.set(z.id, {
      id: z.id,
      titel: z.titel,
      typ: z.typ,
      icon: z.icon ?? undefined,
      inhalt: z.inhaltMarkdown ?? undefined,
      materialId: z.materialId ?? undefined,
      children: z.typ === "ordner" ? [] : undefined,
      _parent: z.parentId,
    });
  }

  const wurzeln: DokumentKnoten[] = [];
  for (const knoten of nachId.values()) {
    if (knoten._parent && nachId.has(knoten._parent)) {
      const eltern = nachId.get(knoten._parent)!;
      eltern.children = eltern.children ?? [];
      eltern.children.push(knoten);
    } else {
      wurzeln.push(knoten);
    }
  }

  // _parent vor der Auslieferung entfernen
  for (const knoten of nachId.values()) {
    delete (knoten as { _parent?: string | null })._parent;
  }
  return wurzeln;
}

interface ErstelleDokumentEingabe {
  ownerId: string;
  parentId: string | null;
  typ: "ordner" | "seite" | "pdf";
  titel: string;
  icon?: string | null;
  inhaltMarkdown?: string | null;
  materialId?: string | null;
}

export async function erstelleDokument(
  eingabe: ErstelleDokumentEingabe,
): Promise<Dokument | undefined> {
  if (eingabe.parentId && !(await gehoertDokumentZuOwner(eingabe.parentId, eingabe.ownerId))) {
    return undefined;
  }
  if (eingabe.materialId && !(await gehoertMaterialZuOwner(eingabe.materialId, eingabe.ownerId))) {
    return undefined;
  }
  const sortierung = await naechsteSortierung(eingabe.ownerId, eingabe.parentId);
  const [erstellt] = await db
    .insert(dokumente)
    .values({
      ownerId: eingabe.ownerId,
      parentId: eingabe.parentId,
      typ: eingabe.typ,
      titel: eingabe.titel,
      icon: eingabe.icon ?? null,
      inhaltMarkdown: eingabe.inhaltMarkdown ?? null,
      materialId: eingabe.materialId ?? null,
      sortierung,
    })
    .returning();
  return erstellt;
}

/** Prüft, ob ein Dokument dem angegebenen Owner gehört. */
async function gehoertDokumentZuOwner(id: string, ownerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: dokumente.id })
    .from(dokumente)
    .where(and(eq(dokumente.id, id), eq(dokumente.ownerId, ownerId)))
    .limit(1);
  return !!row;
}

/** Prüft, ob ein Material dem angegebenen Owner gehört. */
async function gehoertMaterialZuOwner(id: string, ownerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: materialien.id })
    .from(materialien)
    .where(and(eq(materialien.id, id), eq(materialien.ownerId, ownerId)))
    .limit(1);
  return !!row;
}

async function naechsteSortierung(ownerId: string, parentId: string | null): Promise<number> {
  const geschwister = await db
    .select({ sortierung: dokumente.sortierung })
    .from(dokumente)
    .where(
      and(
        eq(dokumente.ownerId, ownerId),
        parentId === null ? isNull(dokumente.parentId) : eq(dokumente.parentId, parentId),
      ),
    );
  const max = geschwister.reduce((acc, g) => Math.max(acc, g.sortierung), 0);
  return max + 1000;
}

interface AktualisiereDokumentEingabe {
  id: string;
  ownerId: string;
  titel?: string;
  icon?: string | null;
  inhaltMarkdown?: string | null;
  parentId?: string | null;
  sortierung?: number;
}

export async function aktualisiereDokument(
  eingabe: AktualisiereDokumentEingabe,
): Promise<Dokument | undefined> {
  if (eingabe.parentId !== undefined && eingabe.parentId !== null) {
    if (eingabe.parentId === eingabe.id) return undefined;
    if (!(await gehoertDokumentZuOwner(eingabe.parentId, eingabe.ownerId))) {
      return undefined;
    }
    const wuerdeZyklusErzeugen = await isDescendant({
      ownerId: eingabe.ownerId,
      ancestorId: eingabe.id,
      candidateId: eingabe.parentId,
    });
    if (wuerdeZyklusErzeugen) return undefined;
  }

  const aenderungen: Partial<typeof dokumente.$inferInsert> = {};
  if (eingabe.titel !== undefined) aenderungen.titel = eingabe.titel;
  if (eingabe.icon !== undefined) aenderungen.icon = eingabe.icon;
  if (eingabe.inhaltMarkdown !== undefined) aenderungen.inhaltMarkdown = eingabe.inhaltMarkdown;
  if (eingabe.parentId !== undefined) aenderungen.parentId = eingabe.parentId;
  if (eingabe.sortierung !== undefined) aenderungen.sortierung = eingabe.sortierung;
  aenderungen.updatedAt = new Date();

  const [aktualisiert] = await db
    .update(dokumente)
    .set(aenderungen)
    .where(and(eq(dokumente.id, eingabe.id), eq(dokumente.ownerId, eingabe.ownerId)))
    .returning();
  return aktualisiert;
}

/**
 * Returns true if `candidateId` is the same as `ancestorId` or any descendant of it.
 * Used to prevent moving a folder into its own subtree.
 */
async function isDescendant(args: {
  ownerId: string;
  ancestorId: string;
  candidateId: string;
}): Promise<boolean> {
  if (args.ancestorId === args.candidateId) return true;
  const all = await db
    .select({ id: dokumente.id, parentId: dokumente.parentId })
    .from(dokumente)
    .where(eq(dokumente.ownerId, args.ownerId));
  const childrenByParent = new Map<string, string[]>();
  for (const row of all) {
    if (!row.parentId) continue;
    const arr = childrenByParent.get(row.parentId) ?? [];
    arr.push(row.id);
    childrenByParent.set(row.parentId, arr);
  }
  const stack = [args.ancestorId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current === args.candidateId) return true;
    const kids = childrenByParent.get(current);
    if (kids) stack.push(...kids);
  }
  return false;
}

export async function loescheDokument(id: string, ownerId: string): Promise<boolean> {
  const ergebnis = await db
    .delete(dokumente)
    .where(and(eq(dokumente.id, id), eq(dokumente.ownerId, ownerId)))
    .returning({ id: dokumente.id });
  return ergebnis.length > 0;
}

interface MoveDocumentInput {
  id: string;
  ownerId: string;
  /** Target parent. `null` moves to the root. */
  parentId: string | null;
  /**
   * Zero-based position among the target parent's children, after removing the
   * moved node from its current siblings. If omitted, appended at the end.
   */
  position?: number;
}

/**
 * Moves a document to a new parent and/or position. Computes a new
 * `sortierung` value between the surrounding siblings so the visual order
 * matches `position`. Rejects moves that would create a cycle.
 */
export async function moveDocument(input: MoveDocumentInput): Promise<Dokument | undefined> {
  if (input.parentId !== null) {
    if (input.parentId === input.id) return undefined;
    if (!(await gehoertDokumentZuOwner(input.parentId, input.ownerId))) {
      return undefined;
    }
    const wouldCycle = await isDescendant({
      ownerId: input.ownerId,
      ancestorId: input.id,
      candidateId: input.parentId,
    });
    if (wouldCycle) return undefined;
  }

  const siblings = await db
    .select({ id: dokumente.id, sortierung: dokumente.sortierung })
    .from(dokumente)
    .where(
      and(
        eq(dokumente.ownerId, input.ownerId),
        input.parentId === null
          ? isNull(dokumente.parentId)
          : eq(dokumente.parentId, input.parentId),
      ),
    )
    .orderBy(asc(dokumente.sortierung));

  const filtered = siblings.filter((s) => s.id !== input.id);
  const targetIndex =
    input.position === undefined
      ? filtered.length
      : Math.max(0, Math.min(input.position, filtered.length));

  const before = targetIndex > 0 ? filtered[targetIndex - 1] : null;
  const after = targetIndex < filtered.length ? filtered[targetIndex] : null;

  let newSort: number;
  if (before && after) {
    newSort = (before.sortierung + after.sortierung) / 2;
  } else if (before) {
    newSort = before.sortierung + 1000;
  } else if (after) {
    newSort = after.sortierung - 1000;
  } else {
    newSort = 1000;
  }

  const [updated] = await db
    .update(dokumente)
    .set({ parentId: input.parentId, sortierung: newSort, updatedAt: new Date() })
    .where(and(eq(dokumente.id, input.id), eq(dokumente.ownerId, input.ownerId)))
    .returning();
  return updated;
}
