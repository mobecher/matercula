import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/request";
import {
  ladeDokumenteFuerAnwendungsbereich,
  ladeDokumenteFuerKompetenz,
} from "@/lib/curriculum/links";
import { ladeKompetenzbereichDetail } from "@/lib/curriculum/repository";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const detail = await ladeKompetenzbereichDetail(id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [kompDocs, appDocs] = await Promise.all([
    Promise.all(detail.kompetenzen.map((k) => ladeDokumenteFuerKompetenz(k.id, user.id))),
    Promise.all(
      detail.anwendungsbereiche.map((a) => ladeDokumenteFuerAnwendungsbereich(a.id, user.id)),
    ),
  ]);

  return NextResponse.json({
    lehrplan: detail.lehrplan,
    klasse: detail.klasse,
    bereich: detail.bereich,
    kompetenzen: detail.kompetenzen.map((k, i) => ({ ...k, dokumente: kompDocs[i] })),
    anwendungsbereiche: detail.anwendungsbereiche.map((a, i) => ({
      ...a,
      dokumente: appDocs[i],
    })),
  });
}
