# Translation TODO

This file tracks German → English renames that are **deferred** because they
cross the workspace boundary into shared types, API contracts, DB schema, or
UI strings (which intentionally stay German).

The workspace components under `components/workspace/` were translated in the
first pass:

- All German comments → English
- `VerknuepftesDokument` → `LinkedDocument` (in `material-linker.tsx` and consumers)
- `VorschlagAnsicht` → `SuggestionView` (in `link-vorschlaege.tsx`)
- `UebersichtAntwort` → `OverviewResponse`, `VorschauChunk` → `PreviewChunk`
- Component `LinkVorschlaege` → `LinkSuggestions`
- Component `MaterialUebersicht` → `MaterialOverview`
- Local German variables: `fehler` → `error`, `hinweis` → `notice`,
  `loeschen` → `deleting`, `speichern` → `save`, `seiten` → `pages`,
  `vorschlaege` → `suggestions`, `offene` → `openSuggestions`,
  `entschieden` → `decided`, `vorschauOffen` → `previewOpen`,
  `abgebrochen` → `aborted`, `collectSeiten` → `collectPages`

UI strings are intentionally **left in German** per `CLAUDE.md` (e.g.
`aria-label="Verknüpfung entfernen"`, `placeholder="Material suchen…"`,
button labels, error messages shown to teachers).

## Second pass — `lib/` and `app/api/` function & variable names

The second pass renamed every German-named function, exported type, and
local variable in `lib/` and `app/api/` that did **not** cross the
DB-column / wire-payload boundary.

### Renamed (functions / methods)

`lib/workspace/repository.ts`

- `ladeDokumentBaumFuerBenutzer` → `loadDocumentTreeForUser`
- `erstelleDokument` → `createDocument`
- `aktualisiereDokument` → `updateDocument`
- `loescheDokument` → `deleteDocument`
- `baueBaum` → `buildTree`
- `gehoertDokumentZuOwner` → `documentBelongsToOwner`

`lib/workspace/mock-data.ts`

- `findeDokument` → `findDocument`

`lib/curriculum/repository.ts`

- `ladeAlleLehrplaene` → `loadAllLehrplaene`
- `ladeLehrplanBySlug` → `loadLehrplanBySlug`
- `ladeKlasseUebersicht` → `loadKlasseOverview`
- `ladeKompetenzbereichDetail` → `loadKompetenzbereichDetail`
- `ladeKompetenzDetail` → `loadKompetenzDetail`
- `ladeAnwendungsbereichDetail` → `loadAnwendungsbereichDetail`
- `ladeLehrplanSidebar` → `loadLehrplanSidebar`

`lib/curriculum/links.ts`

- `ladeLehrplanLinksFuerDokument` → `loadLehrplanLinksForDocument`
- `ladeDokumenteFuerKompetenz` → `loadDocumentsForKompetenz`
- `ladeDokumenteFuerAnwendungsbereich` → `loadDocumentsForAnwendungsbereich`
- `verknuepfeKompetenz` → `linkKompetenz`
- `loescheKompetenzVerknuepfung` → `deleteKompetenzLink`
- `verknuepfeAnwendungsbereich` → `linkAnwendungsbereich`
- `loescheAnwendungsbereichVerknuepfung` → `deleteAnwendungsbereichLink`
- `syncVorschlagStatusFuerLink` → `syncSuggestionStatusForLink`

`lib/curriculum/vorschlaege.ts`

- `ladeDokumentFuerVorschlaege` → `loadDocumentForSuggestions`
- `ladeKurriculumKatalog` → `loadCurriculumCatalog`
- `ladeVorschlaegeFuerDokument` → `loadSuggestionsForDocument`
- `generiereVorschlaegeFuerDokument` → `generateSuggestionsForDocument`
- `entscheideVorschlag` → `decideSuggestion`
- `mapRowToAnsicht` → `mapRowToView`

`lib/curriculum/import.ts`

- `ladeCurriculumKatalog` → `loadCurriculumCatalogFromDb`
- `importiereCurriculum` → `importCurriculum`

`lib/curriculum/dokument-inhalt.ts`

- `dokumentInhaltFuerAi` → `documentContentForAi`

`lib/materials/repository.ts`

- `erstelleMaterial` → `createMaterial`
- `ladeMaterial` → `loadMaterial`
- `loescheMaterial` → `deleteMaterial`
- `listeMaterialienFuerBenutzer` → `listMaterialsForUser`

`scripts/seed-dokumente.ts`

- `seedFuerBenutzer` → `seedForUser`

`app/api/materialien/route.ts`

- `bereinigeDateiname` → `sanitizeFilename`
- `ERLAUBTE_MIME_TYPES` → `ALLOWED_MIME_TYPES`

`app/api/me/settings/route.ts`

- `maskiere` → `mask`

### Renamed (types / interfaces / classes)

- `ErstelleDokumentEingabe` → `CreateDocumentInput`
- `AktualisiereDokumentEingabe` → `UpdateDocumentInput`
- `ErstelleMaterialEingabe` → `CreateMaterialInput`
- `GenerierungsErgebnis` → `GenerationResult` (fields `grund` → `reason`,
  `fehler` → `error`)
