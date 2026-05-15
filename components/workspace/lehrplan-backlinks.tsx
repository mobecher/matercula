"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DokumentLehrplanLink, DokumentLehrplanLinks } from "@/lib/curriculum/links";
import type { SidebarLehrplan } from "@/lib/curriculum/repository";
import { useWorkspace } from "./workspace-context";

type LinkKind = "kompetenz" | "anwendungsbereich";

interface PickerEntry {
  id: string;
  title: string;
  path: string;
  kind: LinkKind;
}

export function LehrplanBacklinks({
  docId,
  reloadToken,
  onLinksChanged,
}: {
  docId: string;
  reloadToken?: number;
  onLinksChanged?: () => void;
}) {
  const { lehrplaene, openKompetenzTab, openAnwendungsbereichTab } = useWorkspace();
  const [data, setData] = useState<DokumentLehrplanLinks | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`/api/documents/${docId}/lehrplan-links`);
      if (r.ok) setData((await r.json()) as DokumentLehrplanLinks);
    } catch {
      /* ignore */
    }
  }, [docId]);

  useEffect(() => {
    // reloadToken is intentionally part of the dependency array so external
    // changes (e.g. accepting an AI suggestion) can refresh the backlinks.
    void reloadToken;
    setData(null);
    void reload();
  }, [reload, reloadToken]);

  const linkedKompetenzIds = useMemo(
    () => new Set((data?.kompetenzen ?? []).map((k) => k.id)),
    [data],
  );
  const linkedAnwendungsbereichIds = useMemo(
    () => new Set((data?.anwendungsbereiche ?? []).map((a) => a.id)),
    [data],
  );

  async function add(kind: LinkKind, targetId: string) {
    setBusy(true);
    try {
      const endpoint =
        kind === "kompetenz"
          ? `/api/kompetenzen/${targetId}/documents`
          : `/api/anwendungsbereiche/${targetId}/documents`;
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      if (r.ok) {
        await reload();
        onLinksChanged?.();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: LinkKind, targetId: string) {
    setBusy(true);
    try {
      const endpoint =
        kind === "kompetenz"
          ? `/api/kompetenzen/${targetId}/documents`
          : `/api/anwendungsbereiche/${targetId}/documents`;
      const r = await fetch(endpoint, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      if (r.ok) {
        await reload();
        onLinksChanged?.();
      }
    } finally {
      setBusy(false);
    }
  }

  const kompetenzen = data?.kompetenzen ?? [];
  const anwendungsbereiche = data?.anwendungsbereiche ?? [];

  return (
    <div className="mb-6 space-y-2 border-b border-neutral-100 pb-4">
      <BacklinkRow
        label="Kompetenzen"
        kind="kompetenz"
        items={kompetenzen}
        loading={data === null}
        busy={busy}
        excludeIds={linkedKompetenzIds}
        lehrplaene={lehrplaene}
        onPick={(id) => void add("kompetenz", id)}
        onRemove={(id) => void remove("kompetenz", id)}
        onOpen={(item) => openKompetenzTab(item.id, item.title)}
      />
      <BacklinkRow
        label="Anwendungsbereiche"
        kind="anwendungsbereich"
        items={anwendungsbereiche}
        loading={data === null}
        busy={busy}
        excludeIds={linkedAnwendungsbereichIds}
        lehrplaene={lehrplaene}
        onPick={(id) => void add("anwendungsbereich", id)}
        onRemove={(id) => void remove("anwendungsbereich", id)}
        onOpen={(item) => openAnwendungsbereichTab(item.id, item.title)}
      />
    </div>
  );
}

interface BacklinkRowProps {
  label: string;
  kind: LinkKind;
  items: DokumentLehrplanLink[];
  loading: boolean;
  busy: boolean;
  excludeIds: Set<string>;
  lehrplaene: SidebarLehrplan[];
  onPick: (id: string) => void;
  onRemove: (id: string) => void;
  onOpen: (item: DokumentLehrplanLink) => void;
}

function BacklinkRow({
  label,
  kind,
  items,
  loading,
  busy,
  excludeIds,
  lehrplaene,
  onPick,
  onRemove,
  onOpen,
}: BacklinkRowProps) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-1 w-40 shrink-0 text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {loading && <span className="text-xs text-neutral-400">Lade…</span>}
        {!loading && items.length === 0 && (
          <span className="text-xs text-neutral-400">Keine Verknüpfung</span>
        )}
        {items.map((item) => (
          <span
            key={item.id}
            className="group inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 pl-1.5 text-xs text-neutral-700"
            title={item.path}
          >
            <button
              aria-label={`${item.title} öffnen`}
              className="inline-flex items-center gap-1 py-0.5 hover:underline"
              onClick={() => onOpen(item)}
              type="button"
            >
              <span className="font-mono text-[10px] text-neutral-500">{item.code}</span>
              <span className="max-w-72 truncate">{item.title}</span>
            </button>
            <button
              aria-label="Verknüpfung entfernen"
              className="px-1 text-neutral-400 hover:text-red-600"
              disabled={busy}
              onClick={() => onRemove(item.id)}
              title="Verknüpfung entfernen"
              type="button"
            >
              ✕
            </button>
          </span>
        ))}
        <LehrplanPickerButton
          kind={kind}
          excludeIds={excludeIds}
          lehrplaene={lehrplaene}
          onPick={onPick}
          busy={busy}
        />
      </div>
    </div>
  );
}

interface PickerButtonProps {
  kind: LinkKind;
  excludeIds: Set<string>;
  lehrplaene: SidebarLehrplan[];
  onPick: (id: string) => void;
  busy: boolean;
}

function LehrplanPickerButton({ kind, excludeIds, lehrplaene, onPick, busy }: PickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const entries = useMemo(() => collectEntries(lehrplaene, kind), [lehrplaene, kind]);
  const needle = filter.trim().toLowerCase();
  const filtered = entries.filter(
    (e) =>
      !excludeIds.has(e.id) &&
      (needle === "" ||
        e.title.toLowerCase().includes(needle) ||
        e.path.toLowerCase().includes(needle)),
  );

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        className="rounded-md px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        + Verknüpfen
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-96 rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <input
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
              onChange={(e) => setFilter(e.target.value)}
              placeholder={kind === "kompetenz" ? "Kompetenz suchen…" : "Anwendungsbereich suchen…"}
              ref={inputRef}
              type="text"
              value={filter}
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-neutral-500">
                {entries.length === 0 ? "Kein Lehrplan vorhanden." : "Keine passenden Einträge."}
              </li>
            )}
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                  onClick={() => {
                    onPick(e.id);
                    setOpen(false);
                    setFilter("");
                  }}
                  type="button"
                >
                  <span className="min-w-0 truncate">{e.title}</span>
                  <span className="text-[10px] text-neutral-500">{e.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function collectEntries(lehrplaene: SidebarLehrplan[], kind: LinkKind): PickerEntry[] {
  const out: PickerEntry[] = [];
  for (const lp of lehrplaene) {
    for (const klasse of lp.klassen) {
      for (const bereich of klasse.bereiche) {
        const items = kind === "kompetenz" ? bereich.kompetenzen : bereich.anwendungsbereiche;
        const path = `${lp.title} › ${klasse.title} › ${bereich.title}`;
        for (const it of items) {
          out.push({ id: it.id, title: it.title, path, kind });
        }
      }
    }
  }
  return out;
}
