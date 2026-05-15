import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/request";

const querySchema = z.object({
  url: z.string().url().max(2048),
});

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // 512 KB is plenty for <head>

interface OgMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export async function GET(request: Request) {
  // Auth-gated to avoid turning the route into an open SSRF/proxy.
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ url: searchParams.get("url") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let target: URL;
  try {
    target = new URL(parsed.data.url);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported_protocol" }, { status: 400 });
  }

  if (isPrivateHost(target.hostname)) {
    return NextResponse.json({ error: "blocked_host" }, { status: 400 });
  }

  let html: string;
  try {
    const response = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Many servers gate OG tags behind a browser-ish UA.
        "User-Agent":
          "Mozilla/5.0 (compatible; MaterculaLinkPreview/1.0; +https://matercula.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: response.status },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
      return NextResponse.json(
        { error: "unsupported_content_type" },
        { status: 415 },
      );
    }

    html = await readCapped(response, MAX_BYTES);
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch_error";
    return NextResponse.json({ error: "fetch_error", message }, { status: 502 });
  }

  const metadata = parseOgMetadata(html, target);
  return NextResponse.json(metadata satisfies OgMetadata, {
    headers: {
      // Cache at the edge; client also caches via SWR-ish behavior.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
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

function parseOgMetadata(html: string, baseUrl: URL): OgMetadata {
  // Only parse the <head> section to keep regex work bounded.
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 64 * 1024);

  const meta = (property: string): string | null => {
    // Match both `property="og:foo"` and `name="og:foo"` / `name="twitter:foo"`,
    // in either attribute order.
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

  const fallbackDescription = (() => {
    const match = head.match(
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
    );
    return match ? decodeHtmlEntities(match[1]) : null;
  })();

  const ogImage = meta("og:image") ?? meta("twitter:image");
  const absoluteImage = ogImage ? toAbsoluteUrl(ogImage, baseUrl) : null;

  return {
    url: meta("og:url") ?? baseUrl.toString(),
    title: meta("og:title") ?? meta("twitter:title") ?? fallbackTitle,
    description:
      meta("og:description") ?? meta("twitter:description") ?? fallbackDescription,
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

// Block obvious SSRF targets. Resolution-based blocking is intentionally
// out of scope – this is a defense in depth on top of the auth gate.
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;

  // IPv6 loopback / link-local / unique local
  if (host === "::1" || host === "[::1]") return true;
  if (host.startsWith("fe80:") || host.startsWith("[fe80:")) return true;
  if (host.startsWith("fc") || host.startsWith("fd")) {
    // fc00::/7
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
