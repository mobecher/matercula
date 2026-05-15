"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace-context";

interface KlasseData {
  lehrplan: { id: string; slug: string; title: string };
  klasse: { id: string; klasse: number; title: string };
  bereiche: Array<{
    bereich: { id: string; title: string; description: string | null };
    kompetenzenAnzahl: number;
    anwendungsbereicheAnzahl: number;
  }>;
}

interface KlasseTabViewProps {
  lehrplanSlug: string;
  klasseNr: number;
}

export function KlasseTabView({ lehrplanSlug, klasseNr }: KlasseTabViewProps) {
  const { openBereichTab } = useWorkspace();
  const [data, setData] = useState<KlasseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/lehrplaene/${encodeURIComponent(lehrplanSlug)}/${klasseNr}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as KlasseData;
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
  }, [lehrplanSlug, klasseNr]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-red-600">
        Konnte Klasse nicht laden: {error}
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-neutral-400">Lade…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <p className="text-xs uppercase tracking-wider text-neutral-500">{data.lehrplan.title}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.klasse.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Kompetenzbereiche im Lehrplan „{data.lehrplan.title}“
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kompetenzbereich</th>
              <th className="px-4 py-3 font-medium">Beschreibung</th>
              <th className="px-4 py-3 font-medium text-right">Kompetenzen</th>
              <th className="px-4 py-3 font-medium text-right">Anwendungs­bereiche</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {data.bereiche.map(({ bereich, kompetenzenAnzahl, anwendungsbereicheAnzahl }) => (
              <tr key={bereich.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <button
                    className="text-left font-medium text-neutral-900 hover:underline"
                    onClick={() => openBereichTab(bereich.id, bereich.title)}
                    type="button"
                  >
                    {bereich.title}
                  </button>
                </td>
                <td className="px-4 py-3 text-neutral-600">{bereich.description ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                  {kompetenzenAnzahl}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                  {anwendungsbereicheAnzahl}
                </td>
              </tr>
            ))}
            {data.bereiche.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
                  Keine Kompetenzbereiche hinterlegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
