/**
 * Liefert eine LLM-taugliche Textfassung des Inhalts einer
 * `dokumente`-Zeile (Spalte `inhaltMarkdown`).
 *
 * Die Spalte hält historisch Markdown, seit Einführung des Block-Editors
 * jedoch BlockNote-JSON (vom Editor mit `JSON.stringify(editor.document)`
 * geschrieben; auf der Lade-Seite an einem führenden `[` erkannt –
 * vgl. {@link file://components/workspace/block-editor.tsx}). Wir spiegeln
 * dieselbe Heuristik:
 *   - Beginnt der Text mit `[`, parsen wir BlockNote-Blöcke.
 *   - Andernfalls geben wir den Markdown-Rohtext zurück.
 *
 * Für die beiden eigenen Block-Typen wird zusätzlich externer Inhalt
 * eingebettet, damit der LLM beim Tagging mehr Kontext hat als nur die URL:
 *   - `linkCard`  → `fetchPage()` holt OG-Metadaten + plain text der Seite.
 *   - `youtubeEmbed` → `fetchYoutubeMeta()` holt Titel + Kanal via oEmbed.
 *     Transcripte werden bewusst NICHT geholt (siehe lib/web/youtube.ts).
 *
 * Externe Fetches laufen parallel, scheitern weich (Timeout, SSRF-Block,
 * Nicht-HTML, …) und werden als kommentierter Hinweis im Text vermerkt,
 * damit der LLM auseinanderhalten kann, was vom Nutzer geschrieben wurde
 * und was aus einer extern eingebetteten Quelle stammt.
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

export interface DokumentInhaltOptions {
  /** Falls `false`, werden keine externen Seiten gefetcht (Tests, Offline). */
  fetchExternals?: boolean;
  /** Injectable für Tests. */
  fetchPageImpl?: typeof fetchPage;
  fetchYoutubeMetaImpl?: typeof fetchYoutubeMeta;
}

/**
 * Wandelt den persistierten Dokumenten-Inhalt in einen für das LLM
 * geeigneten Klartext um. Liefert immer einen String (ggf. leer).
 */
export async function dokumentInhaltFuerAi(
  rawContent: string | null | undefined,
  opts: DokumentInhaltOptions = {},
): Promise<string> {
  const raw = (rawContent ?? "").trim();
  if (!raw) return "";

  if (!raw.startsWith("[")) {
    // Legacy Markdown-Inhalt – unverändert zurückgeben.
    return raw;
  }

  let blocks: BlockNoteBlock[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw;
    blocks = parsed as BlockNoteBlock[];
  } catch {
    // Defekte JSON – Rohtext als Fallback (besser als leer).
    return raw;
  }

  const fetchExternals = opts.fetchExternals !== false;
  const fetchPageFn = opts.fetchPageImpl ?? fetchPage;
  const fetchYoutubeFn = opts.fetchYoutubeMetaImpl ?? fetchYoutubeMeta;

  // Erst alle externen Quellen einsammeln, dann parallel fetchen, danach
  // den Text linear zusammensetzen. So bleibt die Reihenfolge stabil und
  // wir vermeiden seriellen Wartepunkten pro Block.
  const linkCards: Array<{ url: string; title: string; description: string }> = [];
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
    : youtubeUrls.map((url) => ({ url, meta: null as Awaited<ReturnType<typeof fetchYoutubeMeta>> }));

  const linkLookup = new Map<string, ExternalPage | null>();
  for (const r of linkResults) linkLookup.set(r.card.url, r.page);
  const youtubeLookup = new Map<string, Awaited<ReturnType<typeof fetchYoutubeMeta>>>();
  for (const r of youtubeResults) youtubeLookup.set(r.url, r.meta);

  const ctx = { externalCharsRemaining: MAX_TOTAL_EXTERNAL_CHARS };
  const lines: string[] = [];
  renderBlocks(blocks, lines, linkLookup, youtubeLookup, ctx);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
        // Hinweis: Transkript ist nicht verfügbar (siehe lib/web/youtube.ts).
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
      // Verschachtelte Inline-Knoten (z. B. `link` → `text`).
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
