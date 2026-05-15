"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { SidebarLehrplan } from "@/lib/curriculum/repository";
import type { DokumentKnoten } from "@/lib/workspace/types";
import { Sidebar } from "./sidebar";
import { WorkspaceProvider } from "./workspace-context";

interface SidebarToggleContextValue {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const SidebarToggleContext = createContext<SidebarToggleContextValue | null>(null);

export function useSidebarToggle(): SidebarToggleContextValue {
  const ctx = useContext(SidebarToggleContext);
  if (!ctx) throw new Error("useSidebarToggle must be used within a WorkspaceFrame");
  return ctx;
}

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
  const toggleValue = useMemo<SidebarToggleContextValue>(
    () => ({ sidebarOpen, toggleSidebar: () => setSidebarOpen((v) => !v) }),
    [sidebarOpen],
  );

  return (
    <WorkspaceProvider
      initialTree={baum}
      lehrplaene={lehrplaene}
      initialDocumentId={initialDokumentId}
    >
      <SidebarToggleContext.Provider value={toggleValue}>
        <div className="flex h-screen w-full overflow-hidden bg-neutral-50 text-neutral-900">
          {sidebarOpen && <Sidebar userName={benutzerName} lehrplaene={lehrplaene} />}
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-auto bg-white">{children}</main>
          </div>
        </div>
      </SidebarToggleContext.Provider>
    </WorkspaceProvider>
  );
}
