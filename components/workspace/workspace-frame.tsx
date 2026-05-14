"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { WorkspaceProvider } from "./workspace-context";
import type { SidebarLehrplan } from "@/lib/curriculum/repository";
import type { DokumentKnoten } from "@/lib/workspace/types";

interface WorkspaceFrameProps {
  baum: DokumentKnoten[];
  lehrplaene: SidebarLehrplan[];
  benutzerName: string;
  initialDokumentId?: string;
  children: React.ReactNode;
}

export function WorkspaceFrame({
  baum,
  lehrplaene,
  benutzerName,
  initialDokumentId,
  children,
}: WorkspaceFrameProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <WorkspaceProvider
      initialTree={baum}
      lehrplaene={lehrplaene}
      initialDocumentId={initialDokumentId}
    >
      <div className="flex h-screen w-full overflow-hidden bg-neutral-50 text-neutral-900">
        {sidebarOpen && (
          <Sidebar
            userName={benutzerName}
            lehrplaene={lehrplaene}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="min-h-0 flex-1 overflow-auto bg-white">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

function TopBar({
  sidebarOpen,
  onOpenSidebar,
}: {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}) {
  if (sidebarOpen) return null;
  return (
    <div className="flex h-9 shrink-0 items-center border-b border-neutral-200 bg-neutral-50 px-2">
      <button
        aria-label="Seitenleiste öffnen"
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
        onClick={onOpenSidebar}
        type="button"
      >
        »
      </button>
    </div>
  );
}
