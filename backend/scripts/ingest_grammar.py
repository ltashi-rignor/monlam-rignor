"""Ingest Classical Tibetan Grammar Handbook PDF — one chunk per page."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import get_settings  # noqa: E402
from app.database.session import AsyncSessionLocal, Base, engine  # noqa: E402
from app.models import entities  # noqa: F401, E402
from app.rag.vector_store import get_vector_store  # noqa: E402


def extract_pages(pdf_path: Path) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    pages: list[dict] = []
    for i, page in enumerate(reader.pages, start=1):
        text_content = (page.extract_text() or "").strip()
        if not text_content:
            continue
        pages.append(
            {
                "source_type": "grammar",
                "source_name": "classical-tibetan-grammar-handbook",
                "page_number": i,
                "title": f"Grammar Handbook — page {i}",
                "content": text_content,
                "metadata_json": {"ingest": "page-wise"},
            }
        )
    return pages


async def ingest(pdf_path: Path, batch_size: int = 8) -> None:
    settings = get_settings()
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    pages = extract_pages(pdf_path)
    print(f"Extracted {len(pages)} non-empty pages from {pdf_path}")
    store = get_vector_store()

    async with AsyncSessionLocal() as session:
        await store.clear_source(session, "classical-tibetan-grammar-handbook")
        await session.commit()

    for start in range(0, len(pages), batch_size):
        batch = pages[start : start + batch_size]
        async with AsyncSessionLocal() as session:
            count = await store.upsert_chunks(session, batch)
            await session.commit()
            print(f"Embedded pages {start + 1}-{start + count}")

    print("Ingestion complete.")
    print(f"Embedding model: {settings.embedding_model}")


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pdf",
        type=Path,
        default=settings.grammar_pdf,
    )
    parser.add_argument("--batch-size", type=int, default=4)
    args = parser.parse_args()
    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")
    asyncio.run(ingest(args.pdf, batch_size=args.batch_size))


if __name__ == "__main__":
    main()
