# CLAUDE.md

## Domain glossary
- **Lehrplan**: Offizieller curricularer Rahmen; gespeichert in `lehrplan_versionen`.
- **Kompetenzbereich**: Thematische Gruppe von Kompetenzen; gespeichert in `kompetenzbereiche`.
- **Kompetenz**: Einzelne Lernziel-Einheit; gespeichert in `kompetenzen`.
- **Deskriptor**: Konkretisierung einer Kompetenz; gespeichert in `deskriptoren`.
- **Schulstufe**: Zielstufe im Schulsystem; Feld `schulstufe` in `lehrplan_versionen`.
- **Material**: Unterrichtsmaterial und seine Chunks; gespeichert in `materialien` und `material_chunks`.
- **Tag**: Verknüpfung Material↔Kompetenz inklusive KI-Begründung; gespeichert in `material_kompetenz_links`.

## Naming convention
- Verwende **Deutsch** für fachliche Begriffe in Code und DB-Spalten (`kompetenzen`, `titel`, `schuljahr`).
- Verwende **Englisch** für technische Belange (`createdAt`, `ownerId`, `status`).
- UI-Texte sind auf **Deutsch**.

## Architectural rules
- Nutze niemals die Vercel Edge Runtime.
- Nutze keine Vercel-spezifischen Datenprodukte (KV/Postgres/Blob); verwende ausschließlich Abstraktionen unter `lib/`.
- Alle API-Routen validieren Eingaben mit Zod.
- Datenbankzugriffe laufen nur über Drizzle; Raw SQL ist nur in Migrationen erlaubt.
- KI-Aufrufe laufen ausschließlich über `lib/ai/providers.ts`.

## How to add a feature
1. Schema in `lib/db/schema/` ergänzen.
2. Migration erzeugen (`pnpm db:generate`) und anwenden (`pnpm db:migrate`).
3. API-Route mit Zod-Validierung unter `app/api/` hinzufügen.
4. UI im App Router (`app/`) ergänzen.
5. Passenden Playwright-Smoke-Test in `tests/` ergänzen.

## What's intentionally NOT built yet

- KI-Tagging-Pipeline (Schritte 2 & 3 von `tagMaterial`: Embeddings, LLM-Tagging)
- Markdown-Editor
- Ausgereifte Page-Reference-Workflows

## Extractor service

- Einziger Python-Anteil im Stack: Python 3.12 + FastAPI + `unstructured`,
  liegt in `/services/extractor/`.
- Der Node-Worker ruft den Service über HTTP via `lib/extraction/client.ts`
  auf. **Niemals inline im Worker extrahieren** — die Service-Grenze ist
  bewusst gesetzt.
- **Internal-only**: kein Host-Port in Compose, keine Public IP auf Fly.
  Auf Fly läuft der Service ausschließlich im Private-Network (`.internal`).
  Sicherheitsmodell ist Netzwerk-Isolation, deshalb keine Auth.
- **Canonical chunk shape** (Vertrag, gespiegelt in
  `lib/extraction/client.ts`):
  `chunkIndex`, `text`, `seitenzahl`, `abschnitt` plus `meta.summary`.
  Diese Feldnamen sind Pflicht — Embedding und Tagging downstream hängen
  daran. Form ändern = ganze Pipeline ändern.
- **Nur PDF emittiert echte Seitenzahlen.** Für alle anderen Formate
  (DOCX, PPTX, HTML, E-Mail, Bilder, …) sind `seitenzahl` und
  `meta.pageCount` per Design `null`. Nicht "korrigieren".
- Scanned-PDF-OCR ist absichtlich nicht unterstützt (`strategy="fast"`
  für PDFs). Bild-OCR (`.png`/`.jpeg`/…) ist hingegen aktiv — dort ist
  OCR die einzige Möglichkeit, überhaupt Text zu gewinnen.
- Unterstützte MIMEs siehe `services/extractor/app/extraction.py`
  (`SUPPORTED_MIMES`) und Spiegel in `lib/extraction/client.ts`. Beim
  Erweitern beide Listen plus die Allow-List in
  `app/api/materialien/route.ts` synchron halten.

## Common pitfalls
- Übersetze `Kompetenz` im Code nicht in `Competence`.
- Füge keine zusätzliche ORM neben Drizzle hinzu.
- Füge keine State-Manager ein (React Server Components + URL-State bevorzugen).
- Code ist immer in Englisch außer bei fachlichen Begriffen (siehe Naming Convention).
