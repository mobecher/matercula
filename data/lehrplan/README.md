Lege hier Lehrplan-Dateien als JSON ab.

Empfohlenes Schema pro Datei:

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
