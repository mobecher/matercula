Lege hier Lehrplan-Dateien als JSON ab.

Die Standard-Quelldatei ist `curriculum.json`. Sie kann mehrere Fächer
enthalten und wird beim Deploy automatisch über das Fly-`release_command`
geladen (`pnpm tsx scripts/seed-curriculum.ts`). Lokal kann der Import
manuell mit `pnpm seed:lehrplan` ausgelöst werden. Der Import ist
idempotent.

Format (vereinfacht):

```jsonc
{
  "<Fachschluessel>": {
    "title": "Anzeigename",
    "years": {
      "1": { "title": "1. Klasse", "competence_areas": [ /* … */ ] }
    }
  }
}
```

Alternatives Detail-Schema pro Datei (für später geplanten Import):

- `schuljahr`: string
- `fach`: string
- `schulstufe`: string
- `gueltigAb`: ISO-8601 Datum
- `gueltigBis`: ISO-8601 Datum oder `null`
- `kompetenzbereiche`: array
  - `code`, `titel`, `beschreibung`, `sortierung`
  - `kompetenzen`: array
    - `code`, `titel`, `beschreibung`, `sortierung`
    - `deskriptoren`: array mit `code`, `text`, `sortierung`
