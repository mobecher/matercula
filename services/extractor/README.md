# matercula extractor

Internal-only PDF/DOCX text extraction service. Python 3.12 + FastAPI +
[`unstructured`](https://github.com/Unstructured-IO/unstructured).

This is the **only** Python in the matercula stack. The Node worker calls
this service over HTTP (`lib/extraction/client.ts`); never extract inline
in the worker.

## Endpoints

- `GET /health` → `200 {"status": "ok"}`
- `POST /extract` — see canonical chunk shape below.

## Canonical chunk shape (contract)

```json
{
  "chunks": [
    { "chunkIndex": 0, "text": "...", "seitenzahl": 3, "abschnitt": "Einführung" }
  ],
  "meta": { "pageCount": 12, "extractor": "unstructured", "mimeType": "application/pdf" }
}
```

- `seitenzahl` is **always `null` for DOCX** — Word has no fixed pagination.
- `meta.pageCount` is `null` for DOCX for the same reason.

## Run locally (without Docker)

```bash
cd services/extractor
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload --port 8000
```

## Run tests

```bash
cd services/extractor
pip install -e '.[dev]'
pytest
```

## Test against a sample PDF

```bash
B64=$(base64 -i sample.pdf)
curl -s http://localhost:8000/extract \
  -H 'content-type: application/json' \
  -d "{\"fileBase64\":\"$B64\",\"mimeType\":\"application/pdf\",\"filename\":\"sample.pdf\"}" \
  | jq
```

## Configuration

| env           | default | meaning                         |
|---------------|---------|---------------------------------|
| `MAX_FILE_MB` | `32`    | request size limit (HTTP 413)   |
| `PORT`        | `8000`  | uvicorn bind port (Docker only) |
