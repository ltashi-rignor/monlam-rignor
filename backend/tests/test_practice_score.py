"""Unit tests for practice answer scoring."""

from __future__ import annotations

from app.api.practice import score_practice_answers


def test_score_normalizes_tsheg_and_spaces():
    exercises = [
        {"id": "e1", "type": "fill_blank", "answer": "ང་ཡིན།"},
        {"id": "e2", "type": "particle_pick", "answer": "གིས"},
    ]
    answers = {"e1": "ང་ ཡིན", "e2": "གིས་"}
    score, results = score_practice_answers(exercises, answers)
    assert score == 100.0
    assert all(r["correct"] for r in results)


def test_score_counts_wrong_and_missing():
    exercises = [
        {"id": "e1", "answer": "ཡིན"},
        {"id": "e2", "answer": "རེད"},
        {"id": "ex-2", "answer": "ཡོད"},
    ]
    answers = {"e1": "ཡིན", "e2": "ཡིན"}
    score, results = score_practice_answers(exercises, answers)
    assert results[0]["correct"] is True
    assert results[1]["correct"] is False
    assert results[2]["correct"] is False
    assert score == round(100 / 3, 1)
