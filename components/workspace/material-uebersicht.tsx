"use client";

import { useEffect, useState } from "react";

interface VorschauChunk {
  chunkIndex: number;
  seitenzahl: number | null;
  abschnitt: string | null;
  text: string;
}

interface UebersichtAntwort {
  id: string;
  titel: string;
  dateiname: string;
  mimeType: string;
  status: "uploaded" | "processing" | "ready" | "error";
  statusReason: string | null;
  anzahlChunks: number;
  anzahlSeiten: number;
  gesamtZeichen: number;
  vorschau: VorschauChunk[];
}

const STATUS_LABEL: Record<UebersichtAntwort["status"], string> = {
  uploaded: "Wartet auf Verarbeitung",
  processing: "Wird verarbeitet…",
  ready: "Bereit",
  error: "Fehler",
};

const STATUS_BADGE: Record<UebersichtAntwort["status"], string> = {
  uploaded: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-emerald-100 text-emerald-800",
  error: "bg-red-100 text-red-800",
};

/**
 * Inhaltsübersicht für ein hochgeladenes Material (PDF/DOCX):
 * Status der Extraktions-Pipeline, Anzahl Chunks/Seiten, Vorschau der ersten
 * Textabschnitte. Solange der Status `uploaded` oder `processing` ist, wird
 * im Sekundentakt nachgepollt, bis sich etwas ändert.
 */
export function MaterialUebersicht({ materialId }: { materialId: string }) {
  const [data, setData] = useState<UebersichtAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vorschauOffen, setVorschauOffen] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const r = await fetch(`/api/materialien/${materialId}/uebersicht`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const next = (await r.json()) as UebersichtAntwort;
        if (abgebrochen) return;
        setData(next);
        setFehler(null);
        setLoading(false);
        if (next.status === "uploaded" || next.status === "processing") {
          timer = setTimeout(tick, 2000);
        }
      } catch (e) {
        if (abgebrochen) return;
        setFehler(e instanceof Error ? e.message : "Unbekannter Fehler");
        setLoading(false);
      }
    }

    void tick();

    return () => {
      abgebrochen = true;
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

  if (fehler || !data) {
    return (
      <section className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        Übersicht konnte nicht geladen werden{fehler ? `: ${fehler}` : "."}
      </section>
    );
  }

  return (
    <section className="mb-6 space-y-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-neutral-400">
          Inhaltsübersicht
        </span>
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
          <dd className="font-medium">
            {data.anzahlSeiten > 0 ? data.anzahlSeiten : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Zeichen</dt>
          <dd className="font-medium">{data.gesamtZeichen.toLocaleString("de-AT")}</dd>
        </div>
      </dl>

      {data.vorschau.length > 0 && (
        <details
          className="space-y-2"
          open={vorschauOffen}
          onToggle={(e) => setVorschauOffen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none text-[11px] uppercase tracking-wider text-neutral-400 hover:text-neutral-600">
            <span className="mr-1 inline-block w-3">{vorschauOffen ? "▾" : "▸"}</span>
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
                  {c.seitenzahl != null && <span>S. {c.seitenzahl}</span>}
                  {c.abschnitt && (
                    <span className="truncate font-medium text-neutral-700">{c.abschnitt}</span>
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
