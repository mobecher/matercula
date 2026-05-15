"""Wrapper around the `unstructured` library producing canonical chunks.

Canonical chunk shape (mirrored on the Node side in `lib/extraction/client.ts`):
    chunkIndex: int           # sequential, 0-based, document reading order
    text: str                 # chunk text (chunk_by_title segments)
    seitenzahl: int | None    # 1-indexed page; PDF only — null for everything else
    abschnitt: str | None     # nearest preceding heading/title

Strategy choice:
    For PDFs we use `strategy="fast"` (pdfminer-based layout, no OCR).
    Scanned PDFs are intentionally unsupported — adding OCR for PDFs would
    pull in tesseract for page-image rasterisation. Image inputs (.png /
    .jpeg / …) DO use OCR via tesseract, because that's the only way to
    extract any text from them at all.

Page numbers:
    Only PDF emits real page numbers. Other formats (DOCX, PPTX slides,
    HTML, …) either have no pages or emit values that don't match what a
    reader would call "page", so we deliberately set `seitenzahl=null` for
    everything except PDF (and `meta.pageCount=null` accordingly).

Adding a new MIME type:
    1. Add the MIME (and any aliases) to ``SUPPORTED_MIMES``.
    2. Verify ``unstructured.partition.auto.partition`` accepts it.
    3. If the format needs an extra system dep (e.g. libreoffice for
       legacy .doc/.ppt/.odt/.rtf/.epub, tesseract for images), add it to
       the Dockerfile.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any

from unstructured.chunking.title import chunk_by_title
from unstructured.partition.auto import partition

# --- supported MIME types -------------------------------------------------
PDF_MIME = "application/pdf"
DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

# Comprehensive list mirroring `unstructured`'s native format support and the
# allow-list in ``lib/extraction/client.ts``. Keep both in sync.
SUPPORTED_MIMES: frozenset[str] = frozenset(
    {
        # PDF
        PDF_MIME,
        # Word
        DOCX_MIME,
        "application/msword",  # .doc — needs libreoffice
        # PowerPoint
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint",  # .ppt — needs libreoffice
        # Excel
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",  # .xls — needs libreoffice
        # OpenDocument
        "application/vnd.oasis.opendocument.text",  # .odt — needs libreoffice
        # Plain / structured text
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/tab-separated-values",
        "text/html",
        "application/xml",
        "text/xml",
        "text/x-rst",
        "text/x-org",
        # Email
        "message/rfc822",  # .eml
        "application/vnd.ms-outlook",  # .msg
        "application/pkcs7-signature",  # .p7s
        # E-Books
        "application/epub+zip",
        # Rich Text
        "application/rtf",
        "text/rtf",
        # Images (OCR via tesseract)
        "image/png",
        "image/jpeg",
        "image/bmp",
        "image/tiff",
        "image/heic",
    }
)

# Target chunk size; chunk_by_title still respects title boundaries, so this
# is an upper bound rather than an exact split.
_TARGET_CHARS = 1500

# Length of the synthesised content excerpt returned as ``summary``.
# This is a heuristic snippet (first chunks of the document, joined and
# truncated) — NOT an LLM summary. The UI uses it to give users a quick
# preview for formats the browser can't render natively (DOCX, PPTX, …).
_SUMMARY_CHARS = 280


class CorruptFileError(Exception):
    """Raised for unparseable / malformed input files (HTTP 422)."""


@dataclass
class Chunk:
    chunk_index: int
    text: str
    seitenzahl: int | None
    abschnitt: str | None


@dataclass
class ExtractionResult:
    chunks: list[Chunk]
    page_count: int | None
    mime_type: str
    summary: str | None


def _element_page(element: Any) -> int | None:
    """Best-effort page number from an unstructured element."""
    meta = getattr(element, "metadata", None)
    if meta is None:
        return None
    page = getattr(meta, "page_number", None)
    if isinstance(page, int) and page > 0:
        return page
    return None


def _partition(file_bytes: bytes, mime_type: str, filename: str | None) -> list[Any]:
    buffer = BytesIO(file_bytes)
    # Per-format kwargs. ``partition`` dispatches based on ``content_type``
    # (or filename sniffing as a fallback); we pass both for robustness.
    kwargs: dict[str, Any] = {
        "file": buffer,
        "content_type": mime_type,
        "metadata_filename": filename,
    }
    if mime_type == PDF_MIME:
        # Skip OCR for PDFs — see module docstring.
        kwargs["strategy"] = "fast"
        kwargs["infer_table_structure"] = False
    elif mime_type.startswith("image/"):
        # Images can only yield text via OCR.
        kwargs["strategy"] = "ocr_only"
    try:
        return partition(**kwargs)
    except Exception as exc:  # noqa: BLE001 — translate to typed error
        raise CorruptFileError(str(exc)) from exc


def _build_summary(chunks: list[Chunk]) -> str | None:
    """Concatenate leading chunks into a short content excerpt."""
    if not chunks:
        return None
    pieces: list[str] = []
    total = 0
    for chunk in chunks:
        text = " ".join(chunk.text.split())
        if not text:
            continue
        pieces.append(text)
        total += len(text)
        if total >= _SUMMARY_CHARS:
            break
    if not pieces:
        return None
    joined = " ".join(pieces)
    if len(joined) <= _SUMMARY_CHARS:
        return joined
    return joined[:_SUMMARY_CHARS].rstrip() + "…"


def extract(
    file_bytes: bytes,
    mime_type: str,
    filename: str | None = None,
) -> ExtractionResult:
    """Run extraction and return the canonical chunk shape.

    Raises:
        CorruptFileError: file could not be parsed.
    """
    elements = _partition(file_bytes, mime_type, filename)

    if not elements:
        raise CorruptFileError("no elements parsed from file")

    try:
        chunked = chunk_by_title(
            elements,
            max_characters=_TARGET_CHARS,
            new_after_n_chars=_TARGET_CHARS,
            combine_text_under_n_chars=200,
        )
    except Exception as exc:  # noqa: BLE001
        raise CorruptFileError(f"chunking failed: {exc}") from exc

    is_pdf = mime_type == PDF_MIME
    chunks: list[Chunk] = []
    for element in chunked:
        text = (getattr(element, "text", None) or "").strip()
        if not text:
            continue
        meta = getattr(element, "metadata", None)
        # `chunk_by_title` records the source heading on each emitted chunk
        # via metadata.parent_id / orig_elements; the orig_elements path is
        # the only reliable carrier across unstructured versions.
        abschnitt = _abschnitt_for_chunk(element)
        seitenzahl: int | None = None
        if is_pdf:
            # Prefer the first non-null page of the chunk's source elements.
            orig = getattr(meta, "orig_elements", None) or []
            for src in orig:
                seitenzahl = _element_page(src)
                if seitenzahl is not None:
                    break
            if seitenzahl is None:
                seitenzahl = _element_page(element)
        chunks.append(
            Chunk(
                chunk_index=len(chunks),
                text=text,
                seitenzahl=seitenzahl if is_pdf else None,
                abschnitt=abschnitt,
            )
        )

    if not chunks:
        raise CorruptFileError("no usable text chunks produced")

    page_count: int | None = None
    if is_pdf:
        # Highest page_number across all source elements.
        max_page = 0
        for element in elements:
            page = _element_page(element)
            if page and page > max_page:
                max_page = page
        page_count = max_page or None

    return ExtractionResult(
        chunks=chunks,
        page_count=page_count,
        mime_type=mime_type,
        summary=_build_summary(chunks),
    )


def _abschnitt_for_chunk(chunk_element: Any) -> str | None:
    """Find the nearest preceding Title in the chunk's source elements."""
    meta = getattr(chunk_element, "metadata", None)
    orig = getattr(meta, "orig_elements", None) if meta else None
    if not orig:
        return None
    for src in orig:
        category = getattr(src, "category", None) or type(src).__name__
        if category == "Title":
            text = (getattr(src, "text", None) or "").strip()
            if text:
                return text
    return None
