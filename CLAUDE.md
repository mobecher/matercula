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
- KI-Tagging-Pipeline
- Dokumentextraktion
- Markdown-Editor
- Ausgereifte Page-Reference-Workflows

## Common pitfalls
- Übersetze `Kompetenz` im Code nicht in `Competence`.
- Füge keine zusätzliche ORM neben Drizzle hinzu.
- Füge keine State-Manager ein (React Server Components + URL-State bevorzugen).
