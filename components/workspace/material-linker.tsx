"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentNode } from "@/lib/workspace/types";
import { useWorkspace } from "./workspace-context";

export interface LinkedDocument {
  id: string;
  title: string;
  icon: string | null;
  note: string | null;
}

interface MaterialLinkerProps {
  /** REST endpoint that accepts POST { documentId } / DELETE { documentId }. */
  endpoint: string;
  docs: LinkedDocument[];
  onChange: () => void;
  /** "table" → full-width table for detail pages, "chips" → compact inline variant. */
  mode: "table" | "chips";
}

export function MaterialLinker({ endpoint, docs, onChange, mode }: MaterialLinkerProps) {
  const { openDocument } = useWorkspace();
  const [busy, setBusy] = useState(false);

  async function add(documentId: string) {
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (r.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(documentId: string) {
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (r.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  const linkedIds = useMemo(() => new Set(docs.map((d) => d.id)), [docs]);

  if (mode === "chips") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {docs.map((d) => (
          <span
            key={d.id}
            className="group inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 pl-1.5 text-xs text-neutral-700"
          >
            <button
              aria-label={`${d.title} öffnen`}
              className="inline-flex items-center gap-1 py-0.5 hover:underline"
              onClick={() => openDocument(d.id)}
              type="button"
            >
              <span aria-hidden>{d.icon ?? "📄"}</span>
              <span className="max-w-48 truncate">{d.title}</span>
            </button>
            <button
              aria-label="Verknüpfung entfernen"
              className="px-1 text-neutral-400 hover:text-red-600"
              disabled={busy}
              onClick={() => remove(d.id)}
              type="button"
              title="Verknüpfung entfernen"
            >
              ✕
            </button>
          </span>
        ))}
        <PickerButton busy={busy} excludeIds={linkedIds} label="+ Verknüpfen" onPick={add} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <PickerButton
          busy={busy}
          excludeIds={linkedIds}
          label="+ Material verknüpfen"
          onPick={add}
          variant="primary"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="w-10 px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">Titel</th>
              <th className="px-4 py-3 font-medium">Notiz</th>
              <th className="w-12 px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {docs.map((d) => (
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
                    {d.title}
                  </button>
                </td>
                <td className="px-4 py-3 text-neutral-600">{d.note ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    aria-label="Verknüpfung entfernen"
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-600"
                    disabled={busy}
                    onClick={() => remove(d.id)}
                    title="Verknüpfung entfernen"
                    type="button"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-neutral-500" colSpan={4}>
                  Noch keine Materialien verknüpft.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PickerButtonProps {
  excludeIds: Set<string>;
  onPick: (documentId: string) => void;
  label: string;
  busy: boolean;
  variant?: "default" | "primary";
}

function PickerButton({ excludeIds, onPick, label, busy, variant = "default" }: PickerButtonProps) {
  const { tree } = useWorkspace();
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

  const pages = useMemo(() => collectPages(tree), [tree]);
  const needle = filter.trim().toLowerCase();
  const filtered = pages.filter(
    (s) => !excludeIds.has(s.id) && (needle === "" || s.title.toLowerCase().includes(needle)),
  );

  const triggerCls =
    variant === "primary"
      ? "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
      : "rounded-md px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50";

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        className={triggerCls}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <input
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Material suchen…"
              ref={inputRef}
              type="text"
              value={filter}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-neutral-500">
                {pages.length === 0
                  ? "Noch keine Materialien vorhanden."
                  : "Keine passenden Materialien."}
              </li>
            )}
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                  onClick={() => {
                    onPick(s.id);
                    setOpen(false);
                    setFilter("");
                  }}
                  type="button"
                >
                  <span aria-hidden>{s.icon ?? (s.type === "file" ? "📕" : "📄")}</span>
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function collectPages(nodes: DocumentNode[]): Array<{
  id: string;
  title: string;
  icon: string | null;
  type: "page" | "file";
}> {
  const out: Array<{
    id: string;
    title: string;
    icon: string | null;
    type: "page" | "file";
  }> = [];
  function walk(ns: DocumentNode[]) {
    for (const n of ns) {
      if (n.type === "page" || n.type === "file") {
        out.push({
          id: n.id,
          title: n.title,
          icon: n.icon ?? null,
          type: n.type,
        });
      }
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  out.sort((a, b) => a.title.localeCompare(b.title, "de"));
  return out;
}
