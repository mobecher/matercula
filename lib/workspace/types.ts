export type DocumentType = "folder" | "page" | "file";

export interface DocumentNode {
  id: string;
  title: string;
  type: DocumentType;
  icon?: string;
  children?: DocumentNode[];
  /** Markdown-like content — only relevant for `type === "page"`. */
  inhalt?: string;
  /** Reference to the uploaded Material — only for `type === "file"`. */
  materialId?: string;
}

export interface OpenTab {
  id: string;
  documentId: string;
}
