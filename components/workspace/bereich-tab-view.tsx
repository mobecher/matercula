"use client";

import { useCallback, useEffect, useState } from "react";
import { type LinkedDocument, MaterialLinker } from "./material-linker";
import { useWorkspace } from "./workspace-context";

interface BereichData {
  lehrplan: { id: string; slug: string; titel: string };
  klasse: { id: string; klasse: number; titel: string };
  bereich: { id: string; titel: string; beschreibung: string | null };
  kompetenzen: Array<{
    id: string;
    perspektive: "T" | "G" | "I" | null;
    beschreibung: string;
    dokumente: LinkedDocument[];
  }>;
  anwendungsbereiche: Array<{
    id: string;
    titel: string;
    beschreibung: string | null;
    dokumente: LinkedDocument[];
  }>;
}

const PERSPEKTIVE_LABEL: Record<string, string> = {
  T: "Technik",
  G: "Gesellschaft",
  I: "Interaktion",
};

const PERSPEKTIVE_BADGE: Record<string, string> = {
  T: "bg-blue-100 text-blue-800",
  G: "bg-amber-100 text-amber-800",
  I: "bg-emerald-100 text-emerald-800",
};

export function BereichTabView({ bereichId }: { bereichId: string }) {
  const { openKlasseTab, openKompetenzTab, openAnwendungsbereichTab } = useWorkspace();
  const [data, setData] = useState<BereichData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is the manual re-fetch trigger
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/kompetenzbereiche/${bereichId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as BereichData;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [bereichId, reloadToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-red-600">
        Konnte Kompetenzbereich nicht laden: {error}
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-neutral-400">Lade…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <nav className="mb-2 text-xs text-neutral-500">
        <span>{data.lehrplan.titel}</span>
        <span className="mx-1">›</span>
        <button
          className="hover:text-neutral-900 hover:underline"
          onClick={() => openKlasseTab(data.lehrplan.slug, data.klasse.klasse, data.klasse.titel)}
          type="button"
        >
          {data.klasse.titel}
        </button>
      </nav>
      <h1 className="text-3xl font-semibold tracking-tight">{data.bereich.titel}</h1>
      {data.bereich.beschreibung && (
        <p className="mt-2 text-sm text-neutral-600">{data.bereich.beschreibung}</p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Kompetenzen</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="w-24 px-4 py-3 font-medium">Perspektive</th>
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="w-16 px-4 py-3 text-right font-medium">Anzahl</th>
                <th className="px-4 py-3 font-medium">Verknüpfte Materialien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {data.kompetenzen.map((k) => (
                <tr key={k.id} className="align-top">
                  <td className="px-4 py-3">
                    {k.perspektive ? (
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold ${
                          PERSPEKTIVE_BADGE[k.perspektive] ?? ""
                        }`}
                        title={PERSPEKTIVE_LABEL[k.perspektive]}
                      >
                        {k.perspektive}
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-800">
                    <button
                      className="text-left hover:underline"
                      onClick={() => openKompetenzTab(k.id, shortenForTab(k.beschreibung))}
                      type="button"
                    >
                      {k.beschreibung}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {k.dokumente.length}
                  </td>
                  <td className="px-4 py-3">
                    <MaterialLinker
                      docs={k.dokumente}
                      endpoint={`/api/kompetenzen/${k.id}/dokumente`}
                      mode="chips"
                      onChange={reload}
                    />
                  </td>
                </tr>
              ))}
              {data.kompetenzen.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
                    Keine Kompetenzen hinterlegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Anwendungsbereiche</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Anwendungsbereich</th>
                <th className="w-16 px-4 py-3 text-right font-medium">Anzahl</th>
                <th className="px-4 py-3 font-medium">Verknüpfte Materialien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {data.anwendungsbereiche.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3 text-neutral-800">
                    <button
                      className="text-left hover:underline"
                      onClick={() =>
                        openAnwendungsbereichTab(
                          a.id,
                          a.titel ?? shortenForTab(a.beschreibung ?? ""),
                        )
                      }
                      type="button"
                    >
                      {a.beschreibung ?? a.titel}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {a.dokumente.length}
                  </td>
                  <td className="px-4 py-3">
                    <MaterialLinker
                      docs={a.dokumente}
                      endpoint={`/api/anwendungsbereiche/${a.id}/dokumente`}
                      mode="chips"
                      onChange={reload}
                    />
                  </td>
                </tr>
              ))}
              {data.anwendungsbereiche.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={3}>
                    Keine Anwendungsbereiche hinterlegt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function shortenForTab(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 40) return trimmed;
  const cut = trimmed.slice(0, 40);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 20 ? cut.slice(0, lastSpace) : cut}…`;
}
