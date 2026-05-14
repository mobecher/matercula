"use client";

import { useCallback, useEffect, useState } from "react";
import { MaterialLinker, type VerknuepftesDokument } from "./material-linker";
import { useWorkspace } from "./workspace-context";

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
  const { openKlasseTab, openBereichTab } = useWorkspace();
  const [data, setData] = useState<AnwendungsbereichDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

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
        <MaterialLinker
          docs={data.dokumente}
          endpoint={`/api/anwendungsbereiche/${anwendungsbereichId}/dokumente`}
          mode="table"
          onChange={reload}
        />
      </section>
    </div>
  );
}
