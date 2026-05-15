import { type AnthropicProvider, createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek, type DeepSeekProvider } from "@ai-sdk/deepseek";
import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

export type AiTask = "tagging" | "embedding" | "chat";

export type ProviderName = "openai" | "anthropic" | "deepseek";

/**
 * Pro-Benutzer hinterlegte API-Schlüssel (siehe `users`-Tabelle).
 * Felder sind optional, weil Benutzer nur einen Teil der Provider
 * konfigurieren können.
 */
export interface UserAiKeys {
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  deepseekApiKey?: string | null;
}

const getApiKeyForProvider = (
  schluessel: UserAiKeys | undefined,
  provider: ProviderName,
): string | null => {
  switch (provider) {
    case "openai":
      return schluessel?.openaiApiKey?.trim() || null;
    case "anthropic":
      return schluessel?.anthropicApiKey?.trim() || null;
    case "deepseek":
      return schluessel?.deepseekApiKey?.trim() || null;
  }
};

export class MissingProviderKey extends Error {
  constructor(public readonly provider: ProviderName) {
    super(
      `Für den Provider '${provider}' ist kein API-Schlüssel hinterlegt. Bitte in den Einstellungen ergänzen.`,
    );
    this.name = "FehlenderProviderSchluessel";
  }
}

const getProviderClient = (
  provider: ProviderName,
  apiKey: string,
): OpenAIProvider | AnthropicProvider | DeepSeekProvider => {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey });
    case "anthropic":
      return createAnthropic({ apiKey });
    case "deepseek":
      return createDeepSeek({ apiKey });
  }
};

export const getLanguageModelForProvider = (
  provider: ProviderName,
  model: string,
  schluessel?: UserAiKeys,
): LanguageModel => {
  const apiKey = getApiKeyForProvider(schluessel, provider);
  if (!apiKey) throw new MissingProviderKey(provider);
  return getProviderClient(provider, apiKey)(model);
};

const getTaskProvider = (task: AiTask): ProviderName => {
  const provider = process.env[`AI_${task.toUpperCase()}_PROVIDER`] ?? "openai";
  return provider.toLowerCase() as ProviderName;
};

const getTaskModel = (task: AiTask) => {
  const fallback =
    task === "embedding"
      ? "text-embedding-3-small"
      : task === "chat"
        ? "gpt-4o-mini"
        : "gpt-4o-mini";
  return process.env[`AI_${task.toUpperCase()}_MODEL`] ?? fallback;
};

/**
 * Returns a configured model for the desired task.
 *
 * `keys` contains the per-user stored API keys; without a matching key the
 * function throws `MissingProviderKey`.
 */
export const getModel = (
  task: AiTask,
  schluessel?: UserAiKeys,
): LanguageModel | EmbeddingModel<string> => {
  const provider = getTaskProvider(task);
  const model = getTaskModel(task);

  if (task === "embedding") {
    if (provider !== "openai") {
      throw new Error(
        `Embedding provider '${provider}' is not supported in this scaffold.`,
      );
    }
    const apiKey = getApiKeyForProvider(schluessel, "openai");
    if (!apiKey) throw new MissingProviderKey("openai");
    return createOpenAI({ apiKey }).embedding(model);
  }
  return getLanguageModelForProvider(provider, model, schluessel);
};

/**
 * Liefert die Liste der Provider, für die der Benutzer einen Schlüssel
 * hinterlegt hat.
 */
export const getConfiguredProvidersForUser = (
  schluessel: UserAiKeys | undefined,
): ProviderName[] => {
  return (["openai", "anthropic", "deepseek"] as const).filter((p) =>
    Boolean(getApiKeyForProvider(schluessel, p)),
  );
};
