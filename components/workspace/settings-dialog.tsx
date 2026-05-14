"use client";

import { useEffect, useState } from "react";

interface KeyState {
  vorhanden: boolean;
  vorschau: string | null;
}

interface SettingsResponse {
  name: string;
  email: string;
  schluessel: {
    openai: KeyState;
    anthropic: KeyState;
    deepseek: KeyState;
  };
}

type ProviderField = "openaiApiKey" | "anthropicApiKey" | "deepseekApiKey";

interface ProviderInfo {
  field: ProviderField;
  label: string;
  hinweis: string;
  status: KeyState | null;
}

/**
 * Modaler Dialog für Benutzereinstellungen (aktuell: LLM-API-Schlüssel).
 *
 * - Lädt beim Öffnen den aktuellen Status (maskierte Schlüssel) vom Server.
 * - Zeigt nur Klartext, den der Benutzer gerade neu eingibt; Bestandsschlüssel
 *   werden serverseitig maskiert und nie an den Client gesendet.
 * - Leerer Eingabewert + Speichern = Schlüssel wird gelöscht.
 * - Felder ohne Eingabe bleiben unverändert.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<ProviderField, string>>({
    openaiApiKey: "",
    anthropicApiKey: "",
    deepseekApiKey: "",
  });
  const [loeschen, setLoeschen] = useState<Record<ProviderField, boolean>>({
    openaiApiKey: false,
    anthropicApiKey: false,
    deepseekApiKey: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/settings")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as SettingsResponse;
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setFehler(e instanceof Error ? e.message : "Unbekannter Fehler");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const providers: ProviderInfo[] = [
    {
      field: "openaiApiKey",
      label: "OpenAI",
      hinweis: "z. B. sk-… (https://platform.openai.com/api-keys)",
      status: data?.schluessel.openai ?? null,
    },
    {
      field: "anthropicApiKey",
      label: "Anthropic",
      hinweis: "z. B. sk-ant-… (https://console.anthropic.com/)",
      status: data?.schluessel.anthropic ?? null,
    },
    {
      field: "deepseekApiKey",
      label: "DeepSeek",
      hinweis: "z. B. sk-… (https://platform.deepseek.com/)",
      status: data?.schluessel.deepseek ?? null,
    },
  ];

  async function speichern() {
    setSaving(true);
    setFehler(null);
    setHinweis(null);
    try {
      const body: Partial<Record<ProviderField, string>> = {};
      for (const p of providers) {
        if (loeschen[p.field]) {
          body[p.field] = "";
        } else if (drafts[p.field].trim() !== "") {
          body[p.field] = drafts[p.field].trim();
        }
      }
      if (Object.keys(body).length === 0) {
        setHinweis("Keine Änderungen zu speichern.");
        setSaving(false);
        return;
      }
      const r = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated = (await r.json()) as SettingsResponse;
      setData(updated);
      setDrafts({ openaiApiKey: "", anthropicApiKey: "", deepseekApiKey: "" });
      setLoeschen({
        openaiApiKey: false,
        anthropicApiKey: false,
        deepseekApiKey: false,
      });
      setHinweis("Gespeichert.");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
    >
      <button
        aria-label="Schließen"
        className="-z-0 absolute inset-0 bg-black/40"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-base font-semibold text-neutral-900" id="settings-dialog-title">
            Einstellungen
          </h2>
          <button
            aria-label="Schließen"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section>
            <h3 className="mb-1 text-sm font-medium text-neutral-900">LLM-API-Schlüssel</h3>
            <p className="text-xs text-neutral-500">
              Schlüssel werden pro Benutzer gespeichert und nur serverseitig verwendet. Sie werden
              nie im Klartext zurückgegeben.
            </p>
          </section>

          {loading && <p className="text-sm text-neutral-500">Lade…</p>}

          {!loading &&
            providers.map((p) => (
              <div className="space-y-1.5" key={p.field}>
                <div className="flex items-center justify-between">
                  <label
                    className="text-sm font-medium text-neutral-800"
                    htmlFor={`field-${p.field}`}
                  >
                    {p.label}
                  </label>
                  <span className="text-xs text-neutral-500">
                    {p.status?.vorhanden ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                        />
                        Aktiv ({p.status.vorschau})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span
                          aria-hidden
                          className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-300"
                        />
                        Nicht gesetzt
                      </span>
                    )}
                  </span>
                </div>
                <input
                  autoComplete="off"
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none disabled:bg-neutral-100"
                  disabled={loeschen[p.field]}
                  id={`field-${p.field}`}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [p.field]: e.target.value }))}
                  placeholder={
                    p.status?.vorhanden ? "Neuen Schlüssel eingeben, um zu ersetzen…" : p.hinweis
                  }
                  type="password"
                  value={drafts[p.field]}
                />
                {p.status?.vorhanden && (
                  <label className="flex items-center gap-2 text-xs text-neutral-600">
                    <input
                      checked={loeschen[p.field]}
                      onChange={(e) =>
                        setLoeschen((prev) => ({
                          ...prev,
                          [p.field]: e.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Vorhandenen Schlüssel löschen
                  </label>
                )}
              </div>
            ))}

          {fehler && (
            <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
              {fehler}
            </p>
          )}
          {hinweis && !fehler && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
              {hinweis}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          <button
            className="rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
            onClick={onClose}
            type="button"
          >
            Schließen
          </button>
          <button
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            disabled={saving || loading}
            onClick={() => void speichern()}
            type="button"
          >
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
