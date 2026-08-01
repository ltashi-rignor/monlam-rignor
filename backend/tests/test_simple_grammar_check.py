"""Tests for deterministic V1 simple grammar scanner (master guide)."""

from __future__ import annotations

from app.agents.grammar_agent import merge_grammar_mistakes
from app.agents.simple_grammar_check import scan_simple_mistakes

# Planted-error passage from the verified master guide.
SAMPLE = """
བདག་གི་ཉིན་མོ་ཞིག
ང་ནི་སློབ་གྲྭ་བས་ཞིག་རེད། ངའི་མིང་ལ་བསྟན་འཛིན་ལགས་སོ། ང་ལོ་
བཅུ་བདུན་ཡོད། ང་ལ་དེབ་མང་པོ་འདུག
ཁ་སང་ང་ཁྱིམ་ལས་སློབ་གྲྭར་སོང༌། ལམ་ཁར་ངས་ཁྱོད་ཀྱི་སྤུན་མཆེད་
དང་ཐུག་སོང༌། ཁོང་གིས་ང་ལ་"ཁྱོད་ག་པར་འགྲོ་གི་འདུག" ཞེས་དྲིས། ང་
ལ་"ང་སློབ་གྲྭར་འགྲོ་གི་རེད" ཞེས་ལན་བཏབ།
སློབ་གྲྭའི་ནང་ང་ཚོས་དགེ་རྒན་ཞིག་དང་ཐུག་སོང༌། ཁོང་ནི་དགེ་རྒན་ཞིག་
ཡིན། ཁོང་ལ་དཔེ་ཆ་མང་པོ་ཡིན། དེ་རིང་ཁོང་གིས་ང་ཚོར་སློབ་ཚན་
གསར་པ་ཞིག་བཤད་སོང༌། ང་ཚོའི་དགེ་རྒན་གིས་བོད་ཀྱི་ཆོས་རིག་ལ་
བཤད་པ་ནི་ཧ་ཅང་ཡག་པོ་འདུག་ཟེར།
ཕྱི་དྲོར་ང་ཁྱིམ་སུ་ལོག་སོང༌། ང་ལ་ཞལ་ལག་ཟས་ལ་ཧུང་སོང༌། ནམ་
ལངས་དགུང་ང་ལ་ཉལ་སོང༌།
"""


def test_sample_core_errors_from_master_key():
    mistakes = scan_simple_mistakes(SAMPLE)
    originals = [m["original"] for m in mistakes]
    joined = " | ".join(originals)

    assert any(
        o.startswith("ང་ནི") and ("རེད" in o or "བས" in o) for o in originals
    ), joined
    # Full identity fix must drop agentive བས when རེད is present
    identity = next(m for m in mistakes if m["original"].startswith("ང་ནི"))
    if "རེད" in identity["original"]:
        assert "བ་ཞིག" in identity["correction"]
        assert identity["correction"].endswith("ཡིན")
    assert any("ང་ལོ" in o and o.endswith("ཡོད") for o in originals), joined
    assert any(o.startswith("ང་ལ་") and o.endswith("འདུག") for o in originals), joined
    assert any("ཁྱིམ་ལས" in o for o in originals), joined
    assert any("གི་འདུག" in o and "ཁྱོད" in o for o in originals), joined
    assert any("གི་རེད" in o for o in originals), joined
    assert any(o.startswith("ཁོང་ནི") and "ཡིན" in o for o in originals), joined
    assert any(o.startswith("ཁོང་ལ") and o.endswith("ཡིན") for o in originals), joined
    assert any("རྒན་གིས" in o for o in originals), joined
    assert any("ཁྱིམ་སུ" in o for o in originals), joined

    # Correct forms must not be flagged
    assert not any(o == "བདག་གི" or o.startswith("བདག་གི") for o in originals), joined
    assert not any(o == "ཁོང་གིས" for o in originals), joined
    assert not any("ཁྱོད" in o and o.endswith("འདུག") and "གི་འདུག" not in o for o in originals)


