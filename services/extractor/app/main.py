"""FastAPI entry point for the matercula extractor service.

Endpoints:
    GET  /health   — liveness probe (used by docker-compose / Fly.io).
    POST /extract  — extract chunks from a base64-encoded PDF or DOCX.

Security model: this service is internal-only. There is no auth — network
isolation (compose private network / Fly 6PN) is the boundary.
"""
from __future__ import annotations

import base64
import binascii
import logging
import os
import time
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .extraction import (
    DOCX_MIME,
    PDF_MIME,
    SUPPORTED_MIMES,
    CorruptFileError,
    extract,
)
from .logging_config import configure_logging

configure_logging()
log = logging.getLogger("extractor")

MAX_FILE_MB = int(os.environ.get("MAX_FILE_MB", "32"))
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

app = FastAPI(title="matercula-extractor", version="0.1.0")


class ExtractRequest(BaseModel):
    fileBase64: str = Field(..., min_length=1)
    mimeType: str = Field(..., min_length=1)
    filename: str = Field(..., min_length=1, max_length=512)


class ChunkOut(BaseModel):
    chunkIndex: int
    text: str
    seitenzahl: int | None
    abschnitt: str | None


class MetaOut(BaseModel):
    pageCount: int | None
    extractor: Literal["unstructured"] = "unstructured"
    mimeType: str
    # Heuristic content excerpt (first chunks of the document, joined and
    # truncated). Used by the UI as a quick preview for formats the browser
    # cannot render natively (DOCX, PPTX, …). Not an LLM summary.
    summary: str | None


class ExtractResponse(BaseModel):
    chunks: list[ChunkOut]
    meta: MetaOut


def _err(status: int, error: str, detail: str | None = None) -> JSONResponse:
    body: dict[str, str] = {"error": error}
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(status_code=status, content=body)


@app.exception_handler(RequestValidationError)
async def _validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return _err(400, "invalid_request", str(exc.errors()))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract")
def post_extract(payload: ExtractRequest) -> JSONResponse:
    started = time.perf_counter()

    if payload.mimeType not in SUPPORTED_MIMES:
        log.info(
            "extract_rejected_mime",
            extra={"fileName": payload.filename, "mimeType": payload.mimeType},
        )
        return _err(415, "unsupported_mime_type", payload.mimeType)

    # Cheap pre-check: base64 expands ~4/3 from source. Reject obviously
    # oversized payloads before decoding fully.
    approx_bytes = (len(payload.fileBase64) * 3) // 4
    if approx_bytes > MAX_FILE_BYTES:
        log.info(
            "extract_rejected_size",
            extra={
                "fileName": payload.filename,
                "approxBytes": approx_bytes,
                "limitBytes": MAX_FILE_BYTES,
            },
        )
        return _err(413, "file_too_large", f"max {MAX_FILE_MB} MB")

    try:
        file_bytes = base64.b64decode(payload.fileBase64, validate=True)
    except (binascii.Error, ValueError) as exc:
        return _err(400, "invalid_base64", str(exc))

    if len(file_bytes) > MAX_FILE_BYTES:
        return _err(413, "file_too_large", f"max {MAX_FILE_MB} MB")
    if len(file_bytes) == 0:
        return _err(400, "empty_file")

    try:
        result = extract(file_bytes, payload.mimeType, payload.filename)
    except CorruptFileError as exc:
        log.info(
            "extract_corrupt",
            extra={
                "fileName": payload.filename,
                "mimeType": payload.mimeType,
                "size": len(file_bytes),
                "reason": str(exc),
            },
        )
        return _err(422, "corrupt_file", str(exc))

    response = ExtractResponse(
        chunks=[
            ChunkOut(
                chunkIndex=c.chunk_index,
                text=c.text,
                seitenzahl=c.seitenzahl,
                abschnitt=c.abschnitt,
            )
            for c in result.chunks
        ],
        meta=MetaOut(
            pageCount=result.page_count,
            mimeType=result.mime_type,
            summary=result.summary,
        ),
    )

    duration_ms = round((time.perf_counter() - started) * 1000, 1)
    log.info(
        "extract_ok",
        extra={
            "fileName": payload.filename,
            "mimeType": payload.mimeType,
            "size": len(file_bytes),
            "chunks": len(response.chunks),
            "pageCount": response.meta.pageCount,
            "durationMs": duration_ms,
        },
    )
    return JSONResponse(status_code=200, content=response.model_dump())


__all__ = ["app", "PDF_MIME", "DOCX_MIME"]
