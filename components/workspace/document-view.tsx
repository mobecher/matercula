"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./workspace-context";
import type { DokumentKnoten } from "@/lib/workspace/types";

const BlockEditor = dynamic(
  () => import("./block-editor").then((m) => m.BlockEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
        Editor wird geladen…
      </div>
    ),
  },
);

const COMMON_ICONS = [
  "📄",
  "📁",
  "📚",
  "📖",
  "📝",
  "🧠",
  "🧮",
  "📐",
  "🗓️",
  "🏫",
  "👪",
  "🪑",
  "✏️",
  "📓",
  "🎯",
  "💡",
];

export function DocumentView() {
  const { activeTabId, findNode } = useWorkspace();
  const doc = activeTabId ? findNode(activeTabId) : undefined;

  if (!doc) return <EmptyState />;
  return <DocumentEditor key={doc.id} doc={doc} />;
}

function DocumentEditor({ doc }: { doc: DokumentKnoten }) {
  const { renameDocument, setIcon, saveContent } = useWorkspace();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.titel);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitleDraft(doc.titel);
  }, [doc.id, doc.titel]);

  function commitTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(doc.titel);
      return;
    }
    if (trimmed !== doc.titel) {
      void renameDocument(doc.id, trimmed);
    }
  }

  function pickIcon(icon: string | null) {
    setIconPickerOpen(false);
    void setIcon(doc.id, icon);
  }

  return (
    <article className="mx-auto flex h-full max-w-3xl flex-col px-10 py-10">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative">
          <button
            aria-label="Symbol ändern"
            className="rounded-md p-1 text-4xl leading-none hover:bg-neutral-100"
            onClick={() => setIconPickerOpen((v) => !v)}
            type="button"
          >
            <span aria-hidden>{doc.icon ?? (doc.typ === "ordner" ? "📁" : "📄")}</span>
          </button>
          {iconPickerOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 grid w-56 grid-cols-8 gap-1 rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
              {COMMON_ICONS.map((icon) => (
                <button
                  className="rounded p-1 text-xl hover:bg-neutral-100"
                  key={icon}
                  onClick={() => pickIcon(icon)}
                  type="button"
                >
                  {icon}
                </button>
              ))}
              <button
                className="col-span-8 mt-1 rounded p-1 text-xs text-neutral-500 hover:bg-neutral-100"
                onClick={() => pickIcon(null)}
                type="button"
              >
                Symbol entfernen
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        aria-label="Titel"
        className="mb-4 w-full bg-transparent text-4xl font-bold tracking-tight text-neutral-900 outline-none placeholder:text-neutral-300"
        onBlur={commitTitle}
        onChange={(e) => setTitleDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        placeholder="Titel…"
        ref={titleRef}
        type="text"
        value={titleDraft}
      />

      {doc.typ === "ordner" ? (
        <FolderHint />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <BlockEditor
            docId={doc.id}
            initialMarkdown={doc.inhalt ?? ""}
            onChangeMarkdown={(markdown) => saveContent(doc.id, markdown)}
          />
        </div>
      )}
    </article>
  );
}

function FolderHint() {
  return (
    <p className="text-sm text-neutral-500">
      Ordner enthalten weitere Dokumente. Verwenden Sie die Seitenleiste, um neue Seiten oder
      Unterordner anzulegen.
    </p>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl" aria-hidden>
        📂
      </div>
      <h2 className="text-xl font-semibold text-neutral-700">Kein Dokument geöffnet</h2>
      <p className="max-w-md text-sm text-neutral-500">
        Wählen Sie links in der Seitenleiste eine Seite aus, um sie in einem Tab zu öffnen.
      </p>
    </div>
  );
}
