import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { loadMaterial } from "@/lib/materials/repository";
import { getSignedUrl } from "@/lib/storage/s3";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Redirects to a short-lived signed S3 URL. This keeps the URL stored in
// the editor stable, while the direct access stays authenticated and
// time-limited.
export async function GET(_request: Request, ctx: RouteContext) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const material = await loadMaterial(id, user.id);
  if (!material) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = await getSignedUrl(material.storageKey, 300);
  return NextResponse.redirect(url, 302);
}
