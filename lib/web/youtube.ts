/**
 * Lightweight YouTube metadata via the public oEmbed endpoint.
 *
 * We deliberately do NOT fetch transcripts/captions: there is no stable
 * anonymous API for them, the unofficial timedtext endpoint is unreliable
 * and against YouTube's ToS, and the official Data API requires OAuth +
 * caption-scoped permissions per video. So for AI tagging purposes we
 * inline only the title + author from oEmbed; downstream consumers should
 * note that the actual video content is not available to the LLM.
 */

export interface YoutubeMetadata {
  videoId: string;
  url: string;
  title: string | null;
  authorName: string | null;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Mirror of the parser in `components/workspace/blocks/youtube-embed-block.tsx`,
 * kept in sync. Recognises the same URL shapes the editor accepts.
 */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return ID_PATTERN.test(id) ? id : null;
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      return v && ID_PATTERN.test(v) ? v : null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const [prefix, id] = segments;
      if (
        (prefix === "embed" || prefix === "shorts" || prefix === "live" || prefix === "v") &&
        ID_PATTERN.test(id)
      ) {
        return id;
      }
    }
  }
  return null;
}

interface FetchYoutubeMetaOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const OEMBED_TIMEOUT_MS = 4000;

/**
 * Fetch the title + author of a YouTube video via the public oEmbed
 * endpoint. Returns `null` when the URL is not a recognisable YouTube link
 * or the lookup fails — callers should treat oEmbed as best-effort.
 */
export async function fetchYoutubeMeta(
  rawUrl: string,
  opts: FetchYoutubeMetaOptions = {},
): Promise<YoutubeMetadata | null> {
  const id = parseYouTubeId(rawUrl);
  if (!id) return null;
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(oembed, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? OEMBED_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { videoId: id, url: watchUrl, title: null, authorName: null };
    }
    const body = (await response.json()) as {
      title?: unknown;
      author_name?: unknown;
    };
    return {
      videoId: id,
      url: watchUrl,
      title: typeof body.title === "string" ? body.title : null,
      authorName: typeof body.author_name === "string" ? body.author_name : null,
    };
  } catch {
    return { videoId: id, url: watchUrl, title: null, authorName: null };
  }
}
