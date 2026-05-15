"use client";

import { useCallback, useEffect, useState } from "react";
import { type LinkedDocument, MaterialLinker } from "./material-linker";
import { useWorkspace } from "./workspace-context";

interface AnwendungsbereichDetailData {
  lehrplan: { id: string; slug: string; title: string };
  klasse: { id: string; klasse: number; title: string };
  bereich: { id: string; title: string };
  anwendungsbereich: {
    id: string;
    title: string;
    description: string | null;
    crossCuttingTopics: string[];
  };
  documents: LinkedDocument[];
}

export function AnwendungsbereichTabView({ anwendungsbereichId }: { anwendungsbereichId: string }) {
  const { openKlasseTab, openBereichTab } = useWorkspace();
  const [data, setData] = useState<AnwendungsbereichDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is the manual re-fetch trigger
  useEffect(() => {
    let cancelled = false;
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
  }, [anwendungsbereichId, reloadToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-red-600">
        Konnte Anwendungsbereich nicht laden: {error}
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-neutral-400">Lade…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <nav className="mb-2 text-xs text-neutral-500">
        <span>{data.lehrplan.title}</span>
        <span className="mx-1">›</span>
        <button
          className="hover:text-neutral-900 hover:underline"
          onClick={() => openKlasseTab(data.lehrplan.slug, data.klasse.klasse, data.klasse.title)}
          type="button"
        >
          {data.klasse.title}
        </button>
        <span className="mx-1">›</span>
        <button
          className="hover:text-neutral-900 hover:underline"
          onClick={() => openBereichTab(data.bereich.id, data.bereich.title)}
          type="button"
        >
          {data.bereich.title}
        </button>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">{data.anwendungsbereich.title}</h1>
      {data.anwendungsbereich.description && (
        <p className="mt-2 text-base text-neutral-800">{data.anwendungsbereich.description}</p>
      )}

      {data.anwendungsbereich.crossCuttingTopics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.anwendungsbereich.crossCuttingTopics.map((t) => (
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
        <MaterialLinker
          docs={data.documents}
          endpoint={`/api/anwendungsbereiche/${anwendungsbereichId}/documents`}
          mode="table"
          onChange={reload}
        />
      </section>
    </div>
  );
}
