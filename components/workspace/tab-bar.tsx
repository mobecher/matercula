"use client";

import { useWorkspace } from "./workspace-context";

interface TabBarProps {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}

export function TabBar({ sidebarOpen, onOpenSidebar }: TabBarProps) {
  const { openTabs, activeTabId, findNode, setActiveTab, closeTab, saveStatus } = useWorkspace();

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
            Keine Dokumente geöffnet
          </div>
        )}
        {openTabs.map((id) => {
          const doc = findNode(id);
          if (!doc) return null;
          const active = id === activeTabId;
          return (
            <div
              key={id}
              className={`group flex min-w-0 max-w-[220px] items-center border-r border-neutral-200 ${
                active ? "bg-white" : "bg-neutral-100 hover:bg-neutral-200"
              }`}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-sm"
                onClick={() => setActiveTab(id)}
                type="button"
              >
                <span aria-hidden>{doc.icon ?? "📄"}</span>
                <span className="truncate">{doc.titel}</span>
              </button>
              <button
                aria-label={`Tab „${doc.titel}“ schließen`}
                className="mr-1 rounded p-0.5 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-900 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(id);
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
        {saveStatus === "saved" && <span className="text-green-600">Gespeichert</span>}
        {saveStatus === "error" && (
          <span className="text-red-600">Speichern fehlgeschlagen</span>
        )}
      </div>
    </div>
  );
}
