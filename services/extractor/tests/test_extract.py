from __future__ import annotations

import base64

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _post(client, *, data: bytes, mime: str, filename: str = "f"):
    return client.post(
        "/extract",
        json={
            "fileBase64": base64.b64encode(data).decode("ascii"),
            "mimeType": mime,
            "filename": filename,
        },
    )


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_extract_pdf(client, sample_pdf_bytes):
    res = _post(client, data=sample_pdf_bytes, mime=PDF_MIME, filename="sample.pdf")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["meta"]["mimeType"] == PDF_MIME
    assert body["meta"]["extractor"] == "unstructured"
    assert isinstance(body["meta"]["pageCount"], int)
    assert body["meta"]["pageCount"] >= 1
    assert isinstance(body["meta"]["summary"], str)
    assert body["meta"]["summary"]
    assert len(body["chunks"]) >= 1
    # chunkIndex sequential from 0
    for i, chunk in enumerate(body["chunks"]):
        assert chunk["chunkIndex"] == i
        assert chunk["text"]
        assert chunk["seitenzahl"] is not None
        assert chunk["seitenzahl"] >= 1


def test_extract_docx(client, sample_docx_bytes):
    res = _post(client, data=sample_docx_bytes, mime=DOCX_MIME, filename="sample.docx")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["meta"]["mimeType"] == DOCX_MIME
    # DOCX must report null page count and null seitenzahl per contract.
    assert body["meta"]["pageCount"] is None
    assert isinstance(body["meta"]["summary"], str)
    assert len(body["chunks"]) >= 1
    for chunk in body["chunks"]:
        assert chunk["seitenzahl"] is None


def test_extract_plain_text(client):
    text = (
        b"# Notizen\n\nDas hier ist ein einfacher Text mit mehreren "
        b"Saetzen, der vom Extractor verarbeitet werden soll.\n\n"
        b"Zweite Sektion mit weiterem Inhalt fuer die Pipeline."
    )
    res = _post(client, data=text, mime="text/plain", filename="notizen.txt")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["meta"]["mimeType"] == "text/plain"
    # Non-PDF formats must report null page count.
    assert body["meta"]["pageCount"] is None
    assert isinstance(body["meta"]["summary"], str)
    assert len(body["chunks"]) >= 1
    for chunk in body["chunks"]:
        assert chunk["seitenzahl"] is None


def test_extract_corrupt_pdf(client, corrupt_pdf_bytes):
    res = _post(client, data=corrupt_pdf_bytes, mime=PDF_MIME, filename="corrupt.pdf")
    assert res.status_code == 422, res.text
    body = res.json()
    assert body["error"] == "corrupt_file"
    assert "detail" in body


def test_extract_unsupported_mime(client):
    res = _post(client, data=b"hello world", mime="text/plain", filename="x.txt")
    assert res.status_code == 415
    assert res.json()["error"] == "unsupported_mime_type"


def test_extract_oversized(client, monkeypatch):
    # Build a payload larger than the (monkeypatched) limit, but cheap.
    from app import main as app_main

    monkeypatch.setattr(app_main, "MAX_FILE_BYTES", 1024)
    monkeypatch.setattr(app_main, "MAX_FILE_MB", 0)
    big = b"x" * 4096
    res = _post(client, data=big, mime=PDF_MIME, filename="big.pdf")
    assert res.status_code == 413
    assert res.json()["error"] == "file_too_large"
