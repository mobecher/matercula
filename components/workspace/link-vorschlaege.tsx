"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "./workspace-context";

interface SuggestionView {
  id: string;
  targetType: "kompetenz" | "anwendungsbereich";
  zielId: string;
  zielCode: string;
  zielTitel: string;
  zielPfad: string;
  confidence: number;
  rationale: string;
  model: string;
  status: "offen" | "akzeptiert" | "abgelehnt";
  createdAt: string;
  decidedAt: string | null;
}

type FetchStatus = "idle" | "loading" | "generating" | "ready" | "error";

const STATUS_LABEL: Record<SuggestionView["status"], string> = {
  offen: "Offen",
  akzeptiert: "Akzeptiert",
  abgelehnt: "Abgelehnt",
};

const STATUS_BADGE: Record<SuggestionView["status"], string> = {
  offen: "bg-amber-100 text-amber-800",
  akzeptiert: "bg-emerald-100 text-emerald-800",
  abgelehnt: "bg-neutral-200 text-neutral-600",
};

const TYP_BADGE: Record<SuggestionView["targetType"], string> = {
  kompetenz: "bg-blue-50 text-blue-700 border-blue-200",
  anwendungsbereich: "bg-purple-50 text-purple-700 border-purple-200",
};

const TYP_LABEL: Record<SuggestionView["targetType"], string> = {
  kompetenz: "Kompetenz",
  anwendungsbereich: "Anwendungsbereich",
};

/**
 * Panel showing AI-generated suggestions for document ↔ Lehrplan element links.
 *
 * - Lists existing suggestions sorted by confidence.
 * - "Vorschläge generieren" triggers an LLM evaluation in the background.
 * - Accepting also creates the manual link; the caller must react to the
 *   backlinks-refresh event via the prop callback.
 */
