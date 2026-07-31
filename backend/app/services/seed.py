"""Seed temporary curated content for the Recommendation Agent."""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.database.session import AsyncSessionLocal
from app.models.entities import ContentItem

DEFAULT_CONTENT = [
    {
        "content_type": "grammar",
        "title": "Particles of Classical Tibetan",
        "description": "Core case and discourse particles with handbook-aligned examples.",
        "level": "beginner",
        "topics": ["particles", "grammar"],
        "body": "Study གི་ / གྱི་ / ཀྱི་ / འི་ genitive forms and common case particles.",
    },
    {
        "content_type": "grammar",
        "title": "Honorific Speech Patterns",
        "description": "Respectful verbs and nouns used in formal Tibetan.",
        "level": "intermediate",
        "topics": ["honorifics", "register"],
        "body": "Practice pairing honorific verbs with appropriate subjects and objects.",
    },
    {
        "content_type": "reading",
        "title": "The Clever Rabbit — Graded Story",
        "description": "Short graded reading for early intermediate learners.",
        "level": "beginner",
        "topics": ["stories", "animals"],
        "body": "A short folk-style narrative written with high-frequency vocabulary.",
    },
    {
        "content_type": "reading",
        "title": "Letter from Lhasa",
        "description": "Epistolary reading focusing on connective particles.",
        "level": "intermediate",
        "topics": ["letters", "connectives"],
        "body": "Read and annotate connective structures in a modern letter style.",
    },
    {
        "content_type": "video",
        "title": "Alphabet Stroke Order Walkthrough",
        "description": "Video lesson covering Uchen letter formation.",
        "level": "beginner",
        "topics": ["alphabet", "writing"],
        "url": "https://example.com/tibetan-alphabet",
    },
    {
        "content_type": "video",
        "title": "Everyday Conversations: Market Dialogues",
        "description": "Spoken Tibetan dialogues for listening practice.",
        "level": "intermediate",
        "topics": ["speaking", "listening"],
        "url": "https://example.com/market-dialogues",
    },
    {
        "content_type": "story",
        "title": "Moon Over the Plateau",
        "description": "Literary short story with glossed vocabulary.",
        "level": "advanced",
        "topics": ["literature", "vocabulary"],
        "body": "A contemporary short story for advanced reading fluency.",
    },
    {
        "content_type": "grammar",
        "title": "Verb Endings and Evidentiality",
        "description": "Finite verb morphology and speaker perspective.",
        "level": "advanced",
        "topics": ["verbs", "evidentiality"],
        "body": "Contrast assertive, egophoric, and sensory evidential endings.",
    },
]


async def seed_content_library() -> None:
    settings = get_settings()
    content_path = settings.content_dir
    content_path.mkdir(parents=True, exist_ok=True)
    seed_file = content_path / "library.json"
    if not seed_file.exists():
        seed_file.write_text(json.dumps(DEFAULT_CONTENT, ensure_ascii=False, indent=2))

    items = json.loads(seed_file.read_text())
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(ContentItem.id).limit(1))
        if existing.scalar_one_or_none():
            return
        for item in items:
            session.add(
                ContentItem(
                    content_type=item["content_type"],
                    title=item["title"],
                    description=item.get("description"),
                    level=item.get("level") or "beginner",
                    topics=item.get("topics") or [],
                    url=item.get("url"),
                    body=item.get("body"),
                    metadata_json=item.get("metadata") or {},
                )
            )
        await session.commit()
