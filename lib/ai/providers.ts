import { anthropic } from "@ai-sdk/anthropic";
import { deepseek } from "@ai-sdk/deepseek";
import { openai } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

export type AiTask = "tagging" | "embedding" | "chat";

type ProviderName = "openai" | "anthropic" | "deepseek";

const providerFactories: Record<ProviderName, (model: string) => LanguageModel> = {
  openai: (model) => openai(model),
  anthropic: (model) => anthropic(model),
  deepseek: (model) => deepseek(model),
};

export const getLanguageModelForProvider = (
  provider: ProviderName,
  model: string,
): LanguageModel => {
  const factory = providerFactories[provider];
  if (!factory) {
    throw new Error(`Provider '${provider}' is not supported.`);
  }
  return factory(model);
};

const getTaskProvider = (task: AiTask) => {
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

export const getModel = (task: AiTask): LanguageModel | EmbeddingModel => {
  const provider = getTaskProvider(task);
  const model = getTaskModel(task);

  if (task === "embedding") {
    if (provider === "openai") {
      return openai.embedding(model);
    }

    throw new Error(`Embedding provider '${provider}' is not supported in this scaffold.`);
  }
  return getLanguageModelForProvider(provider, model);
};

export const getConfiguredProviders = () => {
  const candidates: ProviderName[] = ["openai", "anthropic", "deepseek"];

  return candidates.filter((provider) => {
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    return Boolean(process.env[envKey]);
  });
};
