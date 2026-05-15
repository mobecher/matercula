import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";

/**
 * Extracts the YouTube video id from common URL shapes:
 * `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/embed/<id>`,
 * `youtube.com/shorts/<id>`, `youtube.com/live/<id>`. Returns `null` for
 * anything that isn't a recognisable YouTube URL.
 */
function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return idPattern.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      return v && idPattern.test(v) ? v : null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const [prefix, id] = segments;
      if (
        (prefix === "embed" || prefix === "shorts" || prefix === "live" || prefix === "v") &&
        idPattern.test(id)
      ) {
        return id;
      }
    }
  }

  return null;
}

const ASPECT_CLASS: Record<"16:9" | "4:3" | "1:1", string> = {
  "16:9": "aspect-video",
  "4:3": "aspect-[4/3]",
  "1:1": "aspect-square",
};

/**
 * YouTube embed – large embedding tier. Renders a YouTube video as an
 * iframe via the privacy-preserving `youtube-nocookie.com` domain. Only
 * accepts YouTube URLs; the previous generic iframe embed was removed
 * because most third-party sites set `X-Frame-Options` / CSP headers that
 * block embedding.
 */
export const youtubeEmbedBlockSpec = createReactBlockSpec(
  {
    type: "youtubeEmbed",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      url: { default: "" as string },
      videoId: { default: "" as string },
      aspectRatio: {
        default: "16:9" as "16:9" | "4:3" | "1:1",
        values: ["16:9", "4:3", "1:1"] as const,
      },
    },
    content: "none",
  },
  {
    render: (props) => {
      const { url, videoId, aspectRatio } = props.block.props;
      const [isEditing, setIsEditing] = useState(!videoId);
      const [draftUrl, setDraftUrl] = useState(url);
      const [error, setError] = useState<string | null>(null);

      const commit = () => {
        const id = parseYouTubeId(draftUrl);
        if (!id) {
          setError(
            "Bitte einen gültigen YouTube-Link einfügen (z. B. https://youtu.be/…)",
          );
          return;
        }
        setError(null);
        props.editor.updateBlock(props.block, {
          type: "youtubeEmbed",
          props: {
            url: draftUrl.trim(),
            videoId: id,
            aspectRatio,
          },
        });
        setIsEditing(false);
      };

      const cycleAspect = () => {
        const order: Array<"16:9" | "4:3" | "1:1"> = ["16:9", "4:3", "1:1"];
        const next = order[(order.indexOf(aspectRatio) + 1) % order.length];
        props.editor.updateBlock(props.block, {
          type: "youtubeEmbed",
          props: { url, videoId, aspectRatio: next },
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
              autoFocus
              placeholder="https://www.youtube.com/watch?v=… oder https://youtu.be/…"
              value={draftUrl}
              onChange={(e) => {
                setDraftUrl(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
            />
            {error ? (
              <div className="text-xs text-red-600">{error}</div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={commit}
                disabled={!draftUrl.trim()}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Einbetten
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="my-2 w-full" contentEditable={false}>
          <div className="mb-1 flex items-center justify-end gap-2 text-xs text-gray-500">
            <button
              type="button"
              onClick={cycleAspect}
              className="rounded border border-gray-200 bg-white px-2 py-0.5 hover:bg-gray-50"
            >
              {aspectRatio}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftUrl(url);
                setIsEditing(true);
              }}
              className="rounded border border-gray-200 bg-white px-2 py-0.5 hover:bg-gray-50"
            >
              Bearbeiten
            </button>
          </div>
          <div
            className={`w-full overflow-hidden rounded-md bg-black ${ASPECT_CLASS[aspectRatio]}`}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title="YouTube"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      );
    },
  },
);
