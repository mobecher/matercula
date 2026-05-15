"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { DokumentKnoten } from "@/lib/workspace/types";
import { AnwendungsbereichTabView } from "./anwendungsbereich-tab-view";
import { BereichTabView } from "./bereich-tab-view";
import { KlasseTabView } from "./klasse-tab-view";
import { KompetenzTabView } from "./kompetenz-tab-view";
import { LehrplanBacklinks } from "./lehrplan-backlinks";
import { LinkSuggestions } from "./link-vorschlaege";
import { MaterialOverview } from "./material-uebersicht";
import { iconForMime, useWorkspace } from "./workspace-context";

const BlockEditor = dynamic(() => import("./block-editor").then((m) => m.BlockEditor), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
      Editor wird geladen…
    </div>
  ),
});

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
  const { activeTab, findNode } = useWorkspace();
  if (!activeTab) return <EmptyState />;

  if (activeTab.kind === "klasse") {
    return (
      <KlasseTabView
        key={activeTab.key}
        lehrplanSlug={activeTab.lehrplanSlug}
        klasseNr={activeTab.klasseNr}
      />
    );
  }
  if (activeTab.kind === "bereich") {
    return <BereichTabView key={activeTab.key} bereichId={activeTab.bereichId} />;
  }
  if (activeTab.kind === "kompetenz") {
    return <KompetenzTabView key={activeTab.key} kompetenzId={activeTab.kompetenzId} />;
  }
  if (activeTab.kind === "anwendungsbereich") {
    return (
      <AnwendungsbereichTabView
        key={activeTab.key}
        anwendungsbereichId={activeTab.anwendungsbereichId}
      />
    );
  }

  const doc = findNode(activeTab.documentId);
  if (!doc) return <EmptyState />;
  return <DocumentEditor key={doc.id} doc={doc} />;
}

function DocumentEditor({ doc }: { doc: DokumentKnoten }) {
  const { renameDocument, setIcon, saveContent } = useWorkspace();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [backlinksReload, setBacklinksReload] = useState(0);
  const [vorschlaegeReload, setVorschlaegeReload] = useState(0);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset draft on doc switch even if title is identical
  useEffect(() => {
    setTitleDraft(doc.title);
  }, [doc.id, doc.title]);

  function commitTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(doc.title);
      return;
    }
    if (trimmed !== doc.title) {
      void renameDocument(doc.id, trimmed);
    }
  }

  function pickIcon(icon: string | null) {
    setIconPickerOpen(false);
    void setIcon(doc.id, icon);
  }

  return (
    <article className="mx-auto max-w-3xl px-10 py-10">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative">
          <button
            aria-label="Symbol ändern"
            className="rounded-md p-1 text-4xl leading-none hover:bg-neutral-100"
            onClick={() => setIconPickerOpen((v) => !v)}
            type="button"
          >
            <span aria-hidden>
              {doc.icon ?? (doc.type === "ordner" ? "📁" : doc.type === "pdf" ? "📕" : "📄")}
            </span>
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

      {doc.type !== "ordner" && (
        <LehrplanBacklinks
          docId={doc.id}
          reloadToken={backlinksReload}
          onLinksChanged={() => setVorschlaegeReload((t) => t + 1)}
        />
      )}
      {(doc.type === "seite" || doc.type === "pdf") && (
        <LinkSuggestions
          docId={doc.id}
          onLinksChanged={() => setBacklinksReload((t) => t + 1)}
          reloadToken={vorschlaegeReload}
        />
      )}
      {doc.type === "pdf" && doc.materialId && <MaterialOverview materialId={doc.materialId} />}

      {doc.type === "ordner" ? (
        <FolderHint />
      ) : doc.type === "pdf" ? (
        <FileViewer materialId={doc.materialId} />
      ) : (
        <BlockEditor
          docId={doc.id}
          initialMarkdown={doc.inhalt ?? ""}
          onChangeMarkdown={(markdown) => saveContent(doc.id, markdown)}
        />
      )}
    </article>
  );
}

interface MaterialMeta {
  id: string;
  fileName: string;
  mimeType: string;
  summary: string | null;
  status: "uploaded" | "processing" | "ready" | "error";
}

/**
 * Renders the right preview/download experience for an uploaded material.
 *
 * The DB enum `documents.type === "pdf"` is the legacy name for
 * "this document points at a Material file" — it covers any uploaded
 * format now (PDF, DOCX, PPTX, images, …). Branching here decides:
 *   - PDF → inline iframe preview (Safari needs iframe, not <object>)
 *   - everything else → download panel with filename, icon, summary,
 *     and a button. We deliberately do NOT try to render arbitrary
 *     Office/EPUB/email formats inline — the browser has no native
 *     viewer for them and proxying e.g. LibreOffice → HTML in the app
 *     is well outside the current scope.
 */
function FileViewer({ materialId }: { materialId?: string }) {
  const [meta, setMeta] = useState<MaterialMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!materialId) {
      setLoading(false);
      return;
    }
    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch(`/api/materialien/${materialId}/uebersicht`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const next = (await r.json()) as MaterialMeta;
        if (aborted) return;
        setMeta(next);
        setLoading(false);
        // Poll while extraction is still in flight so the summary appears
        // as soon as the worker finishes — same cadence as MaterialOverview.
        if (next.status === "uploaded" || next.status === "processing") {
          timer = setTimeout(tick, 2000);
        }
      } catch {
        if (aborted) return;
        setLoading(false);
      }
    }

    void tick();
    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
    };
  }, [materialId]);

  if (!materialId) {
    return (
      <p className="text-sm text-neutral-500">Diese Datei hat keine zugeordnete Quelle mehr.</p>
    );
  }

  if (loading || !meta) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
        Lade Datei…
      </div>
    );
  }

  const url = `/api/materialien/${materialId}/download`;

  if (meta.mimeType === "application/pdf") {
    // Safari renders PDFs unreliably inside <object> tags (especially when
    // there's a cross-origin redirect to a signed S3 URL). <iframe> works
    // reliably there; Firefox/Chrome don't care either way.
    return (
      <div className="relative h-[80vh] w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
        <iframe className="h-full w-full" src={`${url}#view=FitH`} title="PDF-Vorschau" />
        <noscript>
          <a className="underline" href={url} rel="noreferrer" target="_blank">
            PDF in neuem Tab öffnen
          </a>
        </noscript>
      </div>
    );
  }

  // Non-PDF formats: filename + format icon + heuristic summary + download.
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-3xl"
        >
          {iconForMime(meta.mimeType)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-900">{meta.fileName}</p>
          <p className="text-xs text-neutral-500">{meta.mimeType}</p>
        </div>
        <a
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          download={meta.fileName}
          href={url}
        >
          Herunterladen
        </a>
      </div>
      {meta.summary ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {meta.summary}
        </p>
      ) : meta.status === "uploaded" || meta.status === "processing" ? (
        <p className="mt-4 text-sm text-neutral-500">Inhaltsvorschau wird erstellt…</p>
      ) : meta.status === "error" ? (
        <p className="mt-4 text-sm text-neutral-500">
          Inhaltsvorschau konnte nicht erstellt werden.
        </p>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          Keine Textvorschau verfügbar — die Datei enthält möglicherweise keinen extrahierbaren
          Text.
        </p>
      )}
    </div>
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
      <h2 className="text-xl font-semibold text-neutral-700">Kein Tab geöffnet</h2>
      <p className="max-w-md text-sm text-neutral-500">
        Wählen Sie links in der Seitenleiste eine Seite oder einen Lehrplan-Eintrag aus.
      </p>
    </div>
  );
}
