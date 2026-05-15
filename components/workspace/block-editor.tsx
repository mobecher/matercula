"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/ariakit/style.css";

import { BlockNoteView } from "@blocknote/ariakit";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { de } from "@blocknote/core/locales";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import {
  type DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { useEffect, useRef } from "react";
import { linkCardBlockSpec } from "./blocks/link-card-block";
import { youtubeEmbedBlockSpec } from "./blocks/youtube-embed-block";

interface BlockEditorProps {
  /**
   * Document id – used as a stable identity for the editor instance. When it
   * changes we recreate the editor so initial content is reloaded cleanly.
   */
  docId: string;
  initialMarkdown: string;
  onChangeMarkdown: (markdown: string) => void;
}

// `file` and `audio` blocks are intentionally omitted: PDFs (and later other
// file types like Word) are modeled as standalone top-level Dokumente of
// `typ = "pdf"`, not embedded inside the block editor. Image and video blocks
// remain enabled – BlockNote supports URL embeds via the default FilePanel;
// the video block renders through the HTML5 `<video>` tag.
const { file: _f, audio: _a, ...allowedBlockSpecs } = defaultBlockSpecs;

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...allowedBlockSpecs,
    linkCard: linkCardBlockSpec(),
    youtubeEmbed: youtubeEmbedBlockSpec(),
  },
});

type EditorType = typeof schema.BlockNoteEditor;

function getCustomSlashMenuItems(
  editor: EditorType,
): DefaultReactSuggestionItem[] {
  return [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: "Link-Karte",
      subtext: "Vorschau-Karte mit Titel, Beschreibung und Favicon",
      aliases: ["link", "card", "url", "karte"],
      group: "Medien",
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "linkCard" }),
    },
    {
      title: "YouTube-Video",
      subtext: "YouTube-Link als eingebettetes Video",
      aliases: ["youtube", "video", "embed", "einbetten"],
      group: "Medien",
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "youtubeEmbed" }),
    },
  ];
}

export function BlockEditor({
  docId,
  initialMarkdown,
  onChangeMarkdown,
}: BlockEditorProps) {
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
  const editor = useCreateBlockNote({ schema, dictionary: de });
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
      <BlockNoteView editor={editor} theme="light" slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
