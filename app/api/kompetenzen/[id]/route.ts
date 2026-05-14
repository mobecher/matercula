import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import { ladeDokumenteFuerKompetenz } from "@/lib/curriculum/links";
import { ladeKompetenzDetail } from "@/lib/curriculum/repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const detail = await ladeKompetenzDetail(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const dokumente = await ladeDokumenteFuerKompetenz(id, user.id);
  return NextResponse.json({
    lehrplan: detail.lehrplan,
    klasse: detail.klasse,
    bereich: detail.bereich,
    kompetenz: detail.kompetenz,
    dokumente,
  });
}
