import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";

export const runtime = "nodejs";

/**
 * Liefert maskierte Status-Informationen zu den hinterlegten API-Schlüsseln.
 * Der Klartext wird nie an den Client gesendet.
 */
function maskiere(value: string | null | undefined): {
  vorhanden: boolean;
  vorschau: string | null;
} {
  if (!value) return { vorhanden: false, vorschau: null };
  const trimmed = value.trim();
  if (!trimmed) return { vorhanden: false, vorschau: null };
  const sichtbar = trimmed.length <= 8 ? trimmed.slice(0, 2) : trimmed.slice(0, 4);
  return { vorhanden: true, vorschau: `${sichtbar}…${trimmed.slice(-2)}` };
}

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    name: user.name,
    email: user.email,
    schluessel: {
      openai: maskiere(user.openaiApiKey),
      anthropic: maskiere(user.anthropicApiKey),
      deepseek: maskiere(user.deepseekApiKey),
    },
  });
}

/**
 * Aktualisiert die hinterlegten API-Schlüssel.
 *
 * - Felder, die nicht mitgesendet werden, bleiben unverändert.
 * - Ein leerer String ('') löscht den jeweiligen Schlüssel.
 * - Ein nicht-leerer String setzt einen neuen Schlüssel.
 */
const patchSchema = z.object({
  openaiApiKey: z.string().max(500).optional(),
  anthropicApiKey: z.string().max(500).optional(),
  deepseekApiKey: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const aenderungen: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.openaiApiKey !== undefined) {
    aenderungen.openaiApiKey = parsed.data.openaiApiKey.trim() || null;
  }
  if (parsed.data.anthropicApiKey !== undefined) {
    aenderungen.anthropicApiKey = parsed.data.anthropicApiKey.trim() || null;
  }
  if (parsed.data.deepseekApiKey !== undefined) {
    aenderungen.deepseekApiKey = parsed.data.deepseekApiKey.trim() || null;
  }

  const [aktualisiert] = await db
    .update(users)
    .set(aenderungen)
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json({
    name: aktualisiert.name,
    email: aktualisiert.email,
    schluessel: {
      openai: maskiere(aktualisiert.openaiApiKey),
      anthropic: maskiere(aktualisiert.anthropicApiKey),
      deepseek: maskiere(aktualisiert.deepseekApiKey),
    },
  });
}
