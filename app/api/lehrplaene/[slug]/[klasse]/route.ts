import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { loadKlasseOverview } from "@/lib/curriculum/repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; klasse: string }> },
) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug, klasse } = await params;
  const klasseNr = Number.parseInt(klasse, 10);
  if (!Number.isFinite(klasseNr)) {
    return NextResponse.json({ error: "invalid_klasse" }, { status: 400 });
  }
  const data = await loadKlasseOverview(slug, klasseNr);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}
