export type DokumentTyp = "ordner" | "seite" | "pdf";

export interface DokumentKnoten {
  id: string;
  titel: string;
  typ: DokumentTyp;
  icon?: string;
  children?: DokumentKnoten[];
  /** Markdown-ähnlicher Inhalt – nur für Typ `seite` relevant. */
  inhalt?: string;
  /** Verweis auf das hochgeladene Material – nur für Typ `pdf` (oder zukünftige Datei-Typen). */
  materialId?: string;
}

export interface OffenerTab {
  id: string;
  dokumentId: string;
}
