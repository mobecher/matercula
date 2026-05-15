import { and, asc, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { materialChunks, materialien } from "@/lib/db/schema/materials";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

const PREVIEW_CHUNKS = 5;

/**
 * Returns an overview of the material and the state of extraction:
 * status, number of chunks/pages, total length plus a small preview of
 * the first chunks for the UI ("content overview").
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const [mat] = await db
    .select({
      id: materialien.id,
      title: materialien.title,
      fileName: materialien.fileName,
      mimeType: materialien.mimeType,
      status: materialien.status,
      statusReason: materialien.statusReason,
      summary: materialien.summary,
      createdAt: materialien.createdAt,
      updatedAt: materialien.updatedAt,
    })
    .from(materialien)
    .where(
      and(eq(materialien.id, parsed.data), eq(materialien.ownerId, user.id)),
    )
    .limit(1);
  if (!mat) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Aggregate: number of chunks.
  const [agg] = await db
    .select({
      chunkCount: count(),
    })
    .from(materialChunks)
    .where(eq(materialChunks.materialId, mat.id));

  // Distinct pages and total characters separately — cheaper than a window
  // function.
  const pagesAndLengths = await db
    .select({
      pageNumber: materialChunks.pageNumber,
      length: materialChunks.text,
    })
    .from(materialChunks)
    .where(eq(materialChunks.materialId, mat.id));
  const pageSet = new Set<number>();
  let totalChars = 0;
  for (const row of pagesAndLengths) {
    if (row.pageNumber != null) pageSet.add(row.pageNumber);
    totalChars += row.length.length;
  }

  const previewRows = await db
    .select({
      chunkIndex: materialChunks.chunkIndex,
      text: materialChunks.text,
      pageNumber: materialChunks.pageNumber,
      section: materialChunks.section,
    })
    .from(materialChunks)
    .where(eq(materialChunks.materialId, mat.id))
    .orderBy(asc(materialChunks.chunkIndex))
    .limit(PREVIEW_CHUNKS);

  return NextResponse.json({
    id: mat.id,
    title: mat.title,
    fileName: mat.fileName,
    mimeType: mat.mimeType,
    status: mat.status,
    statusReason: mat.statusReason,
    summary: mat.summary,
    createdAt: mat.createdAt,
    updatedAt: mat.updatedAt,
    chunkCount: agg?.chunkCount ?? 0,
    pageCount: pageSet.size,
    totalChars,
    preview: previewRows.map((r) => ({
      chunkIndex: r.chunkIndex,
      pageNumber: r.pageNumber,
      section: r.section,
      // 320-character snippet is enough for the list view.
      text: r.text.length > 320 ? `${r.text.slice(0, 320).trimEnd()}…` : r.text,
    })),
  });
}
