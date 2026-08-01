"""Extract plain text from learner-uploaded homework files."""

from __future__ import annotations

import io
import re
import zipfile
from xml.etree import ElementTree as ET

from fastapi import HTTPException

# Keep in sync with GrammarCheckRequest.text max_length
MAX_TEXT_CHARS = 8000
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB

ALLOWED_EXTENSIONS = {".txt", ".md", ".text", ".pdf", ".docx"}

_WS = re.compile(r"[ \t]+\n")
_MULTI_NL = re.compile(r"\n{3,}")


def _normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _WS.sub("\n", text)
    text = _MULTI_NL.sub("\n\n", text)
    return text.strip()


def _ext(filename: str | None) -> str:
    name = (filename or "").strip().lower()
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1]


def _from_txt(raw: bytes) -> str:
    for enc in ("utf-8", "utf-16", "utf-16-le", "utf-16-be", "gb18030", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _from_pdf(raw: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw))
    parts: list[str] = []
    for page in reader.pages[:40]:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(parts)


def _from_docx(raw: bytes) -> str:
    """Minimal DOCX text extract via word/document.xml (no python-docx dep)."""
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            xml = zf.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise HTTPException(status_code=400, detail="Invalid .docx file") from exc

    root = ET.fromstring(xml)
    # w:t text nodes; insert newline on w:p
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []
    for p in root.findall(".//w:p", ns):
        texts = [t.text or "" for t in p.findall(".//w:t", ns)]
        line = "".join(texts).strip()
        if line:
            paragraphs.append(line)
    if paragraphs:
        return "\n".join(paragraphs)
    # Fallback: any text
    return "\n".join(t for t in root.itertext() if t and t.strip())


def clamp_extracted_text(text: str) -> tuple[str, bool]:
    text = _normalize(text or "")
    if not text:
        raise HTTPException(
            status_code=400,
            detail="No readable text found in this file",
        )
    truncated = len(text) > MAX_TEXT_CHARS
    if truncated:
        text = text[:MAX_TEXT_CHARS]
    return text, truncated


def extract_text_from_upload(
    raw: bytes,
    filename: str | None,
    content_type: str | None = None,
) -> tuple[str, bool, str]:
    """
    Returns (text, truncated, kind) where kind is txt|pdf|docx.
    Raises HTTPException on bad input. Images must use Monlam OCR instead.
    """
    from app.services.ocr import is_image_upload

    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if is_image_upload(filename, content_type):
        raise HTTPException(
            status_code=400,
            detail="Images must use Monlam OCR — upload via the image flow",
        )
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 2 MB)")

    ext = _ext(filename)
    ctype = (content_type or "").lower()

    if ext in {".txt", ".md", ".text"} or ctype in {
        "text/plain",
        "text/markdown",
        "text/x-markdown",
    }:
        kind = "txt"
        text = _from_txt(raw)
    elif ext == ".pdf" or "pdf" in ctype:
        kind = "pdf"
        try:
            text = _from_pdf(raw)
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail="Could not read PDF text"
            ) from exc
    elif ext == ".docx" or "wordprocessingml" in ctype:
        kind = "docx"
        text = _from_docx(raw)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use .txt, .md, .docx, .pdf, or images (jpg/png)",
        )

    text, truncated = clamp_extracted_text(text)
    return text, truncated, kind
