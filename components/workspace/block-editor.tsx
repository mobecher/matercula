"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/ariakit/style.css";

import { BlockNoteView } from "@blocknote/ariakit";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef } from "react";

interface BlockEditorProps {
  /**
   * Document id – used as a stable identity for the editor instance. When it
   * changes we recreate the editor so initial content is reloaded cleanly.
   */
  docId: string;
  initialMarkdown: string;
  onChangeMarkdown: (markdown: string) => void;
}

// Datei-/Medien-Blöcke wurden bewusst entfernt: PDFs (und perspektivisch
// weitere Dateien wie Word) werden als eigenständige Top-Level-Dokumente
// vom Typ `pdf` modelliert, nicht innerhalb des Block-Editors eingebettet.
const { file: _f, image: _i, video: _v, audio: _a, ...textBlockSpecs } = defaultBlockSpecs;

const schema = BlockNoteSchema.create({
  blockSpecs: textBlockSpecs,
});

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
  const editor = useCreateBlockNote({ schema });
  const onChangeRef = useRef(onChangeMarkdown);
  onChangeRef.current = onChangeMarkdown;
  const initialMarkdownRef = useRef(initialMarkdown);
  const hydratedRef = useRef(false);
  const suppressNextChangeRef = useRef(false);

  // Hydrate the editor with the initial content once on mount. Persisted
  // content is preferentially BlockNote-JSON (lossless – preserves Datei-/
  // Bildblöcke); ältere Dokumente werden weiterhin als Markdown geparst.
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

  return (
    <div className="-mx-3">
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={async () => {
          if (!hydratedRef.current) return;
          if (suppressNextChangeRef.current) {
            suppressNextChangeRef.current = false;
            return;
          }
          // Persistiere als BlockNote-JSON (verlustfrei – Datei-/Bildblöcke
          // bleiben erhalten). Wird beim Laden anhand des `[`-Präfixes von
          // legacy-Markdown unterschieden.
          const json = JSON.stringify(editor.document);
          onChangeRef.current(json);
        }}
      />
    </div>
  );
}
