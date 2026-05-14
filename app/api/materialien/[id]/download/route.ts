import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { ladeMaterial } from "@/lib/materials/repository";
import { getSignedUrl } from "@/lib/storage/s3";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Leitet auf eine kurzlebige S3-Signed-URL um. So bleibt die im
// Editor gespeicherte URL stabil, während der Direktzugriff
// authentifiziert und zeitlich begrenzt erfolgt.
export async function GET(_request: Request, ctx: RouteContext) {
  const user = await getRequestUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const material = await ladeMaterial(id, user.id);
  if (!material)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = await getSignedUrl(material.storageKey, 300);
  return NextResponse.redirect(url, 302);
}
