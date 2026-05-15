/**
 * Tests for the extractor HTTP client.
 *
 * Uses node:test (stdlib) + tsx loader — see `pnpm test`.
 * The fetch implementation is injected, so no real network is touched.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  ExtractionBadFileError,
  ExtractionServiceError,
  extractChunks,
} from "../../lib/extraction/client";

const PDF = "application/pdf";

function makeFetch(impl: (req: Request) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
      init,
    );
    return Promise.resolve(impl(req));
  }) as typeof fetch;
}

const okBody = {
  chunks: [{ chunkIndex: 0, text: "hello", seitenzahl: 1, abschnitt: "Intro" }],
  meta: { pageCount: 1, extractor: "unstructured", mimeType: PDF },
};

describe("extractChunks", () => {
  it("returns parsed result on 200", async () => {
    const fetchImpl = makeFetch(
      () =>
        new Response(JSON.stringify(okBody), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await extractChunks(Buffer.from("x"), PDF, "f.pdf", {
      baseUrl: "http://test",
      fetchImpl,
    });
    assert.equal(result.chunks.length, 1);
    assert.equal(result.chunks[0].chunkIndex, 0);
    assert.equal(result.meta.extractor, "unstructured");
  });

  it("throws Zod validation error when shape is wrong", async () => {
    const bad = { chunks: [{ chunkIndex: "zero", text: "" }], meta: {} };
    const fetchImpl = makeFetch(
      () =>
        new Response(JSON.stringify(bad), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    await assert.rejects(
      () => extractChunks(Buffer.from("x"), PDF, "f.pdf", { baseUrl: "http://test", fetchImpl }),
      (err: unknown) =>
        err instanceof ExtractionServiceError && /schema validation/i.test((err as Error).message),
    );
  });

  it("maps 422 → ExtractionBadFileError (non-retryable)", async () => {
    const fetchImpl = makeFetch(
      () =>
        new Response(JSON.stringify({ error: "corrupt_file", detail: "bad pdf" }), {
          status: 422,
          headers: { "content-type": "application/json" },
        }),
    );
    await assert.rejects(
      () => extractChunks(Buffer.from("x"), PDF, "f.pdf", { baseUrl: "http://test", fetchImpl }),
      (err: unknown) => {
        if (!(err instanceof ExtractionBadFileError)) return false;
        assert.equal(err.retryable, false);
        assert.equal(err.status, 422);
        return true;
      },
    );
  });

  it("maps 415 → ExtractionBadFileError", async () => {
    const fetchImpl = makeFetch(
      () => new Response(JSON.stringify({ error: "unsupported_mime_type" }), { status: 415 }),
    );
    // Use a supported mime to bypass the client-side pre-check and reach
    // the network branch.
    await assert.rejects(
      () => extractChunks(Buffer.from("x"), PDF, "f.pdf", { baseUrl: "http://test", fetchImpl }),
      (err: unknown) =>
        err instanceof ExtractionBadFileError &&
        (err as ExtractionBadFileError).retryable === false,
    );
  });

  it("maps 5xx → ExtractionServiceError (retryable)", async () => {
    const fetchImpl = makeFetch(() => new Response("oops", { status: 503 }));
    await assert.rejects(
      () => extractChunks(Buffer.from("x"), PDF, "f.pdf", { baseUrl: "http://test", fetchImpl }),
      (err: unknown) => {
        if (!(err instanceof ExtractionServiceError)) return false;
        assert.equal(err.retryable, true);
        assert.equal(err.status, 503);
        return true;
      },
    );
  });

  it("maps network failure → ExtractionServiceError (retryable)", async () => {
    const fetchImpl = makeFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    await assert.rejects(
      () => extractChunks(Buffer.from("x"), PDF, "f.pdf", { baseUrl: "http://test", fetchImpl }),
      (err: unknown) =>
        err instanceof ExtractionServiceError && (err as ExtractionServiceError).retryable === true,
    );
  });

  it("rejects unsupported mime types before any network call", async () => {
    let called = false;
    const fetchImpl = makeFetch(() => {
      called = true;
      return new Response("", { status: 200 });
    });
    await assert.rejects(
      () =>
        extractChunks(Buffer.from("x"), "text/plain", "f.txt", {
          baseUrl: "http://test",
          fetchImpl,
        }),
      (err: unknown) =>
        err instanceof ExtractionBadFileError && (err as ExtractionBadFileError).status === 415,
    );
    assert.equal(called, false);
  });
});
