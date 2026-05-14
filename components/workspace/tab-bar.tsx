"use client";

import { useWorkspace, type WorkspaceTab } from "./workspace-context";

interface TabBarProps {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}

export function TabBar({ sidebarOpen, onOpenSidebar }: TabBarProps) {
  const {
    openTabs,
    activeTabKey,
    findNode,
    setActiveTab,
    closeTab,
    saveStatus,
  } = useWorkspace();

  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-neutral-200 bg-neutral-100">
      {!sidebarOpen && (
        <button
          aria-label="Seitenleiste öffnen"
          className="px-3 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
          onClick={onOpenSidebar}
          type="button"
        >
          »
        </button>
      )}

      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {openTabs.length === 0 && (
          <div className="flex items-center px-4 text-xs text-neutral-400">
            Keine Tabs geöffnet
          </div>
        )}
        {openTabs.map((tab) => {
          const meta = describeTab(tab, findNode);
          if (!meta) return null;
          const active = tab.key === activeTabKey;
          return (
            <div
              key={tab.key}
              className={`group flex min-w-0 max-w-55 items-center border-r border-neutral-200 ${
                active ? "bg-white" : "bg-neutral-100 hover:bg-neutral-200"
              }`}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-sm"
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                <span aria-hidden>{meta.icon}</span>
                <span className="truncate">{meta.label}</span>
              </button>
              <button
                aria-label={`Tab „${meta.label}“ schließen`}
                className="mr-1 rounded p-0.5 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-900 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.key);
                }}
                type="button"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center px-3 text-xs text-neutral-500">
        {saveStatus === "saving" && <span>Wird gespeichert…</span>}
        {saveStatus === "saved" && (
          <span className="text-green-600">Gespeichert</span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-600">Speichern fehlgeschlagen</span>
        )}
      </div>
    </div>
  );
}

function describeTab(
  tab: WorkspaceTab,
  findNode: ReturnType<typeof useWorkspace>["findNode"],
): { label: string; icon: string } | null {
  if (tab.kind === "dokument") {
    const doc = findNode(tab.dokumentId);
    if (!doc) return null;
    return { label: doc.titel, icon: doc.icon ?? "📄" };
  }
  if (tab.kind === "klasse") {
    return { label: tab.titel, icon: "🎓" };
  }
  if (tab.kind === "bereich") {
    return { label: tab.titel, icon: "📚" };
  }
  if (tab.kind === "kompetenz") {
    return { label: tab.titel, icon: "🎯" };
  }
  return { label: tab.titel, icon: "🧩" };
}
