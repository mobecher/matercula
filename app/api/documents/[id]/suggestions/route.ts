import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";
import {
  generateSuggestionsForDocument,
  loadSuggestionsForDocument,
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
  const suggestions = await loadSuggestionsForDocument(parsed.data, user.id);
  if (suggestions === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ suggestions });
}

/**
 * Triggers a new LLM evaluation of the document and replaces any open
 * suggestions. Responds with the current suggestion list.
 */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const result = await generateSuggestionsForDocument(parsed.data, user.id, {
    openaiApiKey: user.openaiApiKey,
    anthropicApiKey: user.anthropicApiKey,
    deepseekApiKey: user.deepseekApiKey,
  });
  if (result === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason ?? "ai_fehler",
        message: result.error,
        suggestions: result.suggestions,
      },
      { status: 422 },
    );
  }
  return NextResponse.json({ suggestions: result.suggestions });
}
