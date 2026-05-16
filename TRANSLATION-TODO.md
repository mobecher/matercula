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
- Component files renamed: `link-vorschlaege.tsx` → `link-suggestions.tsx`,
  `material-uebersicht.tsx` → `material-overview.tsx`. Glossary-named
  files kept (`lehrplan-backlinks.tsx`, `kompetenz-tab-view.tsx`,
  `bereich-tab-view.tsx`, `anwendungsbereich-tab-view.tsx`,
  `klasse-tab-view.tsx`, `material-linker.tsx`).
- Leftover comments and minor locals translated. Notable renames:
  `lib/curriculum/vorschlaege.ts` → `suggestions.ts`;
  `lib/curriculum/dokument-inhalt.ts` → `document-content.ts`;
  `tests/node/dokument-inhalt.test.ts` → `document-content.test.ts`;
  `scripts/seed-dokumente.ts` → `seed-documents.ts`;
  `package.json` script `seed:dokumente` → `seed:documents`.
  Identifiers: `MAX_VORSCHLAEGE` → `MAX_SUGGESTIONS`,
  `MAX_DOKUMENT_ZEICHEN` → `MAX_DOCUMENT_CHARS`,
  `llmAntwortSchema` → `llmResponseSchema`, `katalog`/`katalogText` →
  `catalog`/`catalogText`, `modellName` → `modelName`,
  `DokumentInhaltOptions` → `DocumentContentOptions`,
  `EntscheidungsEingabe`/`EntscheidungsErgebnis` → `DecisionInput`/
  `DecisionResult`, `ImportAuswahl`/`ImportErgebnis` → `ImportSelection`/
  `ImportResult`, `CurriculumKatalog{,Fach,Klasse}` → `CurriculumCatalog{
  ,Subject,Grade}`, `schluessel` → `keys`, `FehlenderProviderSchluessel`
  (class name string) → `MissingProviderKey`, `inhalt` (DocumentNode
  field) → `content`, JSON key `dokument` → `document`, drag MIME
  `matercula-dokument-id` → `matercula-document-id`, repo locals
  `zeilen`/`wurzeln`/`knoten`/`eltern`/`treffer`/`benutzer`/`eingabe`/
  `aktualisiert`/`ausschnitt`/`liste`/`ergebnis(se)` → English equivalents.
  Suggestion reason enum `kein_inhalt`/`nicht_unterstuetzt`/`keine_treffer`/
  `ai_fehler` → `no_content`/`unsupported`/`no_matches`/`ai_error`.
  German JSDoc and inline comments translated throughout `lib/curriculum/`,
  `lib/ai/`, `lib/workspace/`, `lib/web/`, `tests/`, and `scripts/`.

  **Intentionally kept German**: LLM system/user prompts and `.describe()`
  field descriptions in `lib/curriculum/suggestions.ts` (the model is
  required to answer in German); the `MissingProviderKey` constructor
  message and other error messages surfaced verbatim in the UI; the
  inline `[Eingebetteter Link: …]` / `[Eingebettetes YouTube-Video: …]`
  markers injected into LLM input by `document-content.ts`.
- Extractor wire contract fields renamed: `seitenzahl` → `pageNumber`,
  `abschnitt` → `section` (TypeScript Zod schema + Pydantic `ChunkOut`).
  Python internals use `page_number` / `section` (snake_case); helper
  `_abschnitt_for_chunk` → `_section_for_chunk`. Node insert site
  (`lib/jobs/tag-material.ts`) and the test fixture
  (`tests/node/extraction-client.test.ts`) updated. Docs (`CLAUDE.md`,
  `services/extractor/README.md`) updated.

## Remaining work

_None. Translation complete._
