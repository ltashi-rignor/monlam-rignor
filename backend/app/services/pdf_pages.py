"""Render PDF pages to PNG bytes for OCR."""

from __future__ import annotations

from pathlib import Path

import fitz  # PyMuPDF


def render_pdf_pages(
    pdf_path: Path | str,
    *,
    zoom: float = 2.0,
    start_page: int = 1,
    end_page: int | None = None,
) -> list[tuple[int, bytes]]:
    """
    Render PDF pages to PNG.
    Returns list of (1-based page_number, png_bytes).
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    doc = fitz.open(str(path))
    try:
        total = doc.page_count
        first = max(1, int(start_page))
        last = min(total, int(end_page) if end_page else total)
        if first > last:
            return []

        matrix = fitz.Matrix(zoom, zoom)
        out: list[tuple[int, bytes]] = []
        for page_no in range(first, last + 1):
            page = doc.load_page(page_no - 1)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            out.append((page_no, pix.tobytes("png")))
        return out
    finally:
        doc.close()


def pdf_page_count(pdf_path: Path | str) -> int:
    path = Path(pdf_path)
    doc = fitz.open(str(path))
    try:
        return int(doc.page_count)
    finally:
        doc.close()
