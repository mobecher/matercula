"use client";

import { useEffect, useState } from "react";

interface PreviewChunk {
  chunkIndex: number;
  pageNumber: number | null;
  section: string | null;
  text: string;
}

interface OverviewResponse {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  status: "uploaded" | "processing" | "ready" | "error";
  statusReason: string | null;
  anzahlChunks: number;
  anzahlSeiten: number;
  gesamtZeichen: number;
  vorschau: PreviewChunk[];
}

const STATUS_LABEL: Record<OverviewResponse["status"], string> = {
  uploaded: "Wartet auf Verarbeitung",
  processing: "Wird verarbeitet…",
  ready: "Bereit",
  error: "Fehler",
};

const STATUS_BADGE: Record<OverviewResponse["status"], string> = {
  uploaded: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
};

/**
 * Content overview for an uploaded material (PDF/DOCX): status of the
 * extraction pipeline, number of chunks/pages, and a preview of the first
 * text sections. While the status is `uploaded` or `processing` we poll
 * once per second until something changes.
 */
export function MaterialOverview({ materialId }: { materialId: string }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch(`/api/materialien/${materialId}/uebersicht`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const next = (await r.json()) as OverviewResponse;
        if (aborted) return;
        setData(next);
        setError(null);
        setLoading(false);
        if (next.status === "uploaded" || next.status === "processing") {
          timer = setTimeout(tick, 2000);
        }
      } catch (e) {
        if (aborted) return;
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
        setLoading(false);
      }
    }

    void tick();

    return () => {
      aborted = true;
      if (timer) clearTimeout(timer);
    };
  }, [materialId]);

  if (loading) {
    return (
      <section className="mb-6 rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-500">
        Lade Übersicht…
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Übersicht konnte nicht geladen werden{error ? `: ${error}` : "."}
      </section>
    );
  }

  return (
    <section className="mb-6 space-y-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-neutral-400">Inhaltsübersicht</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[data.status]}`}
        >
          {STATUS_LABEL[data.status]}
        </span>
      </header>

      {data.status === "error" && data.statusReason && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {data.statusReason}
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2 text-xs text-neutral-700">
        <div>
          <dt className="text-neutral-500">Chunks</dt>
          <dd className="font-medium">{data.anzahlChunks}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Seiten</dt>
          <dd className="font-medium">{data.anzahlSeiten > 0 ? data.anzahlSeiten : "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Zeichen</dt>
          <dd className="font-medium">{data.gesamtZeichen.toLocaleString("de-AT")}</dd>
        </div>
      </dl>

      {data.vorschau.length > 0 && (
        <details
          className="space-y-2"
          open={previewOpen}
          onToggle={(e) => setPreviewOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none text-[11px] uppercase tracking-wider text-neutral-400 hover:text-neutral-600">
            <span className="mr-1 inline-block w-3">{previewOpen ? "▾" : "▸"}</span>
            Vorschau erste Abschnitte
          </summary>
          <ul className="space-y-2">
            {data.vorschau.map((c) => (
              <li
                key={c.chunkIndex}
                className="rounded-md border border-neutral-100 bg-neutral-50 p-2 text-xs"
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] text-neutral-500">
                  <span>#{c.chunkIndex}</span>
                  {c.pageNumber != null && <span>S. {c.pageNumber}</span>}
                  {c.section && (
                    <span className="truncate font-medium text-neutral-700">{c.section}</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-neutral-700">{c.text}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.status === "ready" && data.anzahlChunks === 0 && (
        <p className="text-xs text-neutral-500">
          Keine Textabschnitte gefunden. Möglicherweise enthält die Datei nur Bilder.
        </p>
      )}
    </section>
  );
}
