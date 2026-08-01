"""AI learner profile helpers — structured intake for personalized roadmaps."""

from __future__ import annotations

from typing import Any


ABILITY_LABELS = ("never", "few_words", "simple", "comfortable")
CONFIDENCE_LABELS = ("none", "low", "medium", "high")

GOAL_KEYS = [
    "speak_everyday",
    "read_texts",
    "write_tibetan",
    "classical_grammar",
    "buddhist_scriptures",
    "conversational",
    "exams",
    "pronunciation",
    "travel",
    "teach",
    "research",
    "other",
]

INTEREST_KEYS = [
    "daily_conversation",
    "family",
    "travel",
    "food",
    "religion",
    "buddhism",
    "news",
    "stories",
    "childrens_books",
    "literature",
    "business",
    "medicine",
    "technology",
    "culture",
    "history",
    "songs",
    "poetry",
]

STYLE_KEYS = [
    "videos",
    "reading",
    "speaking",
    "games",
    "stories",
    "flashcards",
    "writing",
    "ai_tutor",
    "audio",
]

CHALLENGE_KEYS = [
    "forget_vocabulary",
    "grammar_confusing",
    "reading_difficult",
    "speaking_confidence",
    "pronunciation",
    "memorization",
    "no_partner",
    "motivation",
]

MOTIVATION_KEYS = [
    "family",
    "religion",
    "school",
    "work",
    "travel",
    "personal",
    "research",
    "teaching",
]

ALPHABET_KEYS = [
    "vowels",
    "consonants",
    "prefixes",
    "suffixes",
    "stacks",
    "silent_letters",
]

PRONUNCIATION_KEYS = [
    "read_aloud",
    "identify_tones",
    "pronounce_stacks",
    "distinguish_sounds",
]

GRAMMAR_KEYS = [
    "sentence_structure",
    "particles",
    "honorific",
    "verbs",
    "tenses",
    "case_markers",
]


def empty_learner_profile() -> dict[str, Any]:
    return {
        "goals": [],
        "goal_other": "",
        "tibetan_variety": "",
        "native_language": "",
        "native_language_other": "",
        "ability": {
            "listening": None,
            "speaking": None,
            "reading": None,
            "writing": None,
        },
        "scripts": [],
        "alphabet": [],
        "grammar_confidence": {k: None for k in GRAMMAR_KEYS},
        "pronunciation": [],
        "vocabulary_size": "",
        "interests": [],
        "learning_styles": [],
        "daily_minutes": None,
        "weekly_goal": "",
        "motivations": [],
        "challenges": [],
        "difficulty": "adaptive",
        "lesson_minutes": 15,
        "ai_prefs": {
            "mistake_timing": "immediate",
            "reminders": True,
            "focus": "balanced",
            "cultural_notes": True,
            "gamification": True,
            "feedback_style": "gentle",
        },
        "accessibility": {
            "device": "phone",
            "slow_internet": False,
            "font_size": "normal",
            "high_contrast": False,
            "dyslexia_friendly": False,
            "audio_first": False,
        },
        "placement": None,
    }


