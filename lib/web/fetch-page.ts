/**
 * Hardened fetcher for arbitrary, user-supplied URLs.
 *
 * Used by:
 *  - `app/api/og/route.ts` for link-card preview metadata.
 *  - `lib/curriculum/document-content.ts` for inlining external page content
 *    into the LLM prompt when generating suggestions.
 *
 * Hardening:
 *  - Auth-gate is the caller's responsibility (this module is not exported
 *    to clients).
 *  - SSRF defense: rejects loopback/private/link-local/unique-local hosts
 *    by hostname (no DNS resolution; defense in depth, not authoritative).
 *  - Bounded: per-request timeout and per-response byte cap.
 *  - Allow-listed protocols (http/https) and content types (HTML).
 */
import { decodeHtmlEntities, escapeRegex } from "./html";

export interface FetchedPage {
  /** The final URL after redirects. */
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  /** Raw HTML, capped at the byte limit. */
  html: string;
}

export class WebFetchError extends Error {
  constructor(
    public readonly code:
      | "invalid_url"
      | "unsupported_protocol"
      | "blocked_host"
      | "fetch_failed"
      | "unsupported_content_type"
      | "fetch_error",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WebFetchError";
  }
}

export interface FetchPageOptions {
  /** Hard timeout for the HTTP request. Default 5 s. */
  timeoutMs?: number;
  /** Maximum response bytes read from the body. Default 512 KiB. */
  maxBytes?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** User-Agent to advertise. */
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_UA = "Mozilla/5.0 (compatible; MaterculaLinkPreview/1.0; +https://matercula.app)";

export async function fetchPage(rawUrl: string, opts: FetchPageOptions = {}): Promise<FetchedPage> {
  const target = parseAndValidateUrl(rawUrl);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let response: Response;
  try {
    response = await fetchImpl(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": opts.userAgent ?? DEFAULT_UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch_error";
    throw new WebFetchError("fetch_error", message);
  }

  if (!response.ok) {
    throw new WebFetchError("fetch_failed", `HTTP ${response.status}`, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
    throw new WebFetchError("unsupported_content_type", `content-type=${contentType || "unknown"}`);
  }

  const html = await readCapped(response, maxBytes);
  const finalUrl = (() => {
    try {
      return new URL(response.url || target.toString());
    } catch {
      return target;
    }
  })();
  return { html, ...parseHtmlMetadata(html, finalUrl) };
}

/**
 * Convert a fetched HTML document into a compact plaintext approximation
 * suitable for inclusion in an LLM prompt. Does NOT preserve structure.
 *
 * Strategy: drop `<script>`, `<style>`, `<noscript>`, `<svg>`, `<head>`
 * and HTML comments, then strip remaining tags and normalise whitespace.
 * Result is byte-capped; we do not run a DOM/Readability pipeline because
 * the cost-to-benefit (extra dependency, latency) does not justify it for
 * tagging purposes.
 */
export function htmlToPlainText(html: string, maxChars = 4000): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped);
  const collapsed = decoded
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+/gm, "")
    .trim();
  if (collapsed.length <= maxChars) return collapsed;
  return `${collapsed.slice(0, maxChars).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function parseAndValidateUrl(value: string): URL {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new WebFetchError("invalid_url", "URL konnte nicht geparst werden");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new WebFetchError("unsupported_protocol", target.protocol);
  }
  if (isPrivateHost(target.hostname)) {
    throw new WebFetchError("blocked_host", target.hostname);
  }
  return target;
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        chunks.push(value.subarray(0, value.byteLength - (received - maxBytes)));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(received > maxBytes ? maxBytes : received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

interface HtmlMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export function parseHtmlMetadata(html: string, baseUrl: URL): HtmlMetadata {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 64 * 1024);

  const meta = (property: string): string | null => {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRegex(property)}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = head.match(pattern);
      if (match?.[1]) return decodeHtmlEntities(match[1]);
    }
    return null;
  };

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const fallbackTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
  const fallbackDescriptionMatch = head.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
  );
  const fallbackDescription = fallbackDescriptionMatch
    ? decodeHtmlEntities(fallbackDescriptionMatch[1])
    : null;

  const ogImage = meta("og:image") ?? meta("twitter:image");
  const absoluteImage = ogImage ? toAbsoluteUrl(ogImage, baseUrl) : null;

  return {
    url: meta("og:url") ?? baseUrl.toString(),
    title: meta("og:title") ?? meta("twitter:title") ?? fallbackTitle,
    description: meta("og:description") ?? meta("twitter:description") ?? fallbackDescription,
    image: absoluteImage,
    siteName: meta("og:site_name"),
  };
}

function toAbsoluteUrl(value: string, base: URL): string | null {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

// Block obvious SSRF targets. Resolution-based blocking is intentionally
// out of scope – this is defense in depth, paired with caller-side auth.
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;

  // IPv6 loopback / link-local / unique local
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("fe80:") || host.startsWith("[fe80:")) return true;
  if (host.startsWith("fc") || host.startsWith("fd")) {
    if (/^\[?f[cd][0-9a-f]{2}:/i.test(host)) return true;
  }

  // IPv4
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map((n) => Number.parseInt(n, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  return false;
}
