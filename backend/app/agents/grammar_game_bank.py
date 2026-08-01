"""Curated grammar quest rounds — loaded from ``content/grammar_game.yaml``."""

from __future__ import annotations

from typing import Any

from app.content.loader import load_yaml


def _data() -> dict[str, Any]:
    return load_yaml("grammar_game")


def get_topics() -> dict[str, dict[str, Any]]:
    topics = _data().get("topics") or {}
    return dict(topics) if isinstance(topics, dict) else {}


def get_rounds_by_topic() -> dict[str, list[dict[str, Any]]]:
    rounds = _data().get("rounds") or {}
    return {str(k): list(v) for k, v in rounds.items()} if isinstance(rounds, dict) else {}


def _resolve_mix(refs: list[Any], bank: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for ref in refs:
        text = str(ref)
        if "." not in text:
            continue
        topic, idx_s = text.split(".", 1)
        try:
            idx = int(idx_s)
        except ValueError:
            continue
        rows = bank.get(topic) or []
        if 0 <= idx < len(rows):
            out.append(dict(rows[idx]))
    return out


def get_game_bank() -> dict[str, list[dict[str, Any]]]:
    bank = get_rounds_by_topic()
    mix_refs = _data().get("mistakes_mix") or []
    mix = _resolve_mix(mix_refs if isinstance(mix_refs, list) else [], bank)
    bank = {**bank, "mistakes": mix or list(bank.get("particles") or [])[:5]}
    bank["default"] = list(bank.get("particles") or [])
    return bank


def normalize_topic(topic: str | None) -> str:
    key = (topic or "particles").strip().lower()
    aliases = {
        "particle": "particles",
        "ཕྲད": "particles",
        "ཕྲད།": "particles",
        "cases": "case",
        "རྣམ་དབྱེ": "case",
        "རྣམ་དབྱེ།": "case",
        "honorifics": "honorific",
        "ཞེ་ས": "honorific",
        "ཞེ་ས།": "honorific",
        "verb": "verbs",
        "བྱ་ཚིག": "verbs",
        "my_mistakes": "mistakes",
        "ངའི་ནོར་འཁྲུལ།": "mistakes",
    }
    key = aliases.get(key, key)
    topics = get_topics()
    bank = get_game_bank()
    if key in topics or key in bank:
        return key
    return "particles"


def fallback_rounds(topic: str) -> list[dict[str, Any]]:
    key = normalize_topic(topic)
    bank = get_game_bank()
    rounds = bank.get(key) or bank.get("default") or []
    return [dict(r) for r in rounds[:5]]


# Back-compat for existing imports
TOPICS = get_topics()
GAME_BANK = get_game_bank()