def test_identity_fixes_bas_and_red():
    ms = scan_simple_mistakes("ང་ནི་སློབ་གྲྭ་བས་ཞིག་རེད།")
    assert len(ms) >= 1
    m = ms[0]
    assert "བས" in m["original"]
    assert "རེད" in m["original"]
    assert "བ་ཞིག" in m["correction"]
    assert m["correction"].endswith("ཡིན")
    assert "བས" not in m["correction"]


def test_wrong_agentive_on_meeting():
    ms = scan_simple_mistakes("ལམ་ཁར་ངས་ཁྱོད་ཀྱི་སྤུན་མཆེད་དང་ཐུག་སོང༌།")
    originals = [m["original"] for m in ms]
    assert any(o.startswith("ངས་") and "ཐུག" in o for o in originals), originals
    corr = next(m["correction"] for m in ms if m["original"].startswith("ངས་"))
    assert corr.startswith("ང་")
    assert not corr.startswith("ངས་")


def test_patient_to_agentive_on_answer():
    text = 'ང་ལ་"ང་སློབ་གྲྭར་འགྲོ་གི་རེད" ཞེས་ལན་བཏབ།'
    ms = scan_simple_mistakes(text)
    originals = [m["original"] for m in ms]
    assert any("ལན་བཏབ" in o for o in originals), originals
    ans = next(m for m in ms if "ལན་བཏབ" in m["original"])
    assert ans["correction"].startswith("ངས་")
    # Nested གི་རེད may be its own mistake or folded into the longer span
    assert any("གི་ཡིན" in m["correction"] or "གི་རེད" in m["original"] for m in ms)


def test_ga_ng_take_gi():
    assert scan_simple_mistakes("བདག་གི་ཉིན་མོ་ཞིག") == []
    assert scan_simple_mistakes("ཁོང་གིས་བཤད་སོང༌།") == []
    ms = scan_simple_mistakes("བདག་གྱི་ཁྱིམ། ཁོང་གྱིས་བཤད།")
    originals = [m["original"] for m in ms]
    assert any("བདག་གྱི" in o for o in originals)
    assert any("ཁོང་གྱིས" in o for o in originals)


def test_merge_prefers_fuller_llm_span_over_partial_rule():
    """Claude full བས+རེད fix should replace incomplete rule རེད-only span."""
    rule = [
        {
            "mistake_type": "ཡིན་རེད།",
            "original": "ང་ནི་སློབ་གྲྭ་བས་ཞིག་རེད",
            "correction": "ང་ནི་སློབ་གྲྭ་བས་ཞིག་ཡིན",  # incomplete: left བས
            "explanation": "rule",
            "related_rule": "→ ཡིན",
            "source_ref": "rules",
        }
    ]
    llm = [
        {
            "mistake_type": "ཡིན་རེད།",
            "original": "ང་ནི་སློབ་གྲྭ་བས་ཞིག་རེད",
            "correction": "ང་ནི་སློབ་གྲྭ་བ་ཞིག་ཡིན",  # fuller
            "explanation": "claude",
            "related_rule": "→ ཡིན། བས་མིན།",
            "source_ref": "claude",
        }
    ]
    merged = merge_grammar_mistakes(rule, llm, llm_primary=True)
    assert len(merged) == 1
    assert "བ་ཞིག" in merged[0]["correction"]
    assert "བས" not in merged[0]["correction"]


def test_merge_adds_non_overlapping_rule_gaps():
    llm = [
        {
            "mistake_type": "ཡིན་རེད།",
            "original": "ང་ནི་སློབ་གྲྭ་བ་ཞིག་རེད",
            "correction": "ང་ནི་སློབ་གྲྭ་བ་ཞིག་ཡིན",
            "explanation": "c",
            "related_rule": "r",
            "source_ref": "claude",
        }
    ]
    rule = [
        {
            "mistake_type": "རྣམ་དབྱེ།",
            "original": "རྒན་གིས",
            "correction": "རྒན་གྱིས",
            "explanation": "r",
            "related_rule": "r",
            "source_ref": "rules",
        }
    ]
    merged = merge_grammar_mistakes(rule, llm, llm_primary=True)
    originals = {m["original"] for m in merged}
    assert "ང་ནི་སློབ་གྲྭ་བ་ཞིག་རེད" in originals
    assert "རྒན་གིས" in originals
