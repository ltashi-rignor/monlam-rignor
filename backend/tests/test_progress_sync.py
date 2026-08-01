"""Tests for deterministic progress sync."""

from __future__ import annotations

from types import SimpleNamespace

from app.services.progress_sync import (
    _baseline_scores,
    merge_practice_stats_into_graph,
    practice_stats_from_rows,
)


def test_practice_stats_from_rows():
    rows = [
        SimpleNamespace(completed=True, score=80),
        SimpleNamespace(completed=True, score=60),
        SimpleNamespace(completed=False, score=None),
    ]
    stats = practice_stats_from_rows(rows)
    assert stats["completed_count"] == 2
    assert stats["last_score"] == 80
    assert stats["avg_score"] == 70.0


def test_baseline_scores_rise_with_practice():
    seeded = _baseline_scores(
        practice_stats={"completed_count": 3, "avg_score": 70, "last_score": 80},
        essay_avg=None,
        mistake_count=5,
        modules={"mastered_letters": 8, "mastered_words": 4, "completed_lessons": 1, "xp": 40},
    )
    assert seeded["grammar_score"] > 20
    assert seeded["vocabulary_score"] > 10
    assert seeded["reading_score"] > 10


def test_merge_keeps_practice_stats():
    graph = merge_practice_stats_into_graph(
        {"strengths": ["ཡག"], "practice_stats": {"completed_count": 0}},
        {"completed_count": 2, "avg_score": 75, "last_score": 80},
        {"xp": 10},
    )
    assert graph["practice_stats"]["completed_count"] == 2
    assert graph["activity"]["xp"] == 10
    assert graph["strengths"] == ["ཡག"]
