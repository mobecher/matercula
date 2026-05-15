/**
 * `tagMaterial` job — pipeline entry for processing an uploaded material.
 *
 * Steps:
 *   1. Extraction: fetch bytes, call extractor service, write rows to
 *      `material_chunks` (without embeddings).
 *   2. Embeddings: embed each chunk via the configured embedding provider
 *      (OpenAI by default — see `lib/ai/providers.ts`) and update the row.
 *   3. LLM tagging (material ↔ Kompetenz links) — TODO.
 *
 * Status transitions:
 *   uploaded → processing → ready          (on success of all current steps)
 *   uploaded → processing → error          (non-retryable failure)
 *   uploaded → processing (stays)          (retryable; pg-boss retries)
 *
 * NOTE: status reaches `ready` once extraction + embeddings have run.
 * Step 3 (LLM tagging) is still TODO; once added it should gate `ready`
 * instead.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materialChunks, materialien } from "@/lib/db/schema/materials";
import {
  ExtractionBadFileError,
  ExtractionServiceError,
  extractChunks,
} from "@/lib/extraction/client";
import { defaultMaterialSource, type MaterialSource } from "@/lib/storage/material-source";
import { embedMaterialChunks, MissingEmbeddingKeyError } from "./embed-chunks";
import type { TagMaterialPayload } from "./queue";

interface TagMaterialDeps {
  source?: MaterialSource;
}

export async function handleTagMaterial(
  payload: TagMaterialPayload,
  deps: TagMaterialDeps = {},
): Promise<void> {
  const source = deps.source ?? defaultMaterialSource;

  const [material] = await db
    .select()
    .from(materialien)
    .where(eq(materialien.id, payload.materialId))
    .limit(1);

  if (!material) {
    // Genuinely missing — the upload route enqueues only after commit, so
    // this means the row was deleted. Don't retry.
    console.warn(`[tag-material] material ${payload.materialId} not found, dropping job`);
    return;
  }

  await db
    .update(materialien)
    .set({ status: "processing", statusReason: null, updatedAt: new Date() })
    .where(eq(materialien.id, material.id));

  // ---- Step 1: extraction ------------------------------------------------
  let extraction: Awaited<ReturnType<typeof extractChunks>>;
  try {
    const bytes = await source.fetchBytes(material);
    extraction = await extractChunks(bytes, material.mimeType, material.fileName);
  } catch (err) {
    if (err instanceof ExtractionBadFileError) {
      await db
        .update(materialien)
        .set({
          status: "error",
          statusReason: `extraction:${err.message}${err.detail ? `:${err.detail}` : ""}`.slice(
            0,
            500,
          ),
          updatedAt: new Date(),
        })
        .where(eq(materialien.id, material.id));
      // Swallow — non-retryable. pg-boss will mark the job as completed.
      return;
    }
    if (err instanceof ExtractionServiceError) {
      // Re-throw so pg-boss retries per its policy.
      throw err;
    }
    // Unknown error: treat as retryable.
    throw err;
  }

  // Replace any prior chunk rows for this material (idempotent on retry).
  await db.delete(materialChunks).where(eq(materialChunks.materialId, material.id));
  if (extraction.chunks.length > 0) {
    await db.insert(materialChunks).values(
      extraction.chunks.map((c) => ({
        materialId: material.id,
        chunkIndex: c.chunkIndex,
        text: c.text,
        // Wire contract uses German field names (mirrored from Python);
        // the DB columns are English.
        pageNumber: c.seitenzahl,
        section: c.abschnitt,
      })),
    );
  }

  // Persist the heuristic content excerpt for the file-preview panel.
  // Cap defensively in case the extractor ever returns more than expected.
  await db
    .update(materialien)
    .set({
      summary: extraction.meta.summary?.slice(0, 2000) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(materialien.id, material.id));

  // ---- Step 2: embeddings ------------------------------------------------
  try {
    await embedMaterialChunks(material.id, material.ownerId);
  } catch (err) {
    if (err instanceof MissingEmbeddingKeyError) {
      await db
        .update(materialien)
        .set({
          status: "error",
          statusReason: `embedding:${err.message}`.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(materialien.id, material.id));
      return;
    }
    // Provider/network errors: retryable.
    throw err;
  }

  // TODO: step 3 — LLM tagging (link chunks to Kompetenzen via
  // `material_kompetenz_links`). Until that exists, `ready` here means
  // "extracted + embedded; ready for semantic search".
  await db
    .update(materialien)
    .set({ status: "ready", statusReason: null, updatedAt: new Date() })
    .where(eq(materialien.id, material.id));
}
