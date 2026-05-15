"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SidebarLehrplan } from "@/lib/curriculum/repository";
import {
  createDocument,
  deleteDocument,
  fetchTree,
  moveDocumentRequest,
  updateDocument,
} from "@/lib/workspace/api-client";
import type { DokumentKnoten, DokumentTyp } from "@/lib/workspace/types";

export type WorkspaceTab = (
  | { kind: "dokument"; key: string; dokumentId: string }
  | {
      kind: "klasse";
      key: string;
      lehrplanSlug: string;
      klasseNr: number;
      titel: string;
    }
  | { kind: "bereich"; key: string; bereichId: string; titel: string }
  | { kind: "kompetenz"; key: string; kompetenzId: string; titel: string }
  | {
      kind: "anwendungsbereich";
      key: string;
      anwendungsbereichId: string;
      titel: string;
    }
) & {
  /**
   * Preview tabs are temporary (VS-Code-Style): wenn sie via Single-Click
   * geöffnet werden, werden sie durch die nächste Preview ersetzt statt
   * eine neue Tab-Position zu belegen. Doppelklick oder Bearbeitung
   * promoted die Tab zu einer permanenten (preview = false / undefined).
   */
  preview?: boolean;
};

export function dokumentTabKey(id: string): string {
  return `dok:${id}`;
}
export function klasseTabKey(slug: string, klasseNr: number): string {
  return `klasse:${slug}:${klasseNr}`;
}
export function bereichTabKey(bereichId: string): string {
  return `bereich:${bereichId}`;
}
export function kompetenzTabKey(id: string): string {
  return `kompetenz:${id}`;
}
export function anwendungsbereichTabKey(id: string): string {
  return `awb:${id}`;
}

