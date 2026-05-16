/**
 * HTTP client for the matercula extractor service.
 *
 * The extractor lives at `services/extractor/` (Python + FastAPI). Never
 * extract documents inline in Node — the service boundary is intentional
 * (see CLAUDE.md → "Extractor service").
 *
 * The chunk shape below is the canonical contract the rest of the pipeline
 * (embeddings, LLM tagging) depends on. Do not rename fields.
 */
import { z } from "zod";

// Mirror of `SUPPORTED_MIMES` in services/extractor/app/extraction.py.
// Keep both lists in sync — see CLAUDE.md → "Extractor service".
const SUPPORTED_MIME_TYPES = new Set<string>([
  // PDF
  "application/pdf",
  // Word
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  // PowerPoint
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  // Excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  // OpenDocument
  "application/vnd.oasis.opendocument.text",
  // Plain / structured text
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "text/html",
  "application/xml",
  "text/xml",
  "text/x-rst",
  "text/x-org",
  // Email
  "message/rfc822",
  "application/vnd.ms-outlook",
  "application/pkcs7-signature",
  // E-Books
  "application/epub+zip",
  // Rich Text
  "application/rtf",
  "text/rtf",
  // Images (OCR)
  "image/png",
  "image/jpeg",
  "image/bmp",
  "image/tiff",
  "image/heic",
]);

// Field names mirror the Python extractor's canonical chunk shape (see
// CLAUDE.md → "Extractor service"). These names are part of the
// cross-language wire contract — keep them in sync with the Pydantic
// `ChunkOut` model in `services/extractor/app/main.py`.
export const extractionChunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1),
  pageNumber: z.number().int().positive().nullable(),
  section: z.string().nullable(),
});

export const extractionResultSchema = z.object({
  chunks: z.array(extractionChunkSchema),
  meta: z.object({
    pageCount: z.number().int().positive().nullable(),
    extractor: z.literal("unstructured"),
    mimeType: z.string(),
    // Heuristic content excerpt produced by the extractor (first chunks
    // joined and truncated). Surfaced in the UI as a quick preview for
    // formats the browser can't render natively.
    summary: z.string().nullable(),
  }),
});

export type ExtractionChunk = z.infer<typeof extractionChunkSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * Non-retryable: the file itself is the problem (corrupt, unsupported,
 * too large). Re-running the job will not change the outcome — mark the
 * material as `error`.
 */
export class ExtractionBadFileError extends Error {
  readonly retryable = false as const;
  readonly status: number;
  readonly detail?: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ExtractionBadFileError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Retryable: the service / network failed. pg-boss should retry per the
 * job's configured policy.
 */
export class ExtractionServiceError extends Error {
  readonly retryable = true as const;
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ExtractionServiceError";
    this.status = status;
  }
}

interface ExtractClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function getBaseUrl(opts: ExtractClientOptions): string {
  const url = opts.baseUrl ?? process.env.EXTRACTOR_URL;
  if (!url) throw new Error("EXTRACTOR_URL is not set");
  return url.replace(/\/+$/, "");
}

function getTimeoutMs(opts: ExtractClientOptions): number {
  if (typeof opts.timeoutMs === "number") return opts.timeoutMs;
  const env = process.env.EXTRACTOR_TIMEOUT_MS;
  const parsed = env ? Number.parseInt(env, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

export async function extractChunks(
  bytes: Buffer,
  mimeType: string,
  filename: string,
  opts: ExtractClientOptions = {},
): Promise<ExtractionResult> {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    // Bail out before the network round-trip — the service would 415 anyway.
    throw new ExtractionBadFileError(415, "unsupported_mime_type", mimeType);
  }

  const baseUrl = getBaseUrl(opts);
  const timeoutMs = getTimeoutMs(opts);
  const fetchImpl = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileBase64: bytes.toString("base64"),
        mimeType,
        filename,
      }),
      signal: controller.signal,
    });
  } catch (cause) {
    const message =
      cause instanceof Error && cause.name === "AbortError"
        ? `extractor request timed out after ${timeoutMs}ms`
        : `extractor request failed: ${(cause as Error).message}`;
    throw new ExtractionServiceError(message);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 200) {
    let raw: unknown;
    try {
      raw = await response.json();
    } catch (cause) {
      throw new ExtractionServiceError(
        `extractor returned non-JSON: ${(cause as Error).message}`,
        200,
      );
    }
    const parsed = extractionResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ExtractionServiceError(
        `extractor response failed schema validation: ${parsed.error.message}`,
        200,
      );
    }
    return parsed.data;
  }

  // Body is best-effort; the service returns {error, detail?} for handled cases.
  let body: { error?: string; detail?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    /* ignore */
  }

  if (response.status === 415 || response.status === 413 || response.status === 422) {
    throw new ExtractionBadFileError(
      response.status,
      body.error ?? `extractor_${response.status}`,
      body.detail,
    );
  }

  throw new ExtractionServiceError(
    body.error ?? `extractor_http_${response.status}`,
    response.status,
  );
}
