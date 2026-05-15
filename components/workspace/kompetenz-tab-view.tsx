"use client";

import { useCallback, useEffect, useState } from "react";
import { type LinkedDocument, MaterialLinker } from "./material-linker";
import { useWorkspace } from "./workspace-context";

interface KompetenzDetailData {
  lehrplan: { id: string; slug: string; title: string };
  klasse: { id: string; klasse: number; title: string };
  bereich: { id: string; title: string };
  kompetenz: {
    id: string;
    perspektive: "T" | "G" | "I" | null;
    description: string;
    crossCuttingTopics: string[];
  };
  documents: LinkedDocument[];
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

export function KompetenzTabView({ kompetenzId }: { kompetenzId: string }) {
  const { openKlasseTab, openBereichTab } = useWorkspace();
  const [data, setData] = useState<KompetenzDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is the manual re-fetch trigger
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/kompetenzen/${kompetenzId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as KompetenzDetailData;
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
  }, [kompetenzId, reloadToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-red-600">
        Konnte Kompetenz nicht laden: {error}
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

      <div className="mb-2 flex items-center gap-3">
        {data.kompetenz.perspektive && (
          <span
            className={`inline-flex h-7 items-center justify-center rounded px-2 text-xs font-semibold ${
              PERSPEKTIVE_BADGE[data.kompetenz.perspektive] ?? ""
            }`}
            title={PERSPEKTIVE_LABEL[data.kompetenz.perspektive]}
          >
            {PERSPEKTIVE_LABEL[data.kompetenz.perspektive] ?? data.kompetenz.perspektive}
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">Kompetenz</h1>
      </div>
      <p className="mt-2 text-base text-neutral-800">{data.kompetenz.description}</p>

      {data.kompetenz.crossCuttingTopics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.kompetenz.crossCuttingTopics.map((t) => (
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
          endpoint={`/api/kompetenzen/${kompetenzId}/documents`}
          mode="table"
          onChange={reload}
        />
      </section>
    </div>
  );
}
