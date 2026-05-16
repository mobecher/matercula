/**
 * Produces an LLM-friendly plain-text rendering of a `documents` row
 * (column `contentMarkdown`).
 *
 * The column historically held Markdown, but since the block editor was
 * introduced it stores BlockNote JSON (written by the editor via
 * `JSON.stringify(editor.document)`; detected on load by a leading `[` —
 * see {@link file://components/workspace/block-editor.tsx}). We mirror the
 * same heuristic:
 *   - If the text starts with `[`, parse BlockNote blocks.
 *   - Otherwise return the raw Markdown unchanged.
 *
 * For our two custom block types we additionally inline external content
 * so the LLM has more context than just the URL when tagging:
 *   - `linkCard`     → `fetchPage()` fetches OG metadata + plain text.
 *   - `youtubeEmbed` → `fetchYoutubeMeta()` fetches title + channel via
 *     oEmbed. Transcripts are intentionally NOT fetched (see
 *     lib/web/youtube.ts).
 *
 * External fetches run in parallel, fail soft (timeout, SSRF block,
 * non-HTML, …), and are recorded as annotated hints in the rendered text
 * so the LLM can distinguish user-authored content from externally
 * embedded sources.
 */
import { fetchPage, htmlToPlainText, WebFetchError } from "@/lib/web/fetch-page";
import { fetchYoutubeMeta } from "@/lib/web/youtube";

interface BlockNoteBlock {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: BlockNoteInline[] | string;
  children?: BlockNoteBlock[];
}

interface BlockNoteInline {
  type?: string;
  text?: string;
  content?: BlockNoteInline[];
  href?: string;
}

const MAX_LINK_CARD_TEXT_CHARS = 1500;
const MAX_TOTAL_EXTERNAL_CHARS = 8000;

export interface DocumentContentOptions {
  /** When `false`, no external pages are fetched (tests, offline). */
  fetchExternals?: boolean;
  /** Injectable for tests. */
  fetchPageImpl?: typeof fetchPage;
  fetchYoutubeMetaImpl?: typeof fetchYoutubeMeta;
}

/**
 * Converts the persisted document content into LLM-friendly plain text.
 * Always returns a string (possibly empty).
 */
export async function documentContentForAi(
  rawContent: string | null | undefined,
  opts: DocumentContentOptions = {},
): Promise<string> {
  const raw = (rawContent ?? "").trim();
  if (!raw) return "";

  if (!raw.startsWith("[")) {
    // Legacy Markdown content — return unchanged.
    return raw;
  }

  let blocks: BlockNoteBlock[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw;
    blocks = parsed as BlockNoteBlock[];
  } catch {
    // Broken JSON — fall back to raw text (better than empty).
    return raw;
  }

  const fetchExternals = opts.fetchExternals !== false;
  const fetchPageFn = opts.fetchPageImpl ?? fetchPage;
  const fetchYoutubeFn = opts.fetchYoutubeMetaImpl ?? fetchYoutubeMeta;

  // Collect all external sources first, fetch them in parallel, then
  // assemble the text linearly. This keeps order stable and avoids a
  // serial wait point per block.
  const linkCards: Array<{ url: string; title: string; description: string }> =
    [];
  const youtubeUrls: string[] = [];
  collectExternals(blocks, linkCards, youtubeUrls);

  const linkResults = fetchExternals
    ? await Promise.all(
        linkCards.map(async (card) => ({
          card,
          page: await safeFetchPage(card.url, fetchPageFn),
        })),
      )
    : linkCards.map((card) => ({ card, page: null as ExternalPage | null }));

  const youtubeResults = fetchExternals
    ? await Promise.all(
        youtubeUrls.map(async (url) => ({
          url,
          meta: await safeFetchYoutube(url, fetchYoutubeFn),
        })),
      )
    : youtubeUrls.map((url) => ({
        url,
        meta: null as Awaited<ReturnType<typeof fetchYoutubeMeta>>,
      }));

  const linkLookup = new Map<string, ExternalPage | null>();
  for (const r of linkResults) linkLookup.set(r.card.url, r.page);
  const youtubeLookup = new Map<
    string,
    Awaited<ReturnType<typeof fetchYoutubeMeta>>
  >();
  for (const r of youtubeResults) youtubeLookup.set(r.url, r.meta);

  const ctx = { externalCharsRemaining: MAX_TOTAL_EXTERNAL_CHARS };
  const lines: string[] = [];
  renderBlocks(blocks, lines, linkLookup, youtubeLookup, ctx);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ExternalPage {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
}

async function safeFetchPage(
  url: string,
  fetchPageFn: typeof fetchPage,
): Promise<ExternalPage | null> {
  try {
    const page = await fetchPageFn(url);
    return {
      url: page.url,
      title: page.title,
      description: page.description,
      text: htmlToPlainText(page.html, MAX_LINK_CARD_TEXT_CHARS),
    };
  } catch (error) {
    if (error instanceof WebFetchError) return null;
    return null;
  }
}

async function safeFetchYoutube(
  url: string,
  fetchYoutubeFn: typeof fetchYoutubeMeta,
): Promise<Awaited<ReturnType<typeof fetchYoutubeMeta>>> {
  try {
    return await fetchYoutubeFn(url);
  } catch {
    return null;
  }
}

function collectExternals(
  blocks: BlockNoteBlock[],
  linkCards: Array<{ url: string; title: string; description: string }>,
  youtubeUrls: string[],
): void {
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "linkCard") {
      const url = stringProp(block.props, "url");
      if (url) {
        linkCards.push({
          url,
          title: stringProp(block.props, "title") ?? "",
          description: stringProp(block.props, "description") ?? "",
        });
      }
    } else if (block.type === "youtubeEmbed") {
      const url = stringProp(block.props, "url");
      if (url) youtubeUrls.push(url);
    }
    if (Array.isArray(block.children) && block.children.length > 0) {
      collectExternals(block.children, linkCards, youtubeUrls);
    }
  }
}

