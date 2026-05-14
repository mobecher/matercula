import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import {
  generiereVorschlaegeFuerDokument,
  ladeVorschlaegeFuerDokument,
} from "@/lib/curriculum/vorschlaege";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const vorschlaege = await ladeVorschlaegeFuerDokument(parsed.data, user.id);
  if (vorschlaege === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ vorschlaege });
}

/**
 * Triggert eine neue LLM-Auswertung des Dokuments und ersetzt offene
 * Vorschläge. Antwortet mit der aktuellen Vorschlagsliste.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const ergebnis = await generiereVorschlaegeFuerDokument(parsed.data, user.id, {
    openaiApiKey: user.openaiApiKey,
    anthropicApiKey: user.anthropicApiKey,
    deepseekApiKey: user.deepseekApiKey,
  });
  if (ergebnis === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!ergebnis.ok) {
    return NextResponse.json(
      {
        error: ergebnis.grund ?? "ai_fehler",
        message: ergebnis.fehler,
        vorschlaege: ergebnis.vorschlaege,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ vorschlaege: ergebnis.vorschlaege });
}
