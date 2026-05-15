import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { dokumentAssets } from "@/lib/db/schema";
import { getSignedUrl } from "@/lib/storage/s3";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Redirects to a short-lived S3 signed URL. The internal URL stored in
// the document content stays stable; access is gated by the user's session.
export async function GET(_request: Request, ctx: RouteContext) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const [asset] = await db
    .select()
    .from(dokumentAssets)
    .where(and(eq(dokumentAssets.id, id), eq(dokumentAssets.ownerId, user.id)))
    .limit(1);

  if (!asset) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = await getSignedUrl(asset.storageKey, 300);
  return NextResponse.redirect(url, 302);
}
