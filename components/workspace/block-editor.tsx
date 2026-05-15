"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/ariakit/style.css";

import { BlockNoteView } from "@blocknote/ariakit";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { de } from "@blocknote/core/locales";
import {
  type DefaultReactSuggestionItem,
  FilePanel,
  FilePanelController,
  type FilePanelProps,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  UploadTab,
  useCreateBlockNote,
} from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import { linkCardBlockSpec } from "./blocks/link-card-block";
import { youtubeEmbedBlockSpec } from "./blocks/youtube-embed-block";

/**
 * Uploads a single file to the server-side S3 bucket via `/api/assets`
 * and returns the stable internal URL stored in the block.
 *
 * BlockNote calls this from its image/video/audio block file panel as well
 * as from drag-and-drop and clipboard paste. Throws on failure so BlockNote
 * surfaces the error in its UI.
 */
async function uploadAssetToServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/assets", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors – fall back to status code
    }
    throw new Error(message);
  }

  const body = (await response.json()) as { url: string };
  return body.url;
}

interface BlockEditorProps {
  /**
   * Document id – used as a stable identity for the editor instance. When it
   * changes we recreate the editor so initial content is reloaded cleanly.
   */
  docId: string;
  initialMarkdown: string;
  onChangeMarkdown: (markdown: string) => void;
}

// The `file` block is intentionally omitted: PDFs and other documents are
// modeled as standalone top-level Dokumente of `typ = "pdf"`, not embedded
// inside the block editor. Image, video and audio blocks remain enabled and
// are uploaded to S3 via the `uploadFile` hook below; URL embedding has been
// disabled in favour of file upload (see `uploadFile`).
const { file: _f, ...allowedBlockSpecs } = defaultBlockSpecs;

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...allowedBlockSpecs,
    linkCard: linkCardBlockSpec(),
    youtubeEmbed: youtubeEmbedBlockSpec(),
  },
});

type EditorType = typeof schema.BlockNoteEditor;

function getCustomSlashMenuItems(editor: EditorType): DefaultReactSuggestionItem[] {
  return [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: "Link-Karte",
      subtext: "Vorschau-Karte mit Titel, Beschreibung und Favicon",
      aliases: ["link", "card", "url", "karte"],
      group: "Medien",
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "linkCard" }),
    },
    {
      title: "YouTube-Video",
      subtext: "YouTube-Link als eingebettetes Video",
      aliases: ["youtube", "video", "embed", "einbetten"],
      group: "Medien",
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "youtubeEmbed" }),
    },
  ];
}

export function BlockEditor({ docId, initialMarkdown, onChangeMarkdown }: BlockEditorProps) {
  return (
    <BlockEditorInstance
      key={docId}
      initialMarkdown={initialMarkdown}
      onChangeMarkdown={onChangeMarkdown}
    />
  );
}

function BlockEditorInstance({
  initialMarkdown,
  onChangeMarkdown,
}: {
  initialMarkdown: string;
  onChangeMarkdown: (markdown: string) => void;
}) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: de,
    uploadFile: uploadAssetToServer,
  });
  const onChangeRef = useRef(onChangeMarkdown);
  onChangeRef.current = onChangeMarkdown;
  const initialMarkdownRef = useRef(initialMarkdown);
  const hydratedRef = useRef(false);
  const suppressNextChangeRef = useRef(false);

  // Hydrate the editor with the initial content once on mount. Persisted
  // content is preferentially BlockNote JSON (lossless – preserves image,
  // video and link blocks); legacy documents are still parsed as markdown.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const raw = initialMarkdownRef.current.trim();
      let blocks: Parameters<typeof editor.replaceBlocks>[1] = [];
      if (raw) {
        if (raw.startsWith("[")) {
          try {
            blocks = JSON.parse(raw);
          } catch {
            blocks = await editor.tryParseMarkdownToBlocks(raw);
          }
        } else {
          blocks = await editor.tryParseMarkdownToBlocks(raw);
        }
      }
      if (cancelled) return;
      suppressNextChangeRef.current = true;
      editor.replaceBlocks(editor.document, blocks);
      hydratedRef.current = true;
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [editor]);

  // Persist content changes via the editor's transaction API. `BlockNoteView`s
  // `onChange` prop drops some updates (e.g. paste) because the React sync
  // lags behind ProseMirror transactions. `editor.onChange` fires for every
  // transaction (typing, paste, drag, slash menu, …).
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      if (!hydratedRef.current) return;
      if (suppressNextChangeRef.current) {
        suppressNextChangeRef.current = false;
        return;
      }
      // Persist as BlockNote JSON (lossless – image, video and link blocks
      // are preserved). On load this is distinguished from legacy markdown
      // by the leading `[` character.
      const json = JSON.stringify(editor.document);
      onChangeRef.current(json);
    });
    return () => {
      unsubscribe?.();
    };
  }, [editor]);

  return (
    <div className="-mx-3">
      <BlockNoteView editor={editor} theme="light" slashMenu={false} filePanel={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => filterSuggestionItems(getCustomSlashMenuItems(editor), query)}
        />
        <FilePanelController filePanel={UploadOnlyFilePanel} />
      </BlockNoteView>
    </div>
  );
}

/**
 * File panel restricted to the upload tab. The default panel also shows an
 * "Embed URL" tab; we deliberately remove it so inline media always lives in
 * our own S3 bucket instead of being linked to a third-party host.
 */
function UploadOnlyFilePanel(props: FilePanelProps) {
  const [, setLoading] = useState(false);
  return (
    <FilePanel
      {...props}
      defaultOpenTab="upload"
      tabs={[
        {
          name: "upload",
          tabPanel: <UploadTab {...props} setLoading={setLoading} />,
        },
      ]}
    />
  );
}
