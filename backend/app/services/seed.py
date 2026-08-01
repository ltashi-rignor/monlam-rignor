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


CMS_SEED: list[dict] = [
    {
        "kind": "announcement",
        "slug": "welcome-rignor",
        "title_bo": "རིག་ནོར་ལ་བཀྲ་ཤིས་བདེ་ལེགས།",
        "title_en": "Welcome to Rignor",
        "excerpt": "བོད་ཡིག་སློབ་སྦྱོང་གི་སྒོ་འབྱེད།",
        "body": "རིག་ནོར་ནི་བོད་ཡིག་ཀློག་འབྲི་བརྡ་སྤྲོད་དང་རིག་ནུས་དགེ་རྒན་མཉམ་དུ་སློབ་ཆོག་པའི་སློབ་གྲྭ་ཡིན།",
        "sort_order": 1,
    },
    {
        "kind": "announcement",
        "slug": "voice-tutor-live",
        "title_bo": "སྐད་ཆའི་དགེ་རྒན་གསར་པ།",
        "title_en": "Voice tutor is live",
        "excerpt": "སྐད་ནས་སྐད་ཀྱི་གླེང་མོལ།",
        "body": "ད་ནས་རིག་ནུས་དགེ་རྒན་དང་སྐད་ཆ་བྱས་ནས་བོད་ཡིག་སྦྱང་ཆོག",
        "sort_order": 2,
    },
    {
        "kind": "blog",
        "slug": "why-learn-tibetan-script",
        "title_bo": "བོད་ཡིག་ཀློག་འབྲི་སློབ་དགོས་དོན།",
        "title_en": "Why learn the Tibetan script",
        "excerpt": "ཡི་གེ་ནི་སྐད་ཡིག་གི་སྒོ་ཡིན།",
        "body": (
            "བོད་ཡིག་གི་ཀ་ཁ་སློབ་པ་ནི་སྐད་ཆ་ཁོ་ན་མིན། "
            "ཡི་གེ་ཤེས་ན་དཔེ་ཆ་ཀློག་ཐུབ། བརྡ་སྤྲོད་གསལ་པོར་གོ་ཐུབ། "
            "རིག་ནོར་ནང་ཡིག་འབྲུ་རེ་རེ་མཐོང་ནས་ཉན། བྲིས། རྗེས་སུ་མིང་ཚིག་ལ་འགྲོ།"
        ),
        "sort_order": 1,
    },
    {
        "kind": "blog",
        "slug": "particles-made-simple",
        "title_bo": "ཕྲད་སླ་མོར་གོ་བ།",
        "title_en": "Particles made simple",
        "excerpt": "འི་ གི་ ཀྱི་ སོགས་ཀྱི་སྒོ་འབྱེད།",
        "body": (
            "བོད་ཡིག་བརྡ་སྤྲོད་ཀྱི་ཕྲད་ནི་ཚིག་གི་འབྲེལ་བ་སྟོན། "
            "དཔེར་ན་འབྲེལ་སྒྲ་ གི་ གྱི་ ཀྱི་ འི་ ནི་མིང་གཉིས་སྦྲེལ་བྱེད། "
            "རིག་ནོར་གྱི་བརྡ་སྤྲོད་རྩེད་མོ་དང་དགེ་རྒན་གྱིས་དཔེ་དེབ་ལ་བརྟེན་ནས་སློབ།"
        ),
        "sort_order": 2,
    },
    {
        "kind": "blog",
        "slug": "practice-every-day",
        "title_bo": "ཉིན་རེར་ཏོག་ཙམ་སྦྱངས།",
        "title_en": "A little practice every day",
        "excerpt": "དུས་ཚོད་ཐུང་ངུ་ཡང་ཕན་ཐོགས་ཆེ།",
        "body": (
            "ཉིན་རེར་སྐར་མ་བཅུ་བཅོ་ལྔ་ཙམ་ཡིག་འབྲུ་དང་མིང་ཚིག་སྦྱངས་ན་ "
            "ཟླ་གཅིག་ནང་འཕེལ་རྒྱས་མངོན་གསལ་ཡོང་། "
            "རིག་ནོར་གྱི་ལམ་སྟོན་གྱིས་ཁྱེད་རང་གི་འགྲོས་ལ་བསྟུན་ནས་སློབ་ཚན་འགོད།"
        ),
        "sort_order": 3,
    },
    {
        "kind": "blog",
        "slug": "ai-tutor-tips",
        "title_bo": "རིག་ནུས་དགེ་རྒན་ལ་ཇི་ལྟར་དྲིས།",
        "title_en": "How to ask the AI tutor",
        "excerpt": "དྲི་བ་གསལ་པོ་དྲིས་ན་ལན་གསལ་པོ་ཐོབ།",
        "body": (
            "དགེ་རྒན་ལ་དྲི་བ་གཅིག་རེ་གསལ་པོར་དྲིས། "
            "དཔེར་ན་ «ལ་ ཕྲད་ཀྱི་དོན་གང་ཡིན།» "
            "ཡང་ན་ «འདི་བོད་ཡིག་ཏུ་ཇི་ལྟར་བརྗོད།» "
            "སྐད་ཆའི་ཤོག་ལེབ་ནང་སྐད་ནས་ཀྱང་དྲིས་ཆོག"
        ),
        "sort_order": 4,
    },
    {
        "kind": "news",
        "slug": "alphabet-journey-update",
        "title_bo": "ཀ་ཁའི་ལམ་ཡིག་གསར་པ།",
        "title_en": "Alphabet journey update",
        "excerpt": "མཐོང་། ཉན། བྲིས། རྗེས་སུ་རྩེད།",
        "body": "ཡིག་འབྲུ་སྡེ་རེ་རེར་སྒོ་འབྱེད་ནས་སྦྱང་ཆོག་པའི་ལམ་ཡིག་གསར་དུ་བཅུག་ཡོད།",
        "sort_order": 1,
    },
    {
        "kind": "news",
        "slug": "grammar-rag",
        "title_bo": "བརྡ་སྤྲོད་དཔེ་དེབ་དང་མཉམ་དུ།",
        "title_en": "Grammar grounded in the handbook",
        "excerpt": "RAG བརྒྱུད་ནས་དཔེ་དེབ་ལ་བརྟེན།",
        "body": "བརྡ་སྤྲོད་དང་དགེ་རྒན་གྱི་ལན་དག་གིས་དཔེ་དེབ་ཀྱི་ནང་དོན་ལ་བརྟེན་ནས་འགྲེལ་བཤད་བྱེད།",
        "sort_order": 2,
    },
    {
        "kind": "news",
        "slug": "vocab-rain",
        "title_bo": "མིང་ཚིག་ཆར་པ་རྩེད་མོ།",
        "title_en": "Vocab Rain game",
        "excerpt": "ལྷུང་བའི་མིང་ཚིག་ལ་ལན་སྤྲོད།",
        "body": "མིང་ཚིག་ཆར་པ་བརྒྱུད་ནས་དོན་དང་བོད་ཡིག་མགྱོགས་པོར་སྦྱང་ཆོག",
        "sort_order": 3,
    },
    {
        "kind": "faq",
        "slug": "is-rignor-free",
        "title_bo": "རིག་ནོར་རིན་མེད་ཡིན་ནམ།",
        "title_en": "Is Rignor free?",
        "excerpt": None,
        "body": "ད་ལྟའི་སློབ་བྱེད་ཁག་མང་ཆེ་བ་རིན་མེད་ཏུ་སྤྱོད་ཆོག ཁ་བྲལ་གྱི་ཞབས་ཞུ་གསར་པ་ཡོང་སྐབས་གསལ་བསྒྲགས་བྱེད།",
        "sort_order": 1,
    },
    {
        "kind": "faq",
        "slug": "need-account",
        "title_bo": "ཐོ་འགོད་དགོས་སམ།",
        "title_en": "Do I need an account?",
        "excerpt": None,
        "body": "དྲ་ངོས་སྤྱི་པ་ཀློག་པར་ཐོ་འགོད་མི་དགོས། སློབ་སྦྱོང་དང་ཁྱེད་རང་གི་འཕེལ་རིམ་སྤྱོད་པར་གློག་རྡུལ་ཨང་གིས་ཐོ་འགོད་བྱོས།",
        "sort_order": 2,
    },
    {
        "kind": "faq",
        "slug": "how-login",
        "title_bo": "ཇི་ལྟར་ནང་འཛུལ།",
        "title_en": "How do I sign in?",
        "excerpt": None,
        "body": "གློག་རྡུལ་ཨང་བཀོད་ནས་ཨང་གྲངས་ཐུང་ངུ་ཞིག་འབྱོར། དེ་བཀོད་ནས་ནང་འཛུལ་ཐུབ། གསང་ཚིག་མི་དགོས།",
        "sort_order": 3,
    },
    {
        "kind": "faq",
        "slug": "dialects",
        "title_bo": "སྐད་ལུགས་གང་འདྲ་ཡོད།",
        "title_en": "Which dialects / voices?",
        "excerpt": None,
        "body": "སྐད་ཀྱི་དགེ་རྒན་ལ་ལྷ་ས། ཨ་མདོ། ཁམས་བཅས་ཀྱི་སྐད་གདངས་ཡོད། བརྡ་སྤྲོད་ནི་སློབ་གྲྭའི་བོད་ཡིག་ལ་གཙོ་བོར་བརྟེན།",
        "sort_order": 4,
    },
    {
        "kind": "faq",
        "slug": "beginners",
        "title_bo": "གསར་བུ་ལ་འཚམ་པ་ཡིན་ནམ།",
        "title_en": "Is it for beginners?",
        "excerpt": None,
        "body": "ཡིན། ཀ་ཁ་ནས་འགོ་རྩོམ། རྗེས་སུ་མིང་ཚིག་དང་བརྡ་སྤྲོད། རྩོམ་ཡིག་བཅས་ལ་འཕེལ།",
        "sort_order": 5,
    },
    {
        "kind": "faq",
        "slug": "mobile",
        "title_bo": "ཁ་པར་ནང་སྤྱོད་ཆོག་གམ།",
        "title_en": "Does it work on mobile?",
        "excerpt": None,
        "body": "ཆོག དྲ་ངོས་ནི་ཁ་པར་དང་གློག་ཀླད་གཉིས་ཀར་འཚམ་པར་བཟོས་ཡོད།",
        "sort_order": 6,
    },
    {
        "kind": "faq",
        "slug": "grammar-source",
        "title_bo": "བརྡ་སྤྲོད་ག་ནས་ཡོང་།",
        "title_en": "Where does grammar come from?",
        "excerpt": None,
        "body": "བརྡ་སྤྲོད་འགྲེལ་བཤད་ཁག་གཅིག་ནི་དཔེ་དེབ་ (RAG) ལ་བརྟེན་ནས་འབྱུང་། དེས་སྲོལ་རྒྱུན་གྱི་བོད་ཡིག་བརྡ་སྤྲོད་ལ་གཞི་བཙུགས།",
        "sort_order": 7,
    },
    {
        "kind": "faq",
        "slug": "contact-team",
        "title_bo": "འབྲེལ་གཏུག་ཇི་ལྟར་བྱ།",
        "title_en": "How do I contact you?",
        "excerpt": None,
        "body": "འབྲེལ་གཏུག་ཤོག་ལེབ་ནས་འཕྲིན་ཐུང་གཏོང་རོགས། ང་ཚོས་ཀློག་ནས་ལན་སྤྲོད་རྒྱུ་ཡིན།",
        "sort_order": 8,
    },
]


async def seed_cms_content() -> None:
    """Idempotent seed of public CMS posts."""
    from datetime import datetime, timezone

    from app.models.entities import CmsPost

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(CmsPost.id).limit(1))
        if existing.scalar_one_or_none():
            return
        now = datetime.now(timezone.utc)
        for item in CMS_SEED:
            session.add(
                CmsPost(
                    kind=item["kind"],
                    slug=item["slug"],
                    title_bo=item["title_bo"],
                    title_en=item.get("title_en"),
                    excerpt=item.get("excerpt"),
                    body=item.get("body") or "",
                    published=True,
                    published_at=now,
                    sort_order=int(item.get("sort_order") or 0),
                )
            )
        await session.commit()
