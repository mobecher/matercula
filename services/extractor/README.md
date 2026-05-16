# matercula extractor

Internal-only text extraction service. Python 3.12 + FastAPI +
[`unstructured`](https://github.com/Unstructured-IO/unstructured).

This is the **only** Python in the matercula stack. The Node worker calls
this service over HTTP (`lib/extraction/client.ts`); never extract inline
in the worker.

## Supported formats

Mirrors `unstructured`'s native format support. The authoritative MIME
allow-list lives in `app/extraction.py` (`SUPPORTED_MIMES`) and is mirrored
in `lib/extraction/client.ts`:

| Group        | Extensions                                |
|--------------|-------------------------------------------|
| PDF          | `.pdf`                                    |
| Word         | `.doc`, `.docx`                           |
| PowerPoint   | `.ppt`, `.pptx`                           |
| Excel        | `.xls`, `.xlsx`                           |
| OpenDocument | `.odt`                                    |
| E-Book       | `.epub`                                   |
| Rich Text    | `.rtf`                                    |
| Plain text   | `.txt`, `.md`, `.csv`, `.tsv`             |
| Markup       | `.html`, `.xml`, `.rst`, `.org`           |
| E-mail       | `.eml`, `.msg`, `.p7s`                    |
| Image (OCR)  | `.png`, `.jpeg`, `.bmp`, `.tiff`, `.heic` |

Legacy Office formats (`.doc`, `.ppt`, `.odt`, `.rtf`, `.epub`) require
LibreOffice on the host; image OCR requires Tesseract. Both are installed
in the service's Dockerfile. PDF OCR for scanned PDFs is intentionally
**not** supported — we use `strategy="fast"` for PDFs.

## Endpoints

- `GET /health` → `200 {"status": "ok"}`
- `POST /extract` — see canonical chunk shape below.

## Canonical chunk shape (contract)

```json
{
  "chunks": [
    { "chunkIndex": 0, "text": "...", "pageNumber": 3, "section": "Introduction" }
  ],
  "meta": {
    "pageCount": 12,
    "extractor": "unstructured",
    "mimeType": "application/pdf",
    "summary": "Short content preview …"
  }
}
```

- `pageNumber` and `meta.pageCount` are **only** populated for PDFs.
  Every other format (DOCX, PPTX, HTML, e-mail, images, …) reports `null`.
- `meta.summary` is a heuristic content excerpt (first chunks joined and
  truncated). It is **not** an LLM summary; it exists so the UI can show
  a quick preview for formats the browser cannot render natively.

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