function renderBlocks(
  blocks: BlockNoteBlock[],
  lines: string[],
  linkLookup: Map<string, ExternalPage | null>,
  youtubeLookup: Map<string, Awaited<ReturnType<typeof fetchYoutubeMeta>>>,
  ctx: { externalCharsRemaining: number },
): void {
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    switch (block.type) {
      case "linkCard": {
        const url = stringProp(block.props, "url") ?? "";
        const cachedTitle = stringProp(block.props, "title") ?? "";
        const cachedDesc = stringProp(block.props, "description") ?? "";
        const fetched = linkLookup.get(url);
        const title = fetched?.title ?? cachedTitle;
        const description = fetched?.description ?? cachedDesc;
        const headline = title ? `${title} (${url})` : url;
        lines.push(`[Eingebetteter Link: ${headline}]`);
        if (description) lines.push(description);
        if (fetched?.text && ctx.externalCharsRemaining > 0) {
          const slice = fetched.text.slice(0, ctx.externalCharsRemaining);
          ctx.externalCharsRemaining -= slice.length;
          lines.push(slice);
        }
        lines.push("");
        break;
      }
      case "youtubeEmbed": {
        const url = stringProp(block.props, "url") ?? "";
        const meta = youtubeLookup.get(url);
        const title = meta?.title ?? "";
        const author = meta?.authorName ?? "";
        const headline =
          title && author
            ? `${title} – ${author} (${url})`
            : title
              ? `${title} (${url})`
              : url;
        lines.push(`[Eingebettetes YouTube-Video: ${headline}]`);
        // Note: transcript is not available (see lib/web/youtube.ts).
        lines.push("");
        break;
      }
      default: {
        const inlineText = renderInline(block.content);
        if (inlineText) lines.push(inlineText);
        if (Array.isArray(block.children) && block.children.length > 0) {
          renderBlocks(block.children, lines, linkLookup, youtubeLookup, ctx);
        }
        break;
      }
    }
  }
}

function renderInline(content: BlockNoteBlock["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const node of content) {
    if (!node || typeof node !== "object") continue;
    if (typeof node.text === "string" && node.text.length > 0) {
      parts.push(node.text);
    } else if (Array.isArray(node.content)) {
      // Nested inline nodes (e.g. `link` → `text`).
      const nested = renderInline(node.content);
      if (nested) parts.push(nested);
    }
  }
  return parts.join("").trim();
}

function stringProp(props: Record<string, unknown> | undefined, key: string): string | null {
  if (!props) return null;
  const value = props[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
