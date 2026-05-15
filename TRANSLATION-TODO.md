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
- Enum / status string values renamed (DB + API + UI):
  suggestion status `offen|akzeptiert|abgelehnt` → `open|accepted|rejected`,
  decide-suggestion action `akzeptieren|ablehnen|zuruecksetzen` →
  `accept|reject|reset`, document type `ordner|seite|pdf` →
  `folder|page|file`. Migration `lib/db/migrations/0010_sloppy_kang.sql`
  uses `ALTER TYPE ... RENAME VALUE` (preserves data).
- Shared workspace types and helpers renamed:
  `DokumentKnoten` → `DocumentNode`, `DokumentTyp` → `DocumentType`,
  `OffenerTab` → `OpenTab`, `dokumentTabKey` → `documentTabKey`, tab
  discriminator `kind: "dokument"` → `"document"` (other kinds stay
  glossary). `WorkspaceFrame` props `baum`/`benutzerName`/`initialDokumentId`
  → `tree`/`userName`/`initialDocumentId`. JSON payload key for the
  document tree fetch (`/api/documents` GET) `baum` → `tree`, and the
  mock-data export `dokumentBaum` → `documentTree`.

## Remaining work

### 1. File renames

After the type renames above, rename component files where they aren't
glossary:

- `components/workspace/link-vorschlaege.tsx` → `link-suggestions.tsx`
- `components/workspace/material-uebersicht.tsx` → `material-overview.tsx`

Keep the glossary-named files: `lehrplan-backlinks.tsx`,
`kompetenz-tab-view.tsx`, `bereich-tab-view.tsx`,
`anwendungsbereich-tab-view.tsx`, `klasse-tab-view.tsx`,
`material-linker.tsx`.

### 2. Leftover comments / minor locals

`lib/jobs/`, `lib/extraction/`, `lib/storage/`, `lib/web/`, and `tests/`
still have stray German comments and a few German local variables.

### 3. Out of scope

`services/extractor/` (Python) keeps the contract field names
`seitenzahl`, `abschnitt`, etc., per `CLAUDE.md` — these are part of the
extractor↔worker contract, not user-facing JSON.
