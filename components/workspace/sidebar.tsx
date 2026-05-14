"use client";

import { useEffect, useRef, useState } from "react";
import type { SidebarLehrplan } from "@/lib/curriculum/repository";
import type { DokumentKnoten } from "@/lib/workspace/types";
import {
  anwendungsbereichTabKey,
  bereichTabKey,
  klasseTabKey,
  kompetenzTabKey,
  useWorkspace,
} from "./workspace-context";

const DRAG_MIME = "application/x-matercula-dokument-id";

interface SidebarProps {
  userName: string;
  lehrplaene: SidebarLehrplan[];
  onCloseSidebar: () => void;
}

export function Sidebar({ userName, lehrplaene, onCloseSidebar }: SidebarProps) {
  const { tree, addDocument, moveDocument, uploadPdfDocument } = useWorkspace();
  const [filter, setFilter] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const rootPdfInputRef = useRef<HTMLInputElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const filtered = filter.trim() ? filterTree(tree, filter.trim().toLowerCase()) : tree;

  function handleRootDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME);
    if (id) void moveDocument(id, null);
  }

  // Handle sibling-drop bubbling for root-level nodes.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    function handler(event: Event) {
      const e = event as CustomEvent<SiblingDropDetail>;
      const { draggedId, anchorId, place } = e.detail;
      const idx = tree.findIndex((c) => c.id === anchorId);
      if (idx === -1) return;
      event.stopPropagation();
      const targetIndex = place === "before" ? idx : idx + 1;
      void moveDocument(draggedId, null, targetIndex);
    }
    el.addEventListener("matercula:sibling-drop", handler);
    return () => el.removeEventListener("matercula:sibling-drop", handler);
  }, [tree, moveDocument]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-100">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-xs font-semibold text-white">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-neutral-500">Matercula</p>
          </div>
        </div>
        <button
          aria-label="Seitenleiste schließen"
          className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
          onClick={onCloseSidebar}
          type="button"
        >
          «
        </button>
      </div>

      <div className="px-3 pb-2">
        <input
          aria-label="Dokumente durchsuchen"
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
          onChange={(e) => setFilter(e.target.value)}
          placeholder="🔍 Suchen…"
          type="text"
          value={filter}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <CurriculumSection lehrplaene={lehrplaene} />

        <SectionHeader>Materialien</SectionHeader>

        <nav
          className="px-2 pb-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleRootDrop}
          ref={navRef}
        >
          <ul className="space-y-0.5">
            {filtered.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} />
            ))}
          </ul>

          {tree.length === 0 && (
            <p className="px-2 py-4 text-xs text-neutral-500">Noch keine Dokumente vorhanden.</p>
          )}
        </nav>
      </div>

      <div className="border-t border-neutral-200 p-2">
        <div className="flex gap-1">
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200"
            onClick={() => void addDocument(null, "seite")}
            type="button"
          >
            <span aria-hidden>＋</span>
            <span>Seite</span>
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200"
            onClick={() => void addDocument(null, "ordner")}
            type="button"
          >
            <span aria-hidden>📁</span>
            <span>Ordner</span>
          </button>
        </div>
        <input
          accept="application/pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setPdfUploading(true);
            try {
              await uploadPdfDocument(null, file);
            } finally {
              setPdfUploading(false);
            }
          }}
          ref={rootPdfInputRef}
          type="file"
        />
        <button
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
          disabled={pdfUploading}
          onClick={() => rootPdfInputRef.current?.click()}
          type="button"
        >
          <span aria-hidden>📕</span>
          <span>{pdfUploading ? "Lädt PDF hoch…" : "PDF hochladen"}</span>
        </button>
        <form action="/api/auth/logout" method="post">
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-200"
            type="submit"
          >
            <span aria-hidden>⏻</span>
            <span>Abmelden</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

