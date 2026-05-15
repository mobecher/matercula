import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";

export const runtime = "nodejs";

/**
 * Returns masked status info about the stored API keys. The plaintext is
 * never sent to the client.
 */
function mask(value: string | null | undefined): {
  present: boolean;
  preview: string | null;
} {
  if (!value) return { present: false, preview: null };
  const trimmed = value.trim();
  if (!trimmed) return { present: false, preview: null };
  const visible =
    trimmed.length <= 8 ? trimmed.slice(0, 2) : trimmed.slice(0, 4);
  return { present: true, preview: `${visible}…${trimmed.slice(-2)}` };
}

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    name: user.name,
    email: user.email,
    keys: {
      openai: mask(user.openaiApiKey),
      anthropic: mask(user.anthropicApiKey),
      deepseek: mask(user.deepseekApiKey),
    },
  });
}

/**
 * Updates the stored API keys.
 *
 * - Fields that are not sent are left unchanged.
 * - An empty string ('') deletes the respective key.
 * - A non-empty string sets a new key.
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

  const changes: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.openaiApiKey !== undefined) {
    changes.openaiApiKey = parsed.data.openaiApiKey.trim() || null;
  }
  if (parsed.data.anthropicApiKey !== undefined) {
    changes.anthropicApiKey = parsed.data.anthropicApiKey.trim() || null;
  }
  if (parsed.data.deepseekApiKey !== undefined) {
    changes.deepseekApiKey = parsed.data.deepseekApiKey.trim() || null;
  }

  const [updated] = await db
    .update(users)
    .set(changes)
    .where(eq(users.id, user.id))
    .returning();

  return NextResponse.json({
    name: updated.name,
    email: updated.email,
    keys: {
      openai: mask(updated.openaiApiKey),
      anthropic: mask(updated.anthropicApiKey),
      deepseek: mask(updated.deepseekApiKey),
    },
  });
}
