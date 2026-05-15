# syntax=docker/dockerfile:1.7
# Multi-stage: build wheels in a fat image, copy into a slim runtime.
# unstructured pulls a lot of native deps; the slim runtime keeps the final
# image lean while still shipping the system libs PDF parsing needs.

FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml ./
# Resolve and pre-build wheels. Using a venv keeps the runtime copy trivial.
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install . \
 # Defensive: if the legacy `pdfminer` package was pulled in transitively
 # it will shadow `pdfminer.six` and break unstructured at import time.
 # Removing it leaves only pdfminer.six (which we pin in pyproject.toml).
 && /opt/venv/bin/pip uninstall -y pdfminer 2>/dev/null || true

# ---------- runtime ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8000 \
    MAX_FILE_MB=32

# System libs grouped by purpose:
#   poppler-utils:                pdfinfo / pdftotext for PDF layout (unstructured).
#   libgl1 / libglib2.0-0:        required by some unstructured rendering paths
#                                  and by tesseract-ocr / pillow.
#   libmagic1:                    file-type sniffing fallback when MIME isn't trusted.
#   tesseract-ocr + -deu:         OCR for image inputs (.png/.jpeg/.tiff/.bmp/.heic).
#                                  We deliberately do NOT enable OCR for PDFs
#                                  (see services/extractor/app/extraction.py).
#   libreoffice (headless):       converts legacy Office formats (.doc/.ppt/.odt/
#                                  .rtf/.epub) before unstructured parses them.
#                                  This is the heaviest dep (~600 MB) — accepted
#                                  trade-off for full-format coverage.
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    libmagic1 \
    tesseract-ocr \
    tesseract-ocr-deu \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 extractor

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY app ./app

USER extractor
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