interface TreeNodeProps {
  node: DokumentKnoten;
  depth: number;
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const {
    activeTab,
    openDocument,
    addDocument,
    uploadPdfDocument,
    removeDocument,
    renameDocument,
    moveDocument,
  } = useWorkspace();
  const isFolder = node.typ === "ordner";
  const isPdf = node.typ === "pdf";
  const folderPdfInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.titel);
  const [dropZone, setDropZone] = useState<"before" | "into" | "after" | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const active = !isFolder && activeTab?.kind === "dokument" && activeTab.dokumentId === node.id;

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  function primaryAction() {
    if (renaming) return;
    if (isFolder) {
      setOpen((v) => !v);
    } else {
      openDocument(node.id);
    }
  }

  function commitRename() {
    setRenaming(false);
    if (draftTitle.trim() && draftTitle.trim() !== node.titel) {
      void renameDocument(node.id, draftTitle.trim());
    } else {
      setDraftTitle(node.titel);
    }
  }

  async function handleDelete() {
    const label =
      node.typ === "ordner"
        ? `Ordner „${node.titel}“ und alle enthaltenen Seiten löschen?`
        : `Seite „${node.titel}“ löschen?`;
    if (!confirm(label)) return;
    await removeDocument(node.id);
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(DRAG_MIME, node.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const ratio = offset / rect.height;
    if (isFolder) {
      if (ratio < 0.25) setDropZone("before");
      else if (ratio > 0.75) setDropZone("after");
      else setDropZone("into");
    } else {
      setDropZone(ratio < 0.5 ? "before" : "after");
    }
  }

  function handleDragLeave() {
    setDropZone(null);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData(DRAG_MIME);
    const zone = dropZone;
    setDropZone(null);
    if (!draggedId || draggedId === node.id) return;

    if (zone === "into" && isFolder) {
      await moveDocument(draggedId, node.id);
      setOpen(true);
    } else if (zone === "before" || zone === "after") {
      // Sibling drop – we don't know the absolute index here without parent
      // context, so dispatch a custom event the parent list listens to.
      const detail: SiblingDropDetail = {
        draggedId,
        anchorId: node.id,
        place: zone,
      };
      e.currentTarget.dispatchEvent(
        new CustomEvent<SiblingDropDetail>("matercula:sibling-drop", {
          detail,
          bubbles: true,
        }),
      );
    }
  }

  return (
    <li>
      <div
        className={`group relative flex items-center gap-1 rounded-md py-1 pr-1 text-sm transition-colors ${
          active ? "bg-neutral-200 font-medium text-neutral-900" : "text-neutral-700"
        } ${dropZone === "into" ? "ring-2 ring-blue-400" : "hover:bg-neutral-200"}`}
        draggable={!renaming}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {dropZone === "before" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 top-0 h-0.5 rounded bg-blue-500"
          />
        )}
        {dropZone === "after" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded bg-blue-500"
          />
        )}

        <button
          aria-label={isFolder ? (open ? "Ordner einklappen" : "Ordner ausklappen") : undefined}
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs text-neutral-400 ${
            isFolder ? "" : "opacity-0"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (isFolder) setOpen((v) => !v);
          }}
          type="button"
        >
          {isFolder ? (open ? "▾" : "▸") : "•"}
        </button>

        <span aria-hidden className="text-sm">
          {node.icon ?? (isFolder ? "📁" : isPdf ? "📕" : "📄")}
        </span>

        {renaming ? (
          <input
            className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-1 py-0 text-sm focus:border-neutral-500 focus:outline-none"
            onBlur={commitRename}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                setDraftTitle(node.titel);
                setRenaming(false);
              }
            }}
            ref={inputRef}
            value={draftTitle}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate text-left"
            onClick={primaryAction}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraftTitle(node.titel);
              setRenaming(true);
            }}
            type="button"
          >
            {node.titel}
          </button>
        )}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isFolder && (
            <>
              <IconButton
                label="Neue Seite"
                onClick={async () => {
                  setOpen(true);
                  await addDocument(node.id, "seite");
                }}
              >
                ＋
              </IconButton>
              <IconButton
                label="Neuer Unterordner"
                onClick={async () => {
                  setOpen(true);
                  await addDocument(node.id, "ordner");
                }}
              >
                📁
              </IconButton>
              <input
                accept="application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setOpen(true);
                  await uploadPdfDocument(node.id, file);
                }}
                ref={folderPdfInputRef}
                type="file"
              />
              <IconButton label="PDF hochladen" onClick={() => folderPdfInputRef.current?.click()}>
                📕
              </IconButton>
            </>
          )}
          <IconButton
            label="Umbenennen"
            onClick={() => {
              setDraftTitle(node.titel);
              setRenaming(true);
            }}
          >
            ✎
          </IconButton>
          <IconButton label="Löschen" onClick={handleDelete}>
            🗑
          </IconButton>
        </div>
      </div>

      {isFolder && open && node.children && node.children.length > 0 && (
        <ChildList parentId={node.id} depth={depth + 1} children={node.children} />
      )}
    </li>
  );
}

