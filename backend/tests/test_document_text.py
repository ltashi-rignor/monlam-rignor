"""Unit tests for homework file text extraction."""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi import HTTPException

from app.services.document_text import extract_text_from_upload


def test_extract_txt_tibetan():
    raw = "ང་སློབ་གྲྭ་ལ་འགྲོ།\n".encode("utf-8")
    text, truncated, kind = extract_text_from_upload(raw, "hw.txt", "text/plain")
    assert kind == "txt"
    assert truncated is False
    assert "སློབ་གྲྭ" in text


def test_extract_docx_minimal():
    # Minimal OOXML package with one paragraph
    document_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ང་སློབ་གྲྭ་ལ་འགྲོ།</w:t></w:r></w:p>
  </w:body>
</w:document>""".encode("utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", document_xml)
        zf.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
        )
    text, truncated, kind = extract_text_from_upload(
        buf.getvalue(), "essay.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert kind == "docx"
    assert truncated is False
    assert "སློབ་གྲྭ" in text


def test_reject_unsupported():
    with pytest.raises(HTTPException) as ei:
        extract_text_from_upload(b"hello", "notes.csv", "text/csv")
    assert ei.value.status_code == 400


def test_reject_empty():
    with pytest.raises(HTTPException) as ei:
        extract_text_from_upload(b"", "empty.txt", "text/plain")
    assert ei.value.status_code == 400
