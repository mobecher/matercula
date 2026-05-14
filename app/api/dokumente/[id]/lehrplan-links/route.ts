import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { ladeLehrplanLinksFuerDokument } from "@/lib/curriculum/links";

const idSchema = z.string().uuid();

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const links = await ladeLehrplanLinksFuerDokument(parsed.data, user.id);
  if (!links) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(links);
}
