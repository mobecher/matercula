import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { ladeMaterial, loescheMaterial } from "@/lib/materials/repository";
import { deleteFile } from "@/lib/storage/s3";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const material = await ladeMaterial(id, user.id);
  if (!material) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: material.id,
    titel: material.titel,
    dateiname: material.dateiname,
    mimeType: material.mimeType,
    status: material.status,
    createdAt: material.createdAt,
  });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const geloescht = await loescheMaterial(id, user.id);
  if (!geloescht) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // S3-Objekt entfernen. Fehler dabei nicht eskalieren – DB-Eintrag ist weg.
  try {
    await deleteFile(geloescht.storageKey);
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}
