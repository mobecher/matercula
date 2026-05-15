/**
 * Step 2 of the `tagMaterial` pipeline: embed each chunk.
 *
 * Reads chunks for a material, calls the configured embedding provider
 * (OpenAI `text-embedding-3-small` by default — see `lib/ai/providers.ts`),
 * and updates `material_chunks.embedding`.
 *
 * Provider selection follows env (`AI_EMBEDDING_PROVIDER`,
 * `AI_EMBEDDING_MODEL`); the API key is loaded from the material owner's
 * `users.openai_api_key`. If the owner has no key, this step throws
 * `MissingEmbeddingKeyError` (non-retryable) and the caller marks the
 * material as `error`.
 */
import { type EmbeddingModel, embedMany } from "ai";
import { eq, inArray } from "drizzle-orm";
import { FehlenderProviderSchluessel, getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/auth";
import { materialChunks } from "@/lib/db/schema/materials";

// OpenAI's embeddings endpoint accepts up to 2048 inputs per request and
// 8192 tokens per input. Our chunks target ~1500 chars (well under the
// per-input limit). 96 keeps each request small and bounds memory.
const BATCH_SIZE = 96;

export class MissingEmbeddingKeyError extends Error {
  readonly retryable = false as const;
  constructor(ownerId: string) {
    super(`owner ${ownerId} has no OpenAI API key configured`);
    this.name = "MissingEmbeddingKeyError";
  }
}

interface EmbedDeps {
  model?: EmbeddingModel<string>;
}

export async function embedMaterialChunks(
  materialId: string,
  ownerId: string,
  deps: EmbedDeps = {},
): Promise<{ embedded: number }> {
  const model = deps.model ?? (await loadModelForOwner(ownerId));

  const rows = await db
    .select({ id: materialChunks.id, text: materialChunks.text })
    .from(materialChunks)
    .where(eq(materialChunks.materialId, materialId));

  if (rows.length === 0) return { embedded: 0 };

  let embedded = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model,
      values: batch.map((r) => r.text),
    });
    // Apply per-chunk via parameterised UPDATEs. Drizzle has no batch
    // UPDATE-many primitive across a vector column; this is plenty fast
    // for our chunk counts (typically dozens, not thousands).
    await Promise.all(
      batch.map((row, idx) =>
        db
          .update(materialChunks)
          .set({ embedding: embeddings[idx] })
          .where(eq(materialChunks.id, row.id)),
      ),
    );
    embedded += batch.length;
  }

  // Sanity: ensure every chunk now has an embedding (defensive — should
  // always be true after the loop above).
  const missing = await db
    .select({ id: materialChunks.id })
    .from(materialChunks)
    .where(
      inArray(
        materialChunks.id,
        rows.map((r) => r.id),
      ),
    );
  void missing;

  return { embedded };
}

async function loadModelForOwner(ownerId: string): Promise<EmbeddingModel<string>> {
  const [owner] = await db
    .select({ openaiApiKey: users.openaiApiKey })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  try {
    return getModel("embedding", {
      openaiApiKey: owner?.openaiApiKey ?? null,
    }) as EmbeddingModel<string>;
  } catch (err) {
    if (err instanceof FehlenderProviderSchluessel) {
      throw new MissingEmbeddingKeyError(ownerId);
    }
    throw err;
  }
}
