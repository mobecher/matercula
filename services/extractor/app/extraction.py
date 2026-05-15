"""Wrapper around the `unstructured` library producing canonical chunks.

Canonical chunk shape (mirrored on the Node side in `lib/extraction/client.ts`):
    chunkIndex: int           # sequential, 0-based, document reading order
    text: str                 # chunk text (chunk_by_title segments)
    seitenzahl: int | None    # 1-indexed page; PDF only, MUST be null for DOCX
    abschnitt: str | None     # nearest preceding heading/title

Strategy choice:
    For PDFs we use `strategy="fast"`. This uses pdfminer for layout/text and
    skips OCR entirely — scanned PDFs are intentionally unsupported in this
    phase, so we do not pull tesseract into the image. `hi_res` would invoke
    detectron2/onnx and pull large model weights.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any

from unstructured.chunking.title import chunk_by_title
from unstructured.partition.docx import partition_docx
from unstructured.partition.pdf import partition_pdf

PDF_MIME = "application/pdf"
DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
SUPPORTED_MIMES = frozenset({PDF_MIME, DOCX_MIME})

# Target chunk size; chunk_by_title still respects title boundaries, so this
# is an upper bound rather than an exact split.
_TARGET_CHARS = 1500


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


def _element_page(element: Any) -> int | None:
    """Best-effort page number from an unstructured element."""
    meta = getattr(element, "metadata", None)
    if meta is None:
        return None
    page = getattr(meta, "page_number", None)
    if isinstance(page, int) and page > 0:
        return page
    return None


def _partition(file_bytes: bytes, mime_type: str) -> list[Any]:
    buffer = BytesIO(file_bytes)
    try:
        if mime_type == PDF_MIME:
            return partition_pdf(
                file=buffer,
                strategy="fast",  # no OCR; pdfminer-based layout
                infer_table_structure=False,
            )
        if mime_type == DOCX_MIME:
            return partition_docx(file=buffer)
    except Exception as exc:  # noqa: BLE001 — translate to typed error
        raise CorruptFileError(str(exc)) from exc
    raise CorruptFileError(f"unsupported mime type for partitioning: {mime_type}")


def extract(file_bytes: bytes, mime_type: str) -> ExtractionResult:
    """Run extraction and return the canonical chunk shape.

    Raises:
        CorruptFileError: file could not be parsed.
    """
    elements = _partition(file_bytes, mime_type)

    if not elements:
        raise CorruptFileError("no elements parsed from file")

    # Track the most recent title element page for each chunk (chunk_by_title
    # collapses these into the resulting chunk metadata, but page-of-first
    # element is most useful for the reader).
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
    for index, element in enumerate(chunked):
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

    return ExtractionResult(chunks=chunks, page_count=page_count, mime_type=mime_type)


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
