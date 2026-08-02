"""botok helper + grammar fail-open / normalize tests."""

from __future__ import annotations

from app.agents.simple_grammar_check import (
    normalize_tibetan_text,
    scan_case_particles_botok,
    scan_simple_mistakes,
)
from app.rag.retriever import _grammar_queries
from app.services.botok_tokenize import botok_available, extract_particles

# Sample with wrong agentive particle (gis after na-ending stem).
SAMPLE = (
    "\u0f62\u0f92\u0f53\u0f0b\u0f42\u0f72\u0f66\u0f0b"
    "\u0f56\u0f64\u0f51\u0f0d"
)  # rgan-gis bshad.


def test_normalize_collapses_double_tsheg():
    raw = "\u0f56\u0f40\u0fb2\u0f0b\u0f0b\u0f64\u0f72\u0f66\u0f0b"  # bkra--shis-
    cleaned = normalize_tibetan_text(raw)
    assert "\u0f0b\u0f0b" not in cleaned
    assert cleaned.startswith("\u0f56\u0f40\u0fb2\u0f0b\u0f64\u0f72\u0f66")


def test_botok_case_scan_fail_open_without_pack():
    # Without a dialect pack, botok path returns []; regex still catches the error.
    if not botok_available():
        assert scan_case_particles_botok(SAMPLE) == []
    mistakes = scan_simple_mistakes(SAMPLE)
    gyis = "\u0f42\u0fb1\u0f72\u0f66"
    assert any(gyis in (m.get("correction") or "") for m in mistakes)


def test_extract_particles_fail_open():
    particles = extract_particles(SAMPLE)
    assert isinstance(particles, list)
    if not botok_available():
        assert particles == []


def test_grammar_queries_still_work_without_botok():
    qs = _grammar_queries(SAMPLE)
    assert len(qs) >= 2
    # Particle probe / botok path should surface agentive གིས.
    assert any("\u0f42\u0f72\u0f66" in q for q in qs)
