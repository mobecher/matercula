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
import {
  createDocument,
  deleteDocument,
  fetchTree,
  moveDocumentRequest,
  updateDocument,
} from "@/lib/workspace/api-client";
import type { DokumentKnoten, DokumentTyp } from "@/lib/workspace/types";

interface WorkspaceContextValue {
  tree: DokumentKnoten[];
  openTabs: string[];
  activeTabId: string | null;
  saveStatus: "idle" | "saving" | "saved" | "error";
  openDocument: (id: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameDocument: (id: string, titel: string) => Promise<void>;
  setIcon: (id: string, icon: string | null) => Promise<void>;
  saveContent: (id: string, content: string) => void;
  addDocument: (parentId: string | null, typ: DokumentTyp) => Promise<string | null>;
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
  initialDocumentId?: string;
  children: React.ReactNode;
}

export function WorkspaceProvider({
  initialTree,
  initialDocumentId,
  children,
}: WorkspaceProviderProps) {
  const [tree, setTree] = useState<DokumentKnoten[]>(initialTree);
  const [openTabs, setOpenTabs] = useState<string[]>(
    initialDocumentId ? [initialDocumentId] : [],
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(initialDocumentId ?? null);
  const [saveStatus, setSaveStatus] = useState<WorkspaceContextValue["saveStatus"]>("idle");
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const findNode = useCallback(
    (id: string) => findNodeInTree(tree, id),
    [tree],
  );

  const refresh = useCallback(async () => {
    const next = await fetchTree();
    setTree(next);
  }, []);

  const openDocument = useCallback((id: string) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        if (activeTabId === id) {
          const index = prev.indexOf(id);
          const successor = next[index] ?? next[index - 1] ?? null;
          setActiveTabId(successor);
        }
        return next;
      });
    },
    [activeTabId],
  );

  const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

  const renameDocument = useCallback(async (id: string, titel: string) => {
    const trimmed = titel.trim();
    if (!trimmed) return;
    setTree((prev) => mapTree(prev, id, (n) => ({ ...n, titel: trimmed })));
    try {
      await updateDocument(id, { titel: trimmed });
    } catch {
      await refresh();
    }
  }, [refresh]);

  const setIcon = useCallback(async (id: string, icon: string | null) => {
    setTree((prev) => mapTree(prev, id, (n) => ({ ...n, icon: icon ?? undefined })));
    try {
      await updateDocument(id, { icon });
    } catch {
      await refresh();
    }
  }, [refresh]);

  const saveContent = useCallback((id: string, content: string) => {
    setTree((prev) => mapTree(prev, id, (n) => ({ ...n, inhalt: content })));

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
          openDocument(newId);
        }
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
          const next = prev.filter((t) => !idsToClose.has(t));
          if (activeTabId && idsToClose.has(activeTabId)) {
            setActiveTabId(next[next.length - 1] ?? null);
          }
          return next;
        });
      }
    },
    [tree, refresh, activeTabId],
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

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      tree,
      openTabs,
      activeTabId,
      saveStatus,
      openDocument,
      closeTab,
      setActiveTab,
      renameDocument,
      setIcon,
      saveContent,
      addDocument,
      removeDocument,
      moveDocument,
      findNode,
      refresh,
    }),
    [
      tree,
      openTabs,
      activeTabId,
      saveStatus,
      openDocument,
      closeTab,
      setActiveTab,
      renameDocument,
      setIcon,
      saveContent,
      addDocument,
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
