import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { loadMaterial, deleteMaterial } from "@/lib/materials/repository";
import { deleteFile } from "@/lib/storage/s3";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const material = await loadMaterial(id, user.id);
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
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const deleted = await deleteMaterial(id, user.id);
  if (!deleted)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Remove the S3 object. Don't escalate failures — the DB row is already gone.
  try {
    await deleteFile(deleted.storageKey);
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}
