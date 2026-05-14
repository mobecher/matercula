export type DokumentTyp = "ordner" | "seite";

export interface DokumentKnoten {
  id: string;
  titel: string;
  typ: DokumentTyp;
  icon?: string;
  children?: DokumentKnoten[];
  /** Markdown-ähnlicher Inhalt – aktuell nur Mock. */
  inhalt?: string;
}

export interface OffenerTab {
  id: string;
  dokumentId: string;
}