def merge_learner_profile(existing: dict[str, Any] | None, patch: dict[str, Any] | None) -> dict[str, Any]:
    base = empty_learner_profile()
    if isinstance(existing, dict):
        base = _deep_merge(base, existing)
    if isinstance(patch, dict):
        base = _deep_merge(base, patch)
    return base


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in overlay.items():
        if key not in out:
            out[key] = value
            continue
        if isinstance(out[key], dict) and isinstance(value, dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def profile_is_complete(name: str | None, profile: dict[str, Any] | None) -> bool:
    if not name or not str(name).strip():
        return False
    p = profile if isinstance(profile, dict) else {}
    goals = p.get("goals") or []
    if not goals:
        return False
    if not p.get("tibetan_variety"):
        return False
    if not p.get("native_language"):
        return False
    ability = p.get("ability") or {}
    for skill in ("listening", "speaking", "reading", "writing"):
        if ability.get(skill) is None:
            return False
    if p.get("daily_minutes") is None:
        return False
    if not p.get("vocabulary_size"):
        return False
    return True


def sync_legacy_columns(profile: dict[str, Any]) -> dict[str, Any]:
    """Derive legacy user columns from the rich profile for older code paths."""
    interests = profile.get("interests") or []
    motivations = profile.get("motivations") or []
    goals = profile.get("goals") or []
    styles = profile.get("learning_styles") or []
    daily = profile.get("daily_minutes")
    return {
        "goal": ", ".join(goals) if goals else None,
        "native_language": profile.get("native_language") or None,
        "likes": ", ".join(interests) if interests else None,
        "favorites": ", ".join(motivations) if motivations else None,
        "learning_style": ", ".join(styles[:3]) if styles else None,
        "daily_study_time": int(daily) if daily not in (None, "", "flexible") else None,
        "school_class": profile.get("tibetan_variety") or None,
        "current_level": _derive_level(profile),
    }


def _derive_level(profile: dict[str, Any]) -> str:
    ability = profile.get("ability") or {}
    vals = [
        ability.get(k)
        for k in ("listening", "speaking", "reading", "writing")
        if isinstance(ability.get(k), int)
    ]
    if not vals:
        return "beginner"
    avg = sum(vals) / len(vals)
    if avg < 1:
        return "beginner"
    if avg < 2:
        return "elementary"
    if avg < 2.7:
        return "intermediate"
    return "advanced"


def profile_for_agents(user: Any) -> dict[str, Any]:
    """Flatten user + learner_profile into the dict agents/prompts expect."""
    lp = merge_learner_profile(getattr(user, "learner_profile", None) or {}, None)
    ability = lp.get("ability") or {}
    return {
        "name": getattr(user, "name", None),
        "age": getattr(user, "age", None),
        "learner_profile": lp,
        "goals": lp.get("goals") or [],
        "goal_other": lp.get("goal_other") or "",
        "tibetan_variety": lp.get("tibetan_variety"),
        "native_language": lp.get("native_language"),
        "native_language_other": lp.get("native_language_other") or "",
        "ability": ability,
        "ability_summary": {
            k: ABILITY_LABELS[v] if isinstance(v, int) and 0 <= v < 4 else "unknown"
            for k, v in ability.items()
        },
        "scripts": lp.get("scripts") or [],
        "alphabet": lp.get("alphabet") or [],
        "grammar_confidence": lp.get("grammar_confidence") or {},
        "pronunciation": lp.get("pronunciation") or [],
        "vocabulary_size": lp.get("vocabulary_size"),
        "interests": lp.get("interests") or [],
        "learning_styles": lp.get("learning_styles") or [],
        "daily_minutes": lp.get("daily_minutes"),
        "weekly_goal": lp.get("weekly_goal") or "",
        "motivations": lp.get("motivations") or [],
        "challenges": lp.get("challenges") or [],
        "difficulty": lp.get("difficulty") or "adaptive",
        "lesson_minutes": lp.get("lesson_minutes") or 15,
        "ai_prefs": lp.get("ai_prefs") or {},
        "accessibility": lp.get("accessibility") or {},
        "placement": lp.get("placement"),
        "derived_level": _derive_level(lp),
        # Legacy aliases used by older prompts / fallbacks
        "school_class": lp.get("tibetan_variety") or getattr(user, "school_class", None),
        "likes": ", ".join(lp.get("interests") or []) or getattr(user, "likes", None),
        "favorites": ", ".join(lp.get("motivations") or []) or getattr(user, "favorites", None),
    }


def format_profile_for_prompt(profile: dict[str, Any]) -> str:
    """Compact prompt block for Melong agents."""
    ability = profile.get("ability_summary") or {}
    grammar = profile.get("grammar_confidence") or {}
    grammar_bits = []
    for key, val in grammar.items():
        if isinstance(val, int) and 0 <= val < 4:
            grammar_bits.append(f"{key}={CONFIDENCE_LABELS[val]}")
    lines = [
        f"Name: {profile.get('name')}",
        f"Age: {profile.get('age') or 'unspecified'}",
        f"Goals: {', '.join(profile.get('goals') or []) or 'unspecified'}"
        + (f" ({profile.get('goal_other')})" if profile.get("goal_other") else ""),
        f"Tibetan variety: {profile.get('tibetan_variety') or 'unspecified'}",
        f"Native language: {profile.get('native_language') or 'unspecified'}"
        + (
            f" ({profile.get('native_language_other')})"
            if profile.get("native_language_other")
            else ""
        ),
        f"Derived level: {profile.get('derived_level')}",
        "Ability — "
        + ", ".join(f"{k}={v}" for k, v in ability.items())
        or "Ability: unknown",
        f"Scripts known: {', '.join(profile.get('scripts') or []) or 'none'}",
        f"Alphabet known: {', '.join(profile.get('alphabet') or []) or 'none'}",
        f"Grammar confidence: {', '.join(grammar_bits) or 'unspecified'}",
        f"Pronunciation skills: {', '.join(profile.get('pronunciation') or []) or 'unspecified'}",
        f"Vocabulary size: {profile.get('vocabulary_size') or 'unspecified'}",
        f"Interests: {', '.join(profile.get('interests') or []) or 'unspecified'}",
        f"Motivations: {', '.join(profile.get('motivations') or []) or 'unspecified'}",
        f"Challenges: {', '.join(profile.get('challenges') or []) or 'unspecified'}",
        f"Learning styles: {', '.join(profile.get('learning_styles') or []) or 'unspecified'}",
        f"Daily minutes: {profile.get('daily_minutes') if profile.get('daily_minutes') is not None else 'flexible'}",
        f"Weekly goal: {profile.get('weekly_goal') or 'unspecified'}",
        f"Preferred difficulty: {profile.get('difficulty')}",
        f"Preferred lesson length: {profile.get('lesson_minutes')} min",
        f"AI prefs: {profile.get('ai_prefs')}",
        f"Accessibility: {profile.get('accessibility')}",
        f"Placement: {profile.get('placement') or 'not taken yet'}",
    ]
    return "\n".join(lines)
