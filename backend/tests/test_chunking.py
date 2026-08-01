"""Tests for Tibetan RAG chunking."""

from __future__ import annotations

from app.rag.chunking import chunk_tibetan


def test_short_stays_one_chunk():
    text = "ང་སློབ་གྲྭ་ལ་འགྲོ།"
    assert chunk_tibetan(text) == [text]


def test_splits_on_shad():
    parts = [f"ཚིག་{i}།" + ("ཡིག་འབྲུ་ " * 40) for i in range(6)]
    text = " ".join(parts)
    chunks = chunk_tibetan(text, max_chars=200, min_chars=40)
    assert len(chunks) >= 2
    assert all(chunks)
    assert "".join(c.replace(" ", "") for c in chunks).find("ཚིག་0") >= 0 or any(
        "ཚིག་0" in c for c in chunks
    )