interface SiblingDropDetail {
  draggedId: string;
  anchorId: string;
  place: "before" | "after";
}

interface ChildListProps {
  parentId: string;
  depth: number;
  children: DokumentKnoten[];
}

function ChildList({ parentId, depth, children }: ChildListProps) {
  const { moveDocument } = useWorkspace();
  const ulRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = ulRef.current;
    if (!el) return;
    function handler(event: Event) {
      const e = event as CustomEvent<SiblingDropDetail>;
      const { draggedId, anchorId, place } = e.detail;
      const idx = children.findIndex((c) => c.id === anchorId);
      if (idx === -1) return;
      // Only handle if the anchor is a direct child of this list.
      event.stopPropagation();
      const targetIndex = place === "before" ? idx : idx + 1;
      void moveDocument(draggedId, parentId, targetIndex);
    }
    el.addEventListener("matercula:sibling-drop", handler);
    return () => el.removeEventListener("matercula:sibling-drop", handler);
  }, [children, parentId, moveDocument]);

  return (
    <ul ref={ulRef} className="space-y-0.5">
      {children.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth} />
      ))}
    </ul>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      aria-label={label}
      className="rounded p-1 text-xs text-neutral-500 hover:bg-neutral-300 hover:text-neutral-900"
      onClick={(e) => {
        e.stopPropagation();
        void onClick();
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function filterTree(nodes: DokumentKnoten[], needle: string): DokumentKnoten[] {
  const result: DokumentKnoten[] = [];
  for (const node of nodes) {
    const childMatches = node.children ? filterTree(node.children, needle) : [];
    const selfMatches = node.titel.toLowerCase().includes(needle);
    if (selfMatches || childMatches.length > 0) {
      result.push({
        ...node,
        children: node.children ? childMatches : undefined,
      });
    }
  }
  return result;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </div>
  );
}
function CurriculumSection({ lehrplaene }: { lehrplaene: SidebarLehrplan[] }) {
  if (lehrplaene.length === 0) {
    return (
      <>
        <SectionHeader>Lehrpläne</SectionHeader>
        <p className="px-3 pb-2 text-xs text-neutral-500">Noch keine Lehrpläne geladen.</p>
      </>
    );
  }
  return (
    <>
      <SectionHeader>Lehrpläne</SectionHeader>
      <ul className="space-y-0.5 px-2 pb-2">
        {lehrplaene.map((lp) => (
          <LehrplanItem key={lp.id} lehrplan={lp} />
        ))}
      </ul>
    </>
  );
}

function LehrplanItem({ lehrplan }: { lehrplan: SidebarLehrplan }) {
  const [open, setOpen] = useState(true);
  return (
    <li>
      <button
        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-sm text-neutral-700 hover:bg-neutral-200"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs text-neutral-400">
          {open ? "▾" : "▸"}
        </span>
        <span aria-hidden>📘</span>
        <span className="min-w-0 flex-1 truncate font-medium">{lehrplan.titel}</span>
      </button>
      {open && (
        <ul className="space-y-0.5 pl-3">
          {lehrplan.klassen.map((k) => (
            <KlasseItem key={k.id} slug={lehrplan.slug} klasse={k} />
          ))}
        </ul>
      )}
    </li>
  );
}

function KlasseItem({
  slug,
  klasse,
}: {
  slug: string;
  klasse: SidebarLehrplan["klassen"][number];
}) {
  const { activeTab, openKlasseTab, openBereichTab } = useWorkspace();
  const [open, setOpen] = useState(false);
  const klasseKey = klasseTabKey(slug, klasse.klasse);
  const klasseActive = activeTab?.key === klasseKey;
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md py-1 pr-1 text-sm ${
          klasseActive
            ? "bg-neutral-200 font-medium text-neutral-900"
            : "text-neutral-700 hover:bg-neutral-200"
        }`}
      >
        <button
          aria-label={open ? "Klasse einklappen" : "Klasse ausklappen"}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs text-neutral-400"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? "▾" : "▸"}
        </button>
        <button
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => openKlasseTab(slug, klasse.klasse, klasse.titel)}
          type="button"
        >
          {klasse.titel}
        </button>
      </div>
      {open && klasse.bereiche.length > 0 && (
        <ul className="space-y-0.5 pl-5">
          {klasse.bereiche.map((b) => (
            <BereichItem key={b.id} bereich={b} />
          ))}
        </ul>
      )}
    </li>
  );
}

function BereichItem({
  bereich,
}: {
  bereich: SidebarLehrplan["klassen"][number]["bereiche"][number];
}) {
  const { activeTab, openBereichTab, openKompetenzTab, openAnwendungsbereichTab } = useWorkspace();
  const [open, setOpen] = useState(false);
  const active = activeTab?.key === bereichTabKey(bereich.id);
  const hasChildren = bereich.kompetenzen.length > 0 || bereich.anwendungsbereiche.length > 0;
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md py-1 pr-1 text-sm ${
          active
            ? "bg-neutral-200 font-medium text-neutral-900"
            : "text-neutral-700 hover:bg-neutral-200"
        }`}
      >
        <button
          aria-label={open ? "Bereich einklappen" : "Bereich ausklappen"}
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs text-neutral-400 ${
            hasChildren ? "" : "opacity-0"
          }`}
          onClick={() => hasChildren && setOpen((v) => !v)}
          type="button"
        >
          {open ? "▾" : "▸"}
        </button>
        <button
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => openBereichTab(bereich.id, bereich.titel)}
          type="button"
        >
          {bereich.titel}
        </button>
      </div>
      {open && hasChildren && (
        <ul className="space-y-0.5 pl-5">
          {bereich.kompetenzen.map((k) => {
            const kActive = activeTab?.key === kompetenzTabKey(k.id);
            return (
              <li key={k.id}>
                <button
                  className={`flex w-full min-w-0 items-center gap-1 rounded-md px-2 py-1 text-left text-sm ${
                    kActive
                      ? "bg-neutral-200 font-medium text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-200"
                  }`}
                  onClick={() => openKompetenzTab(k.id, k.titel)}
                  type="button"
                  title={k.titel}
                >
                  <span aria-hidden className="shrink-0 text-xs">
                    🎯
                  </span>
                  <span className="min-w-0 flex-1 truncate">{k.titel}</span>
                </button>
              </li>
            );
          })}
          {bereich.anwendungsbereiche.map((a) => {
            const aActive = activeTab?.key === anwendungsbereichTabKey(a.id);
            return (
              <li key={a.id}>
                <button
                  className={`flex w-full min-w-0 items-center gap-1 rounded-md px-2 py-1 text-left text-sm ${
                    aActive
                      ? "bg-neutral-200 font-medium text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-200"
                  }`}
                  onClick={() => openAnwendungsbereichTab(a.id, a.titel)}
                  type="button"
                  title={a.titel}
                >
                  <span aria-hidden className="shrink-0 text-xs">
                    🧩
                  </span>
                  <span className="min-w-0 flex-1 truncate">{a.titel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
