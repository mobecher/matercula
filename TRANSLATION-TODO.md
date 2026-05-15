# Translation TODO

We are renaming everything German to English **except** the domain glossary
from `CLAUDE.md`:

> `Lehrplan`, `Kompetenzbereich`, `Kompetenz`, `Deskriptor`, `Schulstufe`,
> `Material`, `Tag` — these stay German in code, DB, and API payloads.

UI strings stay German (they're shown to teachers).

API stability is **not** a concern (pre-production). Wire payload keys and
route segments may be renamed — just update every consumer in the same
change.

## Done

- `CLAUDE.md` translated to English.
- All German function names, types, and locals in `components/workspace/`,
  `lib/`, `app/api/`, and `scripts/` renamed to English.
- All German comments in those files translated.
- See git history for the exact rename map; LSP-aware renames updated all
  call sites.

## Remaining work

### 1. DB schema + migrations

Rename every German DB column / table that is **not** a glossary term, then
generate a Drizzle migration and update all consumers in lockstep
(`lib/db/schema/`, repository code, API routes, UI types).

Examples (non-exhaustive):

- `titel` → `title`, `beschreibung` → `description`, `inhalt` → `content`,
  `inhaltMarkdown` → `contentMarkdown`, `dateiname` → `fileName`,
  `notiz` → `note`, `vorhanden` → `present`, `vorschau` → `preview`,
  `schluessel` → `keys`, `pfad` → `path`, `seitenzahl` → `pageNumber`,
  `abschnitt` → `section`, `anzahlChunks` → `chunkCount`,
  `anzahlSeiten` → `pageCount`, `gesamtZeichen` → `totalChars`,
  `begruendung` → `rationale`, `modell` → `model`,
  `perspektive` → `perspective`, `uebergreifendeThemen` → `crossCuttingTopics`,
  `aktion` → `action`, `zielTyp`/`zielId`/`zielCode`/`zielTitel`/`zielPfad` →
  `targetType` / `targetId` / `targetCode` / `targetTitle` / `targetPath`,
  `zusammenfassung` → `summary`, `dokumentId` → `documentId`,
  `vorschlagId` → `suggestionId`.
- Tables: `dokumente` → `documents`, `vorschlaege` → `suggestions`.

Keep glossary tables/columns: `lehrplan_versionen`, `kompetenzen`,
`kompetenzbereiche`, `anwendungsbereiche`, `materialien`, `material_chunks`,
`kompetenz_id`, `material_id`, `schulstufe`, etc.

### 2. Wire JSON payloads + API route paths

After (1), update every `NextResponse.json({...})` and Zod schema to use
the new English keys, plus rename the German route segments where they
aren't glossary:

- `/api/dokumente` → `/api/documents`
- `/api/dokumente/[id]/vorschlaege` → `/api/documents/[id]/suggestions`
- `/api/materialien/[id]/uebersicht` → `/api/materials/[id]/overview`
  (glossary `Material` is German, but English plural `materials` is fine
  for the route segment — bikeshed at rename time)

Keep glossary segments: `/api/kompetenzen`, `/api/kompetenzbereiche`,
`/api/anwendungsbereiche`, `/api/lehrplaene`.

### 3. Enum / status string values

Currently used over the wire and in the DB:

- suggestion status `"offen" | "akzeptiert" | "abgelehnt"` →
  `"open" | "accepted" | "rejected"`
- decide-suggestion action `"akzeptieren" | "ablehnen" | "zuruecksetzen"` →
  `"accept" | "reject" | "reset"`
- document type `"ordner" | "seite" | "pdf"` → `"folder" | "page" | "file"`
  (the `pdf` value is misleadingly named; it really means "uploaded file")

Each requires a data migration plus updates in API + UI.

### 4. Shared workspace types and component-internal helpers

- `lib/workspace/types.ts`: `DokumentKnoten` → `DocumentNode`,
  `DokumentTyp` → `DocumentType`, `OffenerTab` → `OpenTab`.
- `components/workspace/workspace-context.tsx`: tab discriminator
  `kind: "dokument" | "klasse" | "bereich" | "kompetenz" | "anwendungsbereich"`
  — change `"dokument"` to `"document"`; the rest are glossary, keep them.
  Plus `dokumentTabKey` → `documentTabKey`.
- `components/workspace/workspace-frame.tsx` props: `baum` → `tree`,
  `benutzerName` → `userName`, `initialDokumentId` → `initialDocumentId`
  (and the call site in `app/(app)/workspace/layout.tsx`).

### 5. File renames

After (4), rename component files where they aren't glossary:

- `components/workspace/link-vorschlaege.tsx` → `link-suggestions.tsx`
- `components/workspace/material-uebersicht.tsx` → `material-overview.tsx`

Keep the glossary-named files: `lehrplan-backlinks.tsx`,
`kompetenz-tab-view.tsx`, `bereich-tab-view.tsx`,
`anwendungsbereich-tab-view.tsx`, `klasse-tab-view.tsx`,
`material-linker.tsx`.

### 6. Leftover comments / minor locals

`lib/jobs/`, `lib/extraction/`, `lib/storage/`, `lib/web/`, and `tests/`
still have stray German comments and a few German local variables. Sweep
them in the same pass as (1).

### 7. Out of scope

`services/extractor/` (Python) keeps the contract field names
`seitenzahl`, `abschnitt`, etc., per `CLAUDE.md` — these are part of the
extractor↔worker contract, not user-facing JSON.
