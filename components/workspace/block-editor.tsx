"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/ariakit/style.css";

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/ariakit";
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

const schema = BlockNoteSchema.create({ blockSpecs: defaultBlockSpecs });

/**
 * Lädt eine Datei in unser S3 hoch und gibt eine stabile interne URL
 * zurück, die später auf eine frische Signed-URL umleitet. BlockNotes
 * Default-Blöcke (Datei/Bild/Video/Audio) speichern diese URL.
 */
async function uploadFileToServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/materialien", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    let message = `Upload fehlgeschlagen (HTTP ${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = `Upload fehlgeschlagen: ${body.error}`;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body = (await response.json()) as { url: string };
  return body.url;
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
  const editor = useCreateBlockNote({ schema, uploadFile: uploadFileToServer });
  const onChangeRef = useRef(onChangeMarkdown);
  onChangeRef.current = onChangeMarkdown;
  const initialMarkdownRef = useRef(initialMarkdown);
  const hydratedRef = useRef(false);
  const suppressNextChangeRef = useRef(false);

  // Hydrate the editor with the initial markdown content once on mount.
  // Later updates to `initialMarkdown` (e.g. our own optimistic state) are
  // ignored on purpose – the editor is the source of truth while mounted.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const md = initialMarkdownRef.current;
      const blocks = md.trim() ? await editor.tryParseMarkdownToBlocks(md) : [];
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
    <div className="h-full overflow-auto rounded-md border border-neutral-200 bg-white">
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={async () => {
          if (!hydratedRef.current) return;
          if (suppressNextChangeRef.current) {
            suppressNextChangeRef.current = false;
            return;
          }
          const markdown = await editor.blocksToMarkdownLossy(editor.document);
          onChangeRef.current(markdown);
        }}
      />
    </div>
  );
}
