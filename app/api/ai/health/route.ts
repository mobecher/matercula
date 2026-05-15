import { generateText } from "ai";
import { z } from "zod";
import {
  type UserAiKeys,
  getConfiguredProvidersForUser,
  getLanguageModelForProvider,
} from "@/lib/ai";
import { getRequestUser } from "@/lib/auth/request";

export const runtime = "nodejs";

const healthSchema = z.object({
  ok: z.boolean(),
  configuredProviders: z.array(z.string()),
  checkedProviders: z.array(z.string()),
  errors: z.array(
    z.object({
      provider: z.string(),
      message: z.string(),
    }),
  ),
});

export async function GET() {
  const user = await getRequestUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const schluessel: UserAiKeys = {
    openaiApiKey: user.openaiApiKey,
    anthropicApiKey: user.anthropicApiKey,
    deepseekApiKey: user.deepseekApiKey,
  };
  const configuredProviders = getConfiguredProvidersForUser(schluessel);

  if (configuredProviders.length === 0) {
    return Response.json(
      healthSchema.parse({
        ok: false,
        configuredProviders: [],
        checkedProviders: [],
        errors: [
          {
            provider: "none",
            message: "Kein API-Schlüssel hinterlegt. In den Einstellungen ergänzen.",
          },
        ],
      }),
      { status: 503 },
    );
  }

  const errors: Array<{ provider: string; message: string }> = [];
  const checkedProviders: string[] = [];

  await Promise.all(
    configuredProviders.map(async (provider) => {
      try {
        const modelName = process.env.AI_CHAT_MODEL ?? "gpt-4o-mini";
        const model = getLanguageModelForProvider(provider, modelName, schluessel);
        await generateText({
          model,
          maxOutputTokens: 1,
          prompt: "ok",
        });
        checkedProviders.push(provider);
      } catch (error) {
        errors.push({
          provider,
          message: error instanceof Error ? error.message : "Unknown AI provider error",
        });
      }
    }),
  );

  const ok = checkedProviders.length > 0;
  const payload = healthSchema.parse({
    ok,
    configuredProviders,
    checkedProviders,
    errors,
  });

  return Response.json(payload, { status: ok ? 200 : 503 });
}
