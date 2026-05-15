"use client";

import { DocumentView } from "./document-view";
import { TabBar } from "./tab-bar";

export function DocumentArea() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabBar />
      <div className="min-h-0 flex-1 overflow-auto">
        <DocumentView />
      </div>
    </div>
  );
}
