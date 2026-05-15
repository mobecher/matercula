import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";

interface OgMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

async function fetchOgMetadata(url: string): Promise<OgMetadata | null> {
  try {
    const response = await fetch(`/api/og?url=${encodeURIComponent(url)}`, {
      method: "GET",
    });
    if (!response.ok) return null;
    return (await response.json()) as OgMetadata;
  } catch {
    return null;
  }
}

/**
 * Link card – medium-sized embedding tier. Renders the URL as a clickable
 * card with title, optional description, preview image and the site's
 * favicon. When the URL is committed, Open Graph metadata
 * (`og:title` / `og:description` / `og:image` / `og:site_name`) is fetched
 * via `/api/og` and used to auto-fill empty fields. Title falls back to the
 * hostname when no metadata is available.
 */
export const linkCardBlockSpec = createReactBlockSpec(
  {
    type: "linkCard",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      url: { default: "" as string },
      title: { default: "" as string },
      description: { default: "" as string },
      image: { default: "" as string },
      siteName: { default: "" as string },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { url, title, description, image, siteName } = props.block.props;
      const [isEditing, setIsEditing] = useState(!url);
      const [isFetching, setIsFetching] = useState(false);
      const [draftUrl, setDraftUrl] = useState(url);
      const [draftTitle, setDraftTitle] = useState(title);
      const [draftDescription, setDraftDescription] = useState(description);

      const commit = async () => {
        const trimmed = draftUrl.trim();
        if (!trimmed) return;
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

        // Fetch Open Graph metadata. Manual user input always wins over
        // remote values – we only fill fields the user left empty.
        setIsFetching(true);
        const metadata = await fetchOgMetadata(normalized);
        setIsFetching(false);

        const trimmedTitle = draftTitle.trim();
        const trimmedDescription = draftDescription.trim();

        props.editor.updateBlock(props.block, {
          type: "linkCard",
          props: {
            url: normalized,
            title: trimmedTitle || metadata?.title || "",
            description: trimmedDescription || metadata?.description || "",
            image: metadata?.image ?? "",
            siteName: metadata?.siteName ?? "",
          },
        });
        setIsEditing(false);
      };

      const refreshMetadata = async () => {
        if (!url) return;
        setIsFetching(true);
        const metadata = await fetchOgMetadata(url);
        setIsFetching(false);
        if (!metadata) return;
        props.editor.updateBlock(props.block, {
          type: "linkCard",
          props: {
            url,
            title: metadata.title ?? title,
            description: metadata.description ?? description,
            image: metadata.image ?? "",
            siteName: metadata.siteName ?? "",
          },
        });
      };

      if (isEditing) {
        return (
          <div
            className="my-2 flex w-full flex-col gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3"
            contentEditable={false}
          >
            <input
              type="url"
              // biome-ignore lint/a11y/noAutofocus: focus on entering edit mode is the expected UX
              autoFocus
              placeholder="https://example.com"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                }
              }}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Titel (optional – wird sonst aus Open Graph gelesen)"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Beschreibung (optional – wird sonst aus Open Graph gelesen)"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void commit();
                }}
                disabled={!draftUrl.trim() || isFetching}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {isFetching ? "Lade Vorschau …" : "Übernehmen"}
              </button>
            </div>
          </div>
        );
      }

      let host = "";
      let favicon = "";
      try {
        const parsed = new URL(url);
        host = parsed.host;
        favicon = `https://www.google.com/s2/favicons?domain=${parsed.host}&sz=32`;
      } catch {
        host = url;
      }

      return (
        <div className="my-2 w-full" contentEditable={false}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onDoubleClick={(e) => {
              e.preventDefault();
              setIsEditing(true);
            }}
            className="group flex w-full overflow-hidden rounded-md border border-gray-200 bg-white no-underline shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          >
            {image ? (
              // biome-ignore lint/performance/noImgElement: external preview image
              <img
                src={image}
                alt=""
                className="h-24 w-32 shrink-0 object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
            <div className="flex min-w-0 flex-1 items-start gap-3 p-3">
              {favicon ? (
                // biome-ignore lint/performance/noImgElement: external favicon
                <img src={favicon} alt="" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">
                  {title || host || url}
                </div>
                {description ? (
                  <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">{description}</div>
                ) : null}
                <div className="mt-1 truncate text-xs text-gray-500">
                  {siteName ? `${siteName} · ${host}` : host}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void refreshMetadata();
                  }}
                  disabled={isFetching}
                  className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  {isFetching ? "…" : "Aktualisieren"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsEditing(true);
                  }}
                  className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-50"
                >
                  Bearbeiten
                </button>
              </div>
            </div>
          </a>
        </div>
      );
    },
  },
);