interface WorkspaceContextValue {
  tree: DokumentKnoten[];
  lehrplaene: SidebarLehrplan[];
  openTabs: WorkspaceTab[];
  activeTabKey: string | null;
  activeTab: WorkspaceTab | null;
  saveStatus: "idle" | "saving" | "saved" | "error";
  openDocument: (id: string, options?: { preview?: boolean }) => void;
  openKlasseTab: (lehrplanSlug: string, klasseNr: number, titel: string) => void;
  openBereichTab: (bereichId: string, titel: string) => void;
  openKompetenzTab: (kompetenzId: string, titel: string) => void;
  openAnwendungsbereichTab: (anwendungsbereichId: string, titel: string) => void;
  closeTab: (key: string) => void;
  setActiveTab: (key: string) => void;
  promoteTab: (key: string) => void;
  renameDocument: (id: string, titel: string) => Promise<void>;
  setIcon: (id: string, icon: string | null) => Promise<void>;
  saveContent: (id: string, content: string) => void;
  addDocument: (parentId: string | null, typ: DokumentTyp) => Promise<string | null>;
  uploadFileDocument: (parentId: string | null, file: File) => Promise<string | null>;
  removeDocument: (id: string) => Promise<void>;
  moveDocument: (id: string, parentId: string | null, position?: number) => Promise<void>;
  findNode: (id: string) => DokumentKnoten | undefined;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

interface WorkspaceProviderProps {
  initialTree: DokumentKnoten[];
  lehrplaene: SidebarLehrplan[];
  initialDocumentId?: string;
  children: React.ReactNode;
}

export function WorkspaceProvider({
  initialTree,
  lehrplaene,
  initialDocumentId,
  children,
}: WorkspaceProviderProps) {
  const [tree, setTree] = useState<DokumentKnoten[]>(initialTree);
  const initial: WorkspaceTab[] = initialDocumentId
    ? [
        {
          kind: "dokument",
          key: dokumentTabKey(initialDocumentId),
          dokumentId: initialDocumentId,
        },
      ]
    : [];
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(initial);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(
    initialDocumentId ? dokumentTabKey(initialDocumentId) : null,
  );
  const [saveStatus, setSaveStatus] = useState<WorkspaceContextValue["saveStatus"]>("idle");
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const findNode = useCallback((id: string) => findNodeInTree(tree, id), [tree]);

  const refresh = useCallback(async () => {
    const next = await fetchTree();
    setTree(next);
  }, []);

  const upsertTab = useCallback((tab: WorkspaceTab, opts?: { preview?: boolean }) => {
    const preview = opts?.preview ?? false;
    setOpenTabs((prev) => {
      const existingIdx = prev.findIndex((t) => t.key === tab.key);
      if (existingIdx >= 0) {
        // Bereits geöffnet: wenn permanent geöffnet wird, Preview-Flag entfernen.
        if (!preview && prev[existingIdx].preview) {
          const next = [...prev];
          next[existingIdx] = { ...prev[existingIdx], preview: false } as WorkspaceTab;
          return next;
        }
        return prev;
      }
      if (preview) {
        // Existierende Preview-Tab an gleicher Stelle ersetzen.
        const previewIdx = prev.findIndex((t) => t.preview);
        if (previewIdx >= 0) {
          const next = [...prev];
          next[previewIdx] = { ...tab, preview: true };
          return next;
        }
        return [...prev, { ...tab, preview: true }];
      }
      return [...prev, tab];
    });
    setActiveTabKey(tab.key);
  }, []);

  const openDocument = useCallback(
    (id: string, options?: { preview?: boolean }) => {
      upsertTab(
        { kind: "dokument", key: dokumentTabKey(id), dokumentId: id },
        { preview: options?.preview ?? true },
      );
    },
    [upsertTab],
  );

  const promoteTab = useCallback((key: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.key === key && t.preview ? ({ ...t, preview: false } as WorkspaceTab) : t)),
    );
  }, []);

  const openKlasseTab = useCallback(
    (lehrplanSlug: string, klasseNr: number, titel: string) => {
      upsertTab({
        kind: "klasse",
        key: klasseTabKey(lehrplanSlug, klasseNr),
        lehrplanSlug,
        klasseNr,
        titel,
      });
    },
    [upsertTab],
  );

  const openBereichTab = useCallback(
    (bereichId: string, titel: string) => {
      upsertTab({
        kind: "bereich",
        key: bereichTabKey(bereichId),
        bereichId,
        titel,
      });
    },
    [upsertTab],
  );

  const openKompetenzTab = useCallback(
    (kompetenzId: string, titel: string) => {
      upsertTab({
        kind: "kompetenz",
        key: kompetenzTabKey(kompetenzId),
        kompetenzId,
        titel,
      });
    },
    [upsertTab],
  );

  const openAnwendungsbereichTab = useCallback(
    (anwendungsbereichId: string, titel: string) => {
      upsertTab({
        kind: "anwendungsbereich",
        key: anwendungsbereichTabKey(anwendungsbereichId),
        anwendungsbereichId,
        titel,
      });
    },
    [upsertTab],
  );

  const closeTab = useCallback(
    (key: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((tab) => tab.key !== key);
        if (activeTabKey === key) {
          const index = prev.findIndex((tab) => tab.key === key);
          const successor = next[index] ?? next[index - 1] ?? null;
          setActiveTabKey(successor?.key ?? null);
        }
        return next;
      });
    },
    [activeTabKey],
  );

  const setActiveTab = useCallback((key: string) => setActiveTabKey(key), []);

  const renameDocument = useCallback(
    async (id: string, titel: string) => {
      const trimmed = titel.trim();
      if (!trimmed) return;
      setTree((prev) => mapTree(prev, id, (n) => ({ ...n, titel: trimmed })));
      try {
        await updateDocument(id, { titel: trimmed });
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const setIcon = useCallback(
    async (id: string, icon: string | null) => {
      setTree((prev) => mapTree(prev, id, (n) => ({ ...n, icon: icon ?? undefined })));
      try {
        await updateDocument(id, { icon });
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const saveContent = useCallback((id: string, content: string) => {
    setTree((prev) => mapTree(prev, id, (n) => ({ ...n, inhalt: content })));
    // Bearbeiten promotet eine Preview-Tab zu einer permanenten.
    const key = dokumentTabKey(id);
    setOpenTabs((prev) =>
      prev.map((t) => (t.key === key && t.preview ? ({ ...t, preview: false } as WorkspaceTab) : t)),
    );

    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    setSaveStatus("saving");
    const handle = setTimeout(async () => {
      try {
        await updateDocument(id, { inhaltMarkdown: content });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("error");
      }
    }, 600);
    saveTimers.current.set(id, handle);
  }, []);

  const addDocument = useCallback(
    async (parentId: string | null, typ: DokumentTyp) => {
      const titel = typ === "ordner" ? "Neuer Ordner" : "Neue Seite";
      try {
        const result = await createDocument({ parentId, typ, titel });
        await refresh();
        const newId = result?.dokument?.id as string | undefined;
        if (newId && typ === "seite") {
          openDocument(newId, { preview: false });
        }
        return newId ?? null;
      } catch {
        await refresh();
        return null;
      }
    },
    [refresh, openDocument],
  );

  const uploadFileDocument = useCallback(
    async (parentId: string | null, file: File) => {
      try {
        // 1) Datei in den S3-Speicher laden (liefert Material-ID).
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/materialien", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error(`upload_failed_${uploadRes.status}`);
        const uploaded = (await uploadRes.json()) as {
          id: string;
          name: string;
          contentType?: string;
        };

        // 2) Dokument vom Typ `pdf` (= generischer „Datei“-Knoten) anlegen,
        //    das auf das Material verweist. Der Enum-Wert `pdf` ist aus
        //    historischen Gründen so benannt; er steht jetzt für jede
        //    hochgeladene Datei beliebigen Formats.
        const mime = uploaded.contentType ?? file.type ?? "application/octet-stream";
        const titel = file.name.replace(/\.[^.]+$/, "") || uploaded.name;
        const result = await createDocument({
          parentId,
          typ: "pdf",
          titel,
          icon: iconForMime(mime),
          materialId: uploaded.id,
        });
        await refresh();
        const newId = result?.dokument?.id as string | undefined;
        if (newId) openDocument(newId, { preview: false });
        return newId ?? null;
      } catch {
        await refresh();
        return null;
      }
    },
    [refresh, openDocument],
  );

  const removeDocument = useCallback(
    async (id: string) => {
      const idsToClose = collectIds(findNodeInTree(tree, id));
      try {
        await deleteDocument(id);
      } finally {
        await refresh();
        setOpenTabs((prev) => {
          const next = prev.filter((t) => !(t.kind === "dokument" && idsToClose.has(t.dokumentId)));
          const activeWasRemoved = prev.some(
            (t) => t.key === activeTabKey && t.kind === "dokument" && idsToClose.has(t.dokumentId),
          );
          if (activeWasRemoved) {
            setActiveTabKey(next[next.length - 1]?.key ?? null);
          }
          return next;
        });
      }
    },
    [tree, refresh, activeTabKey],
  );

  const moveDocument = useCallback(
    async (id: string, parentId: string | null, position?: number) => {
      try {
        await moveDocumentRequest(id, { parentId, position });
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  // Flush pending content saves on unload.
  useEffect(() => {
    const timersRef = saveTimers.current;
    return () => {
      for (const t of timersRef.values()) clearTimeout(t);
    };
  }, []);

  const activeTab = useMemo(
    () => openTabs.find((t) => t.key === activeTabKey) ?? null,
    [openTabs, activeTabKey],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      tree,
      lehrplaene,
      openTabs,
      activeTabKey,
      activeTab,
      saveStatus,
      openDocument,
      openKlasseTab,
      openBereichTab,
      openKompetenzTab,
      openAnwendungsbereichTab,
      closeTab,
      setActiveTab,
      promoteTab,
      renameDocument,
      setIcon,
      saveContent,
      addDocument,
      uploadFileDocument,
      removeDocument,
      moveDocument,
      findNode,
      refresh,
    }),
    [
      tree,
      lehrplaene,
      openTabs,
      activeTabKey,
      activeTab,
      saveStatus,
      openDocument,
      openKlasseTab,
      openBereichTab,
      openKompetenzTab,
      openAnwendungsbereichTab,
      closeTab,
      setActiveTab,
      promoteTab,
      renameDocument,
      setIcon,
      saveContent,
      addDocument,
      uploadFileDocument,
      removeDocument,
      moveDocument,
      findNode,
      refresh,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

function findNodeInTree(nodes: DokumentKnoten[], id: string): DokumentKnoten | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNodeInTree(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

function mapTree(
  nodes: DokumentKnoten[],
  id: string,
  transform: (n: DokumentKnoten) => DokumentKnoten,
): DokumentKnoten[] {
  return nodes.map((n) => {
    if (n.id === id) return transform(n);
    if (n.children) {
      return { ...n, children: mapTree(n.children, id, transform) };
    }
    return n;
  });
}

function collectIds(node: DokumentKnoten | undefined): Set<string> {
  const ids = new Set<string>();
  if (!node) return ids;
  const stack: DokumentKnoten[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    ids.add(current.id);
    if (current.children) stack.push(...current.children);
  }
  return ids;
}

/**
 * Best-effort emoji icon for an uploaded file based on its MIME type.
 * Used to give the sidebar / document header a glanceable hint of the file
 * format. Returns a generic document icon for anything we don't recognise.
 */
export function iconForMime(mime: string): string {
  if (mime === "application/pdf") return "📕";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "message/rfc822" || mime === "application/vnd.ms-outlook") return "✉️";
  if (mime === "application/epub+zip") return "📚";
  if (
    mime === "text/csv" ||
    mime === "text/tab-separated-values" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "📊";
  }
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "📽️";
  }
  if (
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.oasis.opendocument.text" ||
    mime === "application/rtf" ||
    mime === "text/rtf"
  ) {
    return "📝";
  }
  if (mime === "text/html" || mime === "application/xml" || mime === "text/xml") return "🌐";
  if (mime === "text/markdown") return "📝";
  if (mime.startsWith("text/")) return "📄";
  return "📎";
}
