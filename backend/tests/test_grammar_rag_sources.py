"""Unit tests for grammar RAG source building + cite attachment."""

from __future__ import annotations

from app.agents.grammar_agent import (
    _attach_handbook_cites,
    _build_retrieved_sources,
    _source_cite,
)


def test_build_retrieved_sources_includes_handbook_then_rules():
    retrieved = [
        {
            "source_name": "classical-tibetan-grammar-handbook",
            "title": "Lesson 3",
            "page_number": 12,
            "score": 0.81,
            "content": "Agentive particles follow stem endings…",
        }
    ]
    sources = _build_retrieved_sources(retrieved, include_rules_note=True)
    assert len(sources) == 2
    assert sources[0]["source_name"] == "classical-tibetan-grammar-handbook"
    assert sources[0]["page_number"] == 12
    assert "Agentive" in sources[0]["excerpt"]
    assert sources[1]["source_name"] == "simple-grammar-rules"


def test_build_retrieved_sources_empty_rag_still_has_rules_note():
    sources = _build_retrieved_sources([], include_rules_note=True)
    assert len(sources) == 1
    assert sources[0]["source_name"] == "simple-grammar-rules"


def test_attach_handbook_cites_fills_missing_and_simple_rules():
    retrieved = [
        {
            "source_name": "hopkins-napper-grammar-summaries",
            "page_number": 5,
            "content": "THE EIGHT CASES …",
        }
    ]
    mistakes = [
        {"original": "a", "correction": "b", "source_ref": None},
        {
            "original": "c",
            "correction": "d",
            "source_ref": "simple-rules · yin/red",
        },
        {
            "original": "keep",
            "correction": "kept",
            "source_ref": "classical-tibetan-grammar-handbook · p.9",
        },
    ]
    out = _attach_handbook_cites(mistakes, retrieved)
    cite = _source_cite(retrieved[0])
    assert out[0]["source_ref"] == cite
    assert out[1]["source_ref"] == cite
    assert out[2]["source_ref"] == "classical-tibetan-grammar-handbook · p.9"
