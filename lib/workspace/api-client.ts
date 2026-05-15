import type { DocumentNode, DocumentType } from "./types";

export interface CreateDocumentPayload {
  parentId: string | null;
  type: DocumentType;
  title: string;
  icon?: string | null;
  materialId?: string | null;
}

export interface UpdateDocumentPayload {
  title?: string;
  icon?: string | null;
  contentMarkdown?: string | null;
}

export interface MovePayload {
  parentId: string | null;
  position?: number;
}

async function jsonOrThrow(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchTree(): Promise<DocumentNode[]> {
  const res = await fetch("/api/documents", { cache: "no-store" });
  const body = await jsonOrThrow(res);
  return body.tree as DocumentNode[];
}

export async function createDocument(payload: CreateDocumentPayload) {
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function updateDocument(id: string, payload: UpdateDocumentPayload) {
  const res = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteDocument(id: string) {
  const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
  return jsonOrThrow(res);
}

export async function moveDocumentRequest(id: string, payload: MovePayload) {
  const res = await fetch(`/api/documents/${id}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}
