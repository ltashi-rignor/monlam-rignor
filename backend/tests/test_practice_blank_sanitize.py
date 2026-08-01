"""Tests for fill-blank prompt sanitization in practice generation."""

from __future__ import annotations

from app.agents.practice_agent import sanitize_fill_blank_prompt, sanitize_practice_exercises


def test_strips_leaked_dug_after_blank():
    prompt = "ང་ལ་དཔེ་ཆ་མང་པོ་_______འདུག"
    fixed = sanitize_fill_blank_prompt(
        prompt,
        options=["ཡོད།", "རེད།", "ཡིན།", "འདུག"],
        answer="ཡོད།",
    )
    assert "འདུག" not in fixed
    assert "______" in fixed
    assert fixed.startswith("ང་ལ་དཔེ་ཆ་མང་པོ་")


def test_strips_leaked_answer_matching_option():
    prompt = "ཁོང་ནི་དགེ་རྒན་ཞིག་______ཡིན"
    fixed = sanitize_fill_blank_prompt(
        prompt,
        options=["ཡིན", "རེད", "ཡོད", "འདུག"],
        answer="རེད",
    )
    assert not fixed.rstrip("།").endswith("ཡིན")
    assert "______" in fixed


def test_sanitize_exercises_payload():
    payload = {
        "title": "སྦྱོང་བརྡར།",
        "exercises": [
            {
                "id": "e1",
                "type": "fill_blank",
                "prompt": "ང་ལ་དཔེ་ཆ་མང་པོ་_______འདུག",
                "options": ["ཡོད།", "རེད།", "ཡིན།", "འདུག"],
                "answer": "ཡོད།",
            }
        ],
    }
    out = sanitize_practice_exercises(payload)
    prompt = out["exercises"][0]["prompt"]
    assert "འདུག" not in prompt.split("______", 1)[-1]
    assert prompt.rstrip().endswith("།") or prompt.rstrip().endswith("______")
