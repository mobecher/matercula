"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace-context";

interface VerknuepftesDokument {
  id: string;
  titel: string;
  icon: string | null;
  notiz: string | null;
}

interface BereichData {
  lehrplan: { id: string; slug: string; titel: string };
  klasse: { id: string; klasse: number; titel: string };
  bereich: { id: string; titel: string; beschreibung: string | null };
  kompetenzen: Array<{
    id: string;
    perspektive: "T" | "G" | "I" | null;
    beschreibung: string;
    dokumente: VerknuepftesDokument[];
  }>;
  anwendungsbereiche: Array<{
    id: string;
    titel: string;
    beschreibung: string | null;
    dokumente: VerknuepftesDokument[];
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
  const { openDocument, openKlasseTab } = useWorkspace();
  const [data, setData] = useState<BereichData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
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
  }, [bereichId]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10 text-sm text-red-600">
        Konnte Kompetenzbereich nicht laden: {error}
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
                  <td className="px-4 py-3 text-neutral-800">{k.beschreibung}</td>
                  <td className="px-4 py-3">
                    <DokumentList docs={k.dokumente} onOpen={openDocument} />
                  </td>
                </tr>
              ))}
              {data.kompetenzen.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={3}>
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
                <th className="px-4 py-3 font-medium">Verknüpfte Materialien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {data.anwendungsbereiche.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3 text-neutral-800">
                    {a.beschreibung ?? a.titel}
                  </td>
                  <td className="px-4 py-3">
                    <DokumentList docs={a.dokumente} onOpen={openDocument} />
                  </td>
                </tr>
              ))}
              {data.anwendungsbereiche.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-neutral-500" colSpan={2}>
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

function DokumentList({
  docs,
  onOpen,
}: {
  docs: VerknuepftesDokument[];
  onOpen: (id: string) => void;
}) {
  if (docs.length === 0) {
    return <span className="text-xs text-neutral-400">—</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {docs.map((d) => (
        <li key={d.id}>
          <button
            className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            onClick={() => onOpen(d.id)}
            title={d.notiz ?? undefined}
            type="button"
          >
            <span aria-hidden>{d.icon ?? "📄"}</span>
            <span className="max-w-40 truncate">{d.titel}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
