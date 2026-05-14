"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace-context";

interface VerknuepftesDokument {
  id: string;
  titel: string;
  icon: string | null;
  notiz: string | null;
}

interface AnwendungsbereichDetailData {
  lehrplan: { id: string; slug: string; titel: string };
  klasse: { id: string; klasse: number; titel: string };
  bereich: { id: string; titel: string };
  anwendungsbereich: {
    id: string;
    titel: string;
    beschreibung: string | null;
    uebergreifendeThemen: string[];
  };
  dokumente: VerknuepftesDokument[];
}

export function AnwendungsbereichTabView({
  anwendungsbereichId,
}: {
  anwendungsbereichId: string;
}) {
  const { openDocument, openKlasseTab, openBereichTab } = useWorkspace();
  const [data, setData] = useState<AnwendungsbereichDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/anwendungsbereiche/${anwendungsbereichId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as AnwendungsbereichDetailData;
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
  }, [anwendungsbereichId]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-red-600">
        Konnte Anwendungsbereich nicht laden: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-neutral-400">Lade…</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <nav className="mb-2 text-xs text-neutral-500">
        <span>{data.lehrplan.titel}</span>
        <span className="mx-1">›</span>
        <button
          className="hover:text-neutral-900 hover:underline"
          onClick={() =>
            openKlasseTab(data.lehrplan.slug, data.klasse.klasse, data.klasse.titel)
          }
          type="button"
        >
          {data.klasse.titel}
        </button>
        <span className="mx-1">›</span>
        <button
          className="hover:text-neutral-900 hover:underline"
          onClick={() => openBereichTab(data.bereich.id, data.bereich.titel)}
          type="button"
        >
          {data.bereich.titel}
        </button>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">
        {data.anwendungsbereich.titel}
      </h1>
      {data.anwendungsbereich.beschreibung && (
        <p className="mt-2 text-base text-neutral-800">
          {data.anwendungsbereich.beschreibung}
        </p>
      )}

      {data.anwendungsbereich.uebergreifendeThemen.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.anwendungsbereich.uebergreifendeThemen.map((t) => (
            <span
              className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
              key={t}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Verknüpfte Materialien</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="w-10 px-4 py-3 font-medium" />
                <th className="px-4 py-3 font-medium">Titel</th>
                <th className="px-4 py-3 font-medium">Notiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {data.dokumente.map((d) => (
                <tr className="hover:bg-neutral-50" key={d.id}>
                  <td className="px-4 py-3 text-lg" aria-hidden>
                    {d.icon ?? "📄"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-left font-medium text-neutral-900 hover:underline"
                      onClick={() => openDocument(d.id)}
                      type="button"
                    >
                      {d.titel}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{d.notiz ?? "—"}</td>
                </tr>
              ))}
              {data.dokumente.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={3}>
                    Noch keine Materialien verknüpft.
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
