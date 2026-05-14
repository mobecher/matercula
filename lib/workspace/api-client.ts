import type { DokumentKnoten, DokumentTyp } from "./types";

export interface CreateDocumentPayload {
  parentId: string | null;
  typ: DokumentTyp;
  titel: string;
  icon?: string | null;
}

export interface UpdateDocumentPayload {
  titel?: string;
  icon?: string | null;
  inhaltMarkdown?: string | null;
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

export async function fetchTree(): Promise<DokumentKnoten[]> {
  const res = await fetch("/api/dokumente", { cache: "no-store" });
  const body = await jsonOrThrow(res);
  return body.baum as DokumentKnoten[];
}

export async function createDocument(payload: CreateDocumentPayload) {
  const res = await fetch("/api/dokumente", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function updateDocument(id: string, payload: UpdateDocumentPayload) {
  const res = await fetch(`/api/dokumente/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function deleteDocument(id: string) {
  const res = await fetch(`/api/dokumente/${id}`, { method: "DELETE" });
  return jsonOrThrow(res);
}

export async function moveDocumentRequest(id: string, payload: MovePayload) {
  const res = await fetch(`/api/dokumente/${id}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}
