import type { DocumentNode } from "./types";

export const documentTree: DocumentNode[] = [
  {
    id: "wb-deutsch",
    title: "Deutsch",
    type: "folder",
    icon: "📚",
    children: [
      {
        id: "doc-deutsch-jahresplanung",
        title: "Jahresplanung 2025/26",
        type: "page",
        icon: "🗓️",
        content:
          "# Jahresplanung Deutsch 2025/26\n\nÜberblick über die geplanten Themenbereiche, Kompetenzen und Lernzielkontrollen für das Schuljahr.\n\n## Kompetenzbereiche\n- Lesen\n- Schreiben\n- Sprechen\n- Sprachreflexion\n\n## Eckdaten\n- 4 Schularbeiten\n- 2 Lesetagebücher\n- 1 Projektwoche im April",
      },
      {
        id: "wb-deutsch-lesen",
        title: "Lesen",
        type: "folder",
        icon: "📖",
        children: [
          {
            id: "doc-deutsch-lesen-strategien",
            title: "Lesestrategien",
            type: "page",
            icon: "🧠",
            content:
              "# Lesestrategien\n\nSammlung von Methoden zur Förderung des sinnerfassenden Lesens.\n\n- 5-Schritt-Lesemethode\n- Markieren & Annotieren\n- Reziprokes Lesen",
          },
          {
            id: "doc-deutsch-lesen-tagebuch",
            title: "Lesetagebuch-Vorlage",
            type: "page",
            icon: "📓",
            content:
              "# Lesetagebuch\n\nVorlage für die Schüler:innen zur Begleitung der Lektüre.\n\n1. Buchtitel & Autor\n2. Inhaltszusammenfassung pro Kapitel\n3. Persönliche Bewertung",
          },
        ],
      },
      {
        id: "doc-deutsch-schularbeit-1",
        title: "1. Schularbeit – Erörterung",
        type: "page",
        icon: "📝",
        content:
          "# 1. Schularbeit\n\n**Thema:** Erörterung zu einem aktuellen gesellschaftlichen Thema.\n\n**Dauer:** 50 Minuten.\n\n**Bewertungsraster** siehe Anhang.",
      },
    ],
  },
  {
    id: "wb-mathematik",
    title: "Mathematik",
    type: "folder",
    icon: "➗",
    children: [
      {
        id: "doc-mathe-bruchrechnen",
        title: "Bruchrechnen – Stundenbild",
        type: "page",
        icon: "🧮",
        content:
          "# Stundenbild: Einführung Bruchrechnen\n\n## Lernziele\n- Brüche als Teile eines Ganzen erkennen\n- Brüche darstellen und benennen\n\n## Ablauf\n1. Pizza-Demonstration (10 min)\n2. Partnerarbeit mit Bruchstreifen (20 min)\n3. Sicherung im Plenum (15 min)",
      },
      {
        id: "doc-mathe-geometrie",
        title: "Geometrie-Werkstatt",
        type: "page",
        icon: "📐",
        content:
          "# Geometrie-Werkstatt\n\nStationenbetrieb mit 6 Stationen zu Flächen, Umfang und Konstruktion.",
      },
    ],
  },
  {
    id: "wb-organisation",
    title: "Klassenorganisation",
    type: "folder",
    icon: "🏫",
    children: [
      {
        id: "doc-elternabend",
        title: "Elternabend – Tagesordnung",
        type: "page",
        icon: "👪",
        content:
          "# Elternabend\n\n**Datum:** 18.09.2025, 19:00 Uhr\n\n## TOP\n1. Begrüßung\n2. Vorstellung des Klassenteams\n3. Schwerpunkte des Schuljahres\n4. Termine & Veranstaltungen\n5. Allfälliges",
      },
      {
        id: "doc-sitzplan",
        title: "Sitzplan",
        type: "page",
        icon: "🪑",
        content: "# Sitzplan\n\nAktueller Sitzplan der 3B – Stand September 2025.",
      },
    ],
  },
  {
    id: "doc-notizen",
    title: "Schnelle Notizen",
    type: "page",
    icon: "✏️",
    content: "# Schnelle Notizen\n\nSammelplatz für lose Ideen, Beobachtungen und To-Dos.",
  },
];

export function findDocument(
  tree: DocumentNode[],
  id: string,
): DocumentNode | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findDocument(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