- `VorschlagAnsicht` → `SuggestionView`
- `KurriculumEintrag` → `CurriculumEntry`
- `LehrplanUebersicht` → `LehrplanOverview`
- `KlasseUebersicht` → `KlasseOverview`
- `BenutzerAiSchluessel` → `UserAiKeys`
- `FehlenderProviderSchluessel` → `MissingProviderKey`

### Renamed (local variables in `app/api/`)

- `ergebnis` → `result` (every route)
- `idErgebnis` → `idResult`
- `eingabe` → `input` (lib repository signatures)
- `aktualisiert` → `updated`
- `aenderungen` → `changes`
- `geloescht` → `deleted`
- `sichtbar` → `visible`
- `erstelleSchema` → `createSchema`
- `loeschenSchema` → `deleteSchema`
- `verknuepfungSchema` → `linkSchema`
- `allePagesUndLen` → `pagesAndLengths`
- `seitenSet` → `pageSet`
- `vorschauRows` → `previewRows`
- `basis` → `base`

All German doc/inline comments in touched files were translated to English.

## Remaining (out-of-scope) renames

### File names in `components/workspace/`

None of these were renamed; tracked for a future pass:

- `link-vorschlaege.tsx` → `link-suggestions.tsx`
- `material-uebersicht.tsx` → `material-overview.tsx`

(The file names containing glossary terms — `lehrplan-backlinks.tsx`,
`kompetenz-tab-view.tsx`, `bereich-tab-view.tsx`,
`anwendungsbereich-tab-view.tsx`, `klasse-tab-view.tsx`, `material-linker.tsx`
— stay as-is.)

### Shared workspace types in `lib/workspace/types.ts`

These are imported by `components/workspace/` and elsewhere. Renaming
requires touching every consumer:

- `DokumentKnoten` → `DocumentNode`
- `DokumentTyp` → `DocumentType`
- `OffenerTab` → `OpenTab`
- German JSDoc on `inhalt` and `materialId` (kept as-is for now)

### `WorkspaceFrame` props

`components/workspace/workspace-frame.tsx` is consumed by
`app/(app)/workspace/layout.tsx`:

- prop `baum` → `tree`
- prop `benutzerName` → `userName`
- prop `initialDokumentId` → `initialDocumentId`

### `workspace-context.tsx` keys/helpers

Used internally by sidebar/tab-bar — internal, but pervasive:

- `dokumentTabKey` → `documentTabKey`
- Tab discriminator `kind: "dokument"` → `kind: "document"` (touches every
  branch in `tab-bar.tsx`, `document-view.tsx`, `workspace-context.tsx`)
- `dokumentId` field on the dokument tab → `documentId`

### Cross-cutting (DB / API / glossary-adjacent)

These are intentionally deferred until a wider sweep across `lib/`, `app/api/`,
schema, and migrations. They are part of the wire JSON contract or DB column
names and renaming them requires changing the schema, migrations, and every
consumer at the same time:

- DB columns / wire payload keys still used in API responses and
  `app/api/` routes: `titel`, `beschreibung`, `inhalt`, `inhaltMarkdown`,
  `dateiname`, `notiz`, `vorhanden`, `vorschau`, `schluessel`, `dokument`,
  `dokumente`, `kompetenzen`, `anwendungsbereiche`, `bereich`, `klasse`,
  `kompetenz`, `anwendungsbereich`, `lehrplan`, `vorschlaege`, `vorschlag`,
  `aktion`, `zielTyp`, `zielId`, `zielCode`, `zielTitel`, `zielPfad`,
  `begruendung`, `modell`, `perspektive`, `uebergreifendeThemen`, `pfad`,
  `seitenzahl`, `abschnitt`, `anzahlChunks`, `anzahlSeiten`, `gesamtZeichen`,
  `statusReason`, `dokumentId`, `kompetenzId`, `anwendungsbereichId`,
  `vorschlagId`, `materialId`, `parentId`
- API route paths: `/api/dokumente/...`, `/api/lehrplaene/...`,
  `/api/materialien/...`, `/api/kompetenzbereiche/...`,
  `/api/anwendungsbereiche/...`, `/api/me/settings`, `vorschlaege` sub-routes,
  `dokumente` sub-routes, `uebersicht` sub-route, `lehrplan-links` sub-route
- Status enum values used over the wire: `"offen" | "akzeptiert" | "abgelehnt"`,
  action values `"akzeptieren" | "ablehnen" | "zuruecksetzen"`
- Document type enum value `"pdf"` (legacy name for "any uploaded file"),
  `"seite"`, `"ordner"`

### Other directories not yet touched

- `lib/db/schema/` and DB migrations (touching this requires a coordinated
  migration of every consumer above)
- `lib/jobs/`, `lib/extraction/`, `lib/storage/`, `lib/web/` (some German
  comments and the occasional German local variable remain)
- `tests/`
- `services/extractor/` (Python, only kept-German fields are the contract
  fields `seitenzahl`, `abschnitt`, etc. — see `CLAUDE.md`)

### Domain glossary — never rename

Per `CLAUDE.md`: `Lehrplan`, `Kompetenzbereich`, `Kompetenz`, `Deskriptor`,
`Schulstufe`, `Material`, `Tag` stay German in code, DB, and API payloads.