export function LinkSuggestions({
  docId,
  onLinksChanged,
  reloadToken,
}: {
  docId: string;
  onLinksChanged?: () => void;
  reloadToken?: number;
}) {
  const { openKompetenzTab, openAnwendungsbereichTab } = useWorkspace();
  const [suggestions, setSuggestions] = useState<SuggestionView[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const r = await fetch(`/api/documents/${docId}/vorschlaege`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { vorschlaege: SuggestionView[] };
      setSuggestions(data.vorschlaege);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setStatus("error");
    }
  }, [docId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // External changes (e.g. manual linking via the backlinks panel) trigger a
  // reload so the suggestions' status stays consistent.
  useEffect(() => {
    if (reloadToken === undefined) return;
    void reload();
  }, [reload, reloadToken]);

  async function generate() {
    setStatus("generating");
    setError(null);
    try {
      const r = await fetch(`/api/documents/${docId}/vorschlaege`, {
        method: "POST",
      });
      const data = (await r.json().catch(() => null)) as {
        vorschlaege?: SuggestionView[];
        message?: string;
        error?: string;
      } | null;
      if (!r.ok) {
        setError(data?.message ?? data?.error ?? `HTTP ${r.status}`);
        setSuggestions(data?.vorschlaege ?? []);
        setStatus("error");
        return;
      }
      setSuggestions(data?.vorschlaege ?? []);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setStatus("error");
    }
  }

  async function decide(
    v: SuggestionView,
    aktion: "akzeptieren" | "ablehnen" | "zuruecksetzen",
  ) {
    setBusyId(v.id);
    try {
      const r = await fetch(`/api/documents/${docId}/vorschlaege/${v.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aktion }),
      });
      if (!r.ok) return;
      const data = (await r.json()) as { vorschlag: SuggestionView };
      setSuggestions((prev) =>
        prev.map((p) => (p.id === v.id ? data.vorschlag : p)),
      );
      // "akzeptieren" creates a link, "zuruecksetzen" removes a previously
      // created link – in both cases the backlinks must be refreshed.
      if (aktion === "akzeptieren" || aktion === "zuruecksetzen") {
        onLinksChanged?.();
      }
    } finally {
      setBusyId(null);
    }
  }

  const openSuggestions = suggestions.filter((v) => v.status === "offen");
  const decided = suggestions.filter((v) => v.status !== "offen");
  const generating = status === "generating";

  return (
    <div className="mb-6 space-y-3 border-b border-neutral-100 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-neutral-400">
            KI-Vorschläge
          </span>
          {openSuggestions.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {openSuggestions.length} offen
            </span>
          )}
        </div>
        <button
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          disabled={generating}
          onClick={() => void generate()}
          type="button"
        >
          {generating ? "Analysiere…" : "Vorschläge generieren"}
        </button>
      </div>

      {status === "loading" && (
        <p className="text-xs text-neutral-400">Lade Vorschläge…</p>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      )}

      {status === "ready" && suggestions.length === 0 && (
        <p className="text-xs text-neutral-500">
          Noch keine Vorschläge. Mit „Vorschläge generieren" startet die
          KI-Auswertung dieses Dokuments.
        </p>
      )}

      {openSuggestions.length > 0 && (
        <ul className="space-y-2">
          {openSuggestions.map((v) => (
            <li
              key={v.id}
              className="rounded-md border border-neutral-200 bg-white p-3 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYP_BADGE[v.targetType]}`}
                    >
                      {TYP_LABEL[v.targetType]}
                    </span>
                    <button
                      className="font-mono text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
                      onClick={() =>
                        v.targetType === "kompetenz"
                          ? openKompetenzTab(v.zielId, v.zielTitel)
                          : openAnwendungsbereichTab(v.zielId, v.zielTitel)
                      }
                      type="button"
                    >
                      {v.zielCode}
                    </button>
                    <ConfidenceBadge value={v.confidence} />
                  </div>
                  <button
                    className="block w-full text-left font-medium text-neutral-900 hover:underline"
                    onClick={() =>
                      v.targetType === "kompetenz"
                        ? openKompetenzTab(v.zielId, v.zielTitel)
                        : openAnwendungsbereichTab(v.zielId, v.zielTitel)
                    }
                    type="button"
                    title={v.zielPfad}
                  >
                    {v.zielTitel}
                  </button>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {v.zielPfad}
                  </p>
                  <p className="mt-1.5 text-sm text-neutral-700">
                    {v.rationale}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    disabled={busyId === v.id}
                    onClick={() => void decide(v, "akzeptieren")}
                    type="button"
                  >
                    Übernehmen
                  </button>
                  <button
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                    disabled={busyId === v.id}
                    onClick={() => void decide(v, "ablehnen")}
                    type="button"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none hover:text-neutral-800">
            Bereits entschieden ({decided.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {decided.map((v) => (
              <li
                key={v.id}
                className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[v.status]}`}
                      >
                        {STATUS_LABEL[v.status]}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-500">
                        {v.zielCode}
                      </span>
                      <ConfidenceBadge value={v.confidence} subtle />
                    </div>
                    <p className="mt-1 font-medium text-neutral-800">
                      {v.zielTitel}
                    </p>
                    {v.rationale && (
                      <p className="mt-1 whitespace-pre-wrap text-neutral-600">
                        {v.rationale}
                      </p>
                    )}
                  </div>
                  {v.status === "abgelehnt" && (
                    <button
                      className="shrink-0 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      disabled={busyId === v.id}
                      onClick={() => void decide(v, "akzeptieren")}
                      type="button"
                    >
                      Annehmen
                    </button>
                  )}
                  {v.status === "akzeptiert" && (
                    <button
                      className="shrink-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      disabled={busyId === v.id}
                      onClick={() => void decide(v, "zuruecksetzen")}
                      type="button"
                      title="Verknüpfung entfernen und Vorschlag wieder als offen markieren"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ConfidenceBadge({ value, subtle }: { value: number; subtle?: boolean }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.75 ? "high" : value >= 0.5 ? "mid" : "low";
  const styles = subtle
    ? "border border-neutral-200 bg-white text-neutral-500"
    : tone === "high"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "mid"
        ? "bg-amber-100 text-amber-800"
        : "bg-neutral-200 text-neutral-700";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${styles}`}
      title={`Konfidenz ${pct}%`}
    >
      {pct}%
    </span>
  );
}
