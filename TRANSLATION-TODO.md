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
- DB schema renamed from German to English (non-glossary), with rename
  migration `lib/db/migrations/0009_lying_joseph.sql` (preserves data).
  All consumers updated.
- API route paths renamed from German to English where non-glossary
  (`/api/documents`, `/api/documents/[id]/suggestions`,
  `/api/materials/[id]/overview`, plus the `/documents` linker subroutes
  on `/api/kompetenzen/[id]` and `/api/anwendungsbereiche/[id]`). Glossary
  segments kept (`kompetenzen`, `kompetenzbereiche`, `anwendungsbereiche`,
  `lehrplaene`).
- JSON payload keys renamed: `vorschlaege`/`vorschlag` → `suggestions`/
  `suggestion`, `aktion` → `action` (request body — value strings stay
  German for now, see section 1), `ziel{Id,Code,Titel,Pfad}` →
  `target{Id,Code,Title,Path}`, `pfad` → `path`,
  `anzahlChunks`/`anzahlSeiten`/`gesamtZeichen` →
  `chunkCount`/`pageCount`/`totalChars`, `vorschau` → `preview`,
  `schluessel` → `keys`, `vorhanden` → `present`.

## Remaining work

### 1. Enum / status string values

Currently used over the wire and in the DB:

- suggestion status `"offen" | "akzeptiert" | "abgelehnt"` →
  `"open" | "accepted" | "rejected"`
- decide-suggestion action `"akzeptieren" | "ablehnen" | "zuruecksetzen"` →
  `"accept" | "reject" | "reset"`
- document type `"ordner" | "seite" | "pdf"` → `"folder" | "page" | "file"`
  (the `pdf` value is misleadingly named; it really means "uploaded file")

Each requires a data migration plus updates in API + UI.

### 2. Shared workspace types and component-internal helpers

- `lib/workspace/types.ts`: `DokumentKnoten` → `DocumentNode`,
  `DokumentTyp` → `DocumentType`, `OffenerTab` → `OpenTab`.
- `components/workspace/workspace-context.tsx`: tab discriminator
  `kind: "dokument" | "klasse" | "bereich" | "kompetenz" | "anwendungsbereich"`
  — change `"dokument"` to `"document"`; the rest are glossary, keep them.
  Plus `dokumentTabKey` → `documentTabKey`.
- `components/workspace/workspace-frame.tsx` props: `baum` → `tree`,
  `benutzerName` → `userName`, `initialDokumentId` → `initialDocumentId`
  (and the call site in `app/(app)/workspace/layout.tsx`).

### 3. File renames

After (2), rename component files where they aren't glossary:

- `components/workspace/link-vorschlaege.tsx` → `link-suggestions.tsx`
- `components/workspace/material-uebersicht.tsx` → `material-overview.tsx`

Keep the glossary-named files: `lehrplan-backlinks.tsx`,
`kompetenz-tab-view.tsx`, `bereich-tab-view.tsx`,
`anwendungsbereich-tab-view.tsx`, `klasse-tab-view.tsx`,
`material-linker.tsx`.

### 4. Leftover comments / minor locals

`lib/jobs/`, `lib/extraction/`, `lib/storage/`, `lib/web/`, and `tests/`
still have stray German comments and a few German local variables.

### 5. Out of scope

`services/extractor/` (Python) keeps the contract field names
`seitenzahl`, `abschnitt`, etc., per `CLAUDE.md` — these are part of the
extractor↔worker contract, not user-facing JSON.
