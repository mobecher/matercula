import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { type Document, documents } from "@/lib/db/schema/documents";
import { materialien } from "@/lib/db/schema/materials";
import type { DocumentNode } from "@/lib/workspace/types";

export async function loadDocumentTreeForUser(
  ownerId: string,
): Promise<DocumentNode[]> {
  const alle = await db
    .select()
    .from(documents)
    .where(eq(documents.ownerId, ownerId))
    .orderBy(asc(documents.sortOrder), asc(documents.createdAt));

  return buildTree(alle);
}

function buildTree(zeilen: Document[]): DocumentNode[] {
  const nachId = new Map<string, DocumentNode & { _parent: string | null }>();
  for (const z of zeilen) {
    nachId.set(z.id, {
      id: z.id,
      title: z.title,
      type: z.type,
      icon: z.icon ?? undefined,
      inhalt: z.contentMarkdown ?? undefined,
      materialId: z.materialId ?? undefined,
      children: z.type === "folder" ? [] : undefined,
      _parent: z.parentId,
    });
  }

  const wurzeln: DocumentNode[] = [];
  for (const knoten of nachId.values()) {
    if (knoten._parent && nachId.has(knoten._parent)) {
      const eltern = nachId.get(knoten._parent);
      if (!eltern) {
        wurzeln.push(knoten);
        continue;
      }
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

interface CreateDocumentInput {
  ownerId: string;
  parentId: string | null;
  type: "folder" | "page" | "file";
  title: string;
  icon?: string | null;
  contentMarkdown?: string | null;
  materialId?: string | null;
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<Document | undefined> {
  if (
    input.parentId &&
    !(await documentBelongsToOwner(input.parentId, input.ownerId))
  ) {
    return undefined;
  }
  if (
    input.materialId &&
    !(await gehoertMaterialZuOwner(input.materialId, input.ownerId))
  ) {
    return undefined;
  }
  const sortOrder = await naechsteSortierung(input.ownerId, input.parentId);
  const [erstellt] = await db
    .insert(documents)
    .values({
      ownerId: input.ownerId,
      parentId: input.parentId,
      type: input.type,
      title: input.title,
      icon: input.icon ?? null,
      contentMarkdown: input.contentMarkdown ?? null,
      materialId: input.materialId ?? null,
      sortOrder,
    })
    .returning();
  return erstellt;
}

/** Prüft, ob ein Document dem angegebenen Owner gehört. */
async function documentBelongsToOwner(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
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
    .select({ sortOrder: documents.sortOrder })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, ownerId),
        parentId === null ? isNull(documents.parentId) : eq(documents.parentId, parentId),
      ),
    );
  const max = geschwister.reduce((acc, g) => Math.max(acc, g.sortOrder), 0);
  return max + 1000;
}

interface UpdateDocumentInput {
  id: string;
  ownerId: string;
  title?: string;
  icon?: string | null;
  contentMarkdown?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export async function updateDocument(
  input: UpdateDocumentInput,
): Promise<Document | undefined> {
  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === input.id) return undefined;
    if (!(await documentBelongsToOwner(input.parentId, input.ownerId))) {
      return undefined;
    }
    const wuerdeZyklusErzeugen = await isDescendant({
      ownerId: input.ownerId,
      ancestorId: input.id,
      candidateId: input.parentId,
    });
    if (wuerdeZyklusErzeugen) return undefined;
  }

  const aenderungen: Partial<typeof documents.$inferInsert> = {};
  if (input.title !== undefined) aenderungen.title = input.title;
  if (input.icon !== undefined) aenderungen.icon = input.icon;
  if (input.contentMarkdown !== undefined)
    aenderungen.contentMarkdown = input.contentMarkdown;
  if (input.parentId !== undefined) aenderungen.parentId = input.parentId;
  if (input.sortOrder !== undefined) aenderungen.sortOrder = input.sortOrder;
  aenderungen.updatedAt = new Date();

  const [aktualisiert] = await db
    .update(documents)
    .set(aenderungen)
    .where(
      and(eq(documents.id, input.id), eq(documents.ownerId, input.ownerId)),
    )
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
    .select({ id: documents.id, parentId: documents.parentId })
    .from(documents)
    .where(eq(documents.ownerId, args.ownerId));
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
    const current = stack.pop();
    if (!current) break;
    if (seen.has(current)) continue;
    seen.add(current);
    if (current === args.candidateId) return true;
    const kids = childrenByParent.get(current);
    if (kids) stack.push(...kids);
  }
  return false;
}

export async function deleteDocument(
  id: string,
  ownerId: string,
): Promise<boolean> {
  const ergebnis = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
    .returning({ id: documents.id });
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
 * `sortOrder` value between the surrounding siblings so the visual order
 * matches `position`. Rejects moves that would create a cycle.
 */
export async function moveDocument(input: MoveDocumentInput): Promise<Document | undefined> {
  if (input.parentId !== null) {
    if (input.parentId === input.id) return undefined;
    if (!(await documentBelongsToOwner(input.parentId, input.ownerId))) {
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
    .select({ id: documents.id, sortOrder: documents.sortOrder })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, input.ownerId),
        input.parentId === null
          ? isNull(documents.parentId)
          : eq(documents.parentId, input.parentId),
      ),
    )
    .orderBy(asc(documents.sortOrder));

  const filtered = siblings.filter((s) => s.id !== input.id);
  const targetIndex =
    input.position === undefined
      ? filtered.length
      : Math.max(0, Math.min(input.position, filtered.length));

  const before = targetIndex > 0 ? filtered[targetIndex - 1] : null;
  const after = targetIndex < filtered.length ? filtered[targetIndex] : null;

  let newSort: number;
  if (before && after) {
    newSort = (before.sortOrder + after.sortOrder) / 2;
  } else if (before) {
    newSort = before.sortOrder + 1000;
  } else if (after) {
    newSort = after.sortOrder - 1000;
  } else {
    newSort = 1000;
  }

  const [updated] = await db
    .update(documents)
    .set({ parentId: input.parentId, sortOrder: newSort, updatedAt: new Date() })
    .where(and(eq(documents.id, input.id), eq(documents.ownerId, input.ownerId)))
    .returning();
  return updated;
}
