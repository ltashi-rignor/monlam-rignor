"""OCR + embed a scanned grammar PDF into the grammar RAG store.

Renders each page with PyMuPDF → Monlam OCR → Tibetan chunks → BGE-M3 embeddings.

Examples:

  cd backend
  # Hopkins / Napper summaries
  ../.venv/bin/python scripts/ingest_grammar_ocr.py \\
      --pdf ../secon-grammer.pdf \\
      --source-name hopkins-napper-grammar-summaries

  # Classical handbook (TLAN 101)
  ../.venv/bin/python scripts/ingest_grammar_ocr.py \\
      --pdf ../classical-tibetan-grammar-handbook_compress.pdf \\
      --source-name classical-tibetan-grammar-handbook

  ../.venv/bin/python scripts/ingest_grammar_ocr.py --reuse-ocr --source-name classical-tibetan-grammar-handbook
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings  # noqa: E402
from app.database.session import AsyncSessionLocal, Base, engine  # noqa: E402
from app.models import entities  # noqa: F401, E402
from app.rag.chunking import chunk_tibetan  # noqa: E402
from app.rag.vector_store import get_vector_store  # noqa: E402
from app.services.ocr import ocr_single_page  # noqa: E402
from app.services.pdf_pages import pdf_page_count, render_pdf_pages  # noqa: E402

SOURCE_PRESETS: dict[str, dict[str, str]] = {
    "secon-grammer.pdf": {
        "source_name": "hopkins-napper-grammar-summaries",
        "title": "Grammar Summaries for Tibetan (Hopkins & Napper)",
    },
    "classical-tibetan-grammar-handbook_compress.pdf": {
        "source_name": "classical-tibetan-grammar-handbook",
        "title": "Classical Tibetan Grammar Handbook (TLAN 101)",
    },
    "classical-tibetan-grammar-handbook.pdf": {
        "source_name": "classical-tibetan-grammar-handbook",
        "title": "Classical Tibetan Grammar Handbook (TLAN 101)",
    },
}


def _preset_for_pdf(pdf_path: Path) -> dict[str, str]:
    return SOURCE_PRESETS.get(
        pdf_path.name,
        {
            "source_name": pdf_path.stem.replace(" ", "-").lower(),
            "title": pdf_path.stem,
        },
    )


def _parse_pages(spec: str | None, total: int) -> tuple[int, int]:
    if not spec:
        return 1, total
    spec = spec.strip()
    if "-" in spec:
        a, b = spec.split("-", 1)
        return max(1, int(a)), min(total, int(b))
    n = int(spec)
    return n, n


def _cache_paths(cache_root: Path, source_name: str, page_no: int) -> tuple[Path, Path]:
    page_dir = cache_root / source_name
    page_dir.mkdir(parents=True, exist_ok=True)
    return page_dir / f"page-{page_no:03d}.png", page_dir / f"page-{page_no:03d}.txt"


async def ocr_page(
    page_no: int,
    png: bytes,
    cache_root: Path,
    source_name: str,
    *,
    reuse_ocr: bool,
    force_ocr: bool,
) -> str:
    png_path, txt_path = _cache_paths(cache_root, source_name, page_no)
    if not force_ocr and reuse_ocr and txt_path.exists():
        text_content = txt_path.read_text(encoding="utf-8").strip()
        if text_content:
            print(f"  page {page_no}: reuse OCR cache ({len(text_content)} chars)")
            return text_content

    png_path.write_bytes(png)
    try:
        text_content = await ocr_single_page(
            png,
            filename=f"page-{page_no:03d}.png",
            content_type="image/png",
            lang_hint="bo",
        )
    except HTTPException as exc:
        raise RuntimeError(f"OCR failed on page {page_no}: {exc.detail}") from exc

    text_content = (text_content or "").strip()
    txt_path.write_text(text_content + ("\n" if text_content else ""), encoding="utf-8")
    print(f"  page {page_no}: OCR ok ({len(text_content)} chars)")
    return text_content


def build_chunks(
    pages: list[tuple[int, str]],
    *,
    source_name: str,
    title: str,
    pdf_name: str,
    max_chars: int = 1200,
) -> list[dict]:
    chunks: list[dict] = []
    for page_no, content in pages:
        if not content.strip():
            continue
        parts = chunk_tibetan(content, max_chars=max_chars)
        for idx, part in enumerate(parts, start=1):
            suffix = f" · part {idx}" if len(parts) > 1 else ""
            chunks.append(
                {
                    "source_type": "grammar",
                    "source_name": source_name,
                    "page_number": page_no,
                    "title": f"{title} — page {page_no}{suffix}",
                    "content": part,
                    "metadata_json": {
                        "ingest": "monlam-ocr",
                        "pdf": pdf_name,
                        "chunk_index": idx,
                        "chunk_count": len(parts),
                    },
                }
            )
    return chunks


async def ingest(
    pdf_path: Path,
    *,
    source_name: str,
    title: str,
    batch_size: int = 4,
    reuse_ocr: bool = False,
    force_ocr: bool = False,
    pages_spec: str | None = None,
    zoom: float = 2.0,
    max_chars: int = 1200,
    clear: bool = True,
) -> None:
    settings = get_settings()
    cache_root = settings.grammar_ocr_cache_dir
    cache_root.mkdir(parents=True, exist_ok=True)

    total = pdf_page_count(pdf_path)
    start_page, end_page = _parse_pages(pages_spec, total)
    print(f"PDF: {pdf_path} ({total} pages) → OCR pages {start_page}-{end_page}")
    print(f"source_name={source_name}")
    print(f"OCR cache: {cache_root / source_name}")

    rendered = render_pdf_pages(
        pdf_path, zoom=zoom, start_page=start_page, end_page=end_page
    )
    ocr_pages: list[tuple[int, str]] = []
    for page_no, png in rendered:
        text_content = await ocr_page(
            page_no,
            png,
            cache_root,
            source_name,
            reuse_ocr=reuse_ocr,
            force_ocr=force_ocr,
        )
        if text_content:
            ocr_pages.append((page_no, text_content))
        else:
            print(f"  page {page_no}: empty OCR — skipped")

    chunks = build_chunks(
        ocr_pages,
        source_name=source_name,
        title=title,
        pdf_name=pdf_path.name,
        max_chars=max_chars,
    )
    print(f"Built {len(chunks)} chunks from {len(ocr_pages)} OCR pages")
    if not chunks:
        raise SystemExit("No OCR text to embed")

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    store = get_vector_store()
    if clear:
        async with AsyncSessionLocal() as session:
            await store.clear_source(session, source_name)
            await session.commit()
            print(f"Cleared previous embeddings for source={source_name}")

    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        async with AsyncSessionLocal() as session:
            count = await store.upsert_chunks(session, batch)
            await session.commit()
            print(f"Embedded chunks {start + 1}-{start + count}")

    print("Ingestion complete.")
    print(f"source_type=grammar source_name={source_name}")
    print(f"Embedding model: {settings.embedding_model}")


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--pdf",
        type=Path,
        default=settings.grammar_secondary_pdf,
        help="Scanned grammar PDF to OCR + embed",
    )
    parser.add_argument(
        "--source-name",
        type=str,
        default=None,
        help="knowledge_chunks.source_name (auto from PDF filename if omitted)",
    )
    parser.add_argument(
        "--title",
        type=str,
        default=None,
        help="Human title stored on chunks",
    )
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--pages", type=str, default=None, help="e.g. 1-3 or 5")
    parser.add_argument("--zoom", type=float, default=2.0, help="Render scale for OCR")
    parser.add_argument("--max-chars", type=int, default=1200)
    parser.add_argument(
        "--reuse-ocr",
        action="store_true",
        help="Reuse cached page-*.txt from previous OCR runs",
    )
    parser.add_argument(
        "--force-ocr",
        action="store_true",
        help="Re-OCR even if cache exists",
    )
    parser.add_argument(
        "--no-clear",
        action="store_true",
        help="Do not delete existing chunks for this source before insert",
    )
    args = parser.parse_args()
    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    preset = _preset_for_pdf(args.pdf)
    source_name = args.source_name or preset["source_name"]
    title = args.title or preset["title"]

    asyncio.run(
        ingest(
            args.pdf,
            source_name=source_name,
            title=title,
            batch_size=args.batch_size,
            reuse_ocr=args.reuse_ocr,
            force_ocr=args.force_ocr,
            pages_spec=args.pages,
            zoom=args.zoom,
            max_chars=args.max_chars,
            clear=not args.no_clear,
        )
    )


if __name__ == "__main__":
    main()
