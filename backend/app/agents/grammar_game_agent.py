"""Grammar Quest — RAG + Melong game rounds grounded in the handbook."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.grammar_game_bank import fallback_rounds, get_topics, normalize_topic
from app.agents.grammar_rag_rounds import build_rounds_from_rag
from app.rag.retriever import get_retriever
from app.services import prompt_manager as prompts
from app.services.llm import get_llm, melong_is_rate_limited

logger = logging.getLogger(__name__)


def _sources_from_retrieved(retrieved: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "page_number": r.get("page_number"),
            "title": r.get("title") or "བོད་ཡིག་བརྡ་སྤྲོད་དཔེ་དེབ།",
            "source_name": r.get("source_name"),
            "score": float(r["score"]) if r.get("score") is not None else None,
            "excerpt": (r.get("content") or "")[:280],
        }
        for r in retrieved
    ]


def _strip_punct(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch not in "།༎༏༐༑༔ \t\n")


def _option_key(s: str) -> str:
    """Normalize for near-duplicate detection (ignore shad / trailing tsheg)."""
    t = (s or "").strip()
    t = t.replace("།", "").replace("༎", "")
    t = t.rstrip("་").strip()
    return t


def _dedupe_options(options: list[str], answer: str) -> list[str]:
    """Keep distinct choices; prefer the answer's exact form when keys collide."""
    answer_key = _option_key(answer)
    best: dict[str, str] = {}
    order: list[str] = []
    # Prefer putting the answer form first among collisions
    prioritized = ([answer] if answer else []) + [o for o in options if o != answer]
    for opt in prioritized:
        if not opt or opt == "—":
            continue
        key = _option_key(opt)
        if not key:
            continue
        if key not in best:
            best[key] = opt
            order.append(key)
        elif key == answer_key:
            best[key] = answer
    out = [best[k] for k in order]
    return out


_DISTRACTORS_BY_TOPIC: dict[str, list[str]] = {
    "particles": ["པས།", "དང་།", "ནས།", "གིས།", "ཀྱི།", "ལ།"],
    "case": ["ལ", "གིས", "ནས", "ཀྱི", "དང་", "ཡི"],
    "honorific": ["གནང་།", "ཕེབས།", "གསོལ།", "བཞུགས།", "འགྲོ།", "བྱེད།"],
    "verbs": ["ཡིན།", "ཡོད།", "བྱེད།", "འགྲོ།", "བཞིན", "ཟིན"],
    "default": ["ལ།", "ནས།", "གིས།", "དང་།", "ཡིན།", "ཡོད།"],
}


def _pad_distinct_options(options: list[str], answer: str, topic: str = "") -> list[str]:
    pool = list(
        _DISTRACTORS_BY_TOPIC.get(topic)
        or _DISTRACTORS_BY_TOPIC["default"]
    )
    out = _dedupe_options(options, answer)
    ans_key = _option_key(answer)

    def too_similar(opt: str) -> bool:
        k = _option_key(opt)
        if not k:
            return True
        if k == ans_key:
            return False
        # Drop near-copies / substrings of the answer (དགའ་པོ་ vs དགའ་པོ་ཡོད།)
        if ans_key and (k in ans_key or ans_key in k):
            return True
        return False

    out = [o for o in out if not too_similar(o)]
    if answer and ans_key not in {_option_key(o) for o in out}:
        out.insert(0, answer)
    seen = {_option_key(o) for o in out}
    for d in pool:
        if len(out) >= 4:
            break
        k = _option_key(d)
        if not k or k in seen or too_similar(d):
            continue
        out.append(d)
        seen.add(k)
    while len(out) < 4:
        filler = f"—{len(out)}"
        out.append(filler)
    return out[:4]


def _ensure_blank(sentence: str, answer: str) -> str:
    """Hide the answer inside the sentence with a blank marker."""
    if "______" in sentence or "___" in sentence:
        return sentence.replace("___", "______") if "______" not in sentence else sentence
    ans = (answer or "").strip()
    if not ans:
        return sentence
    # Try longest-first variants so we blank the full phrase when possible
    variants = [ans, ans.rstrip("།"), ans.rstrip("་"), _strip_punct(ans)]
    for v in variants:
        if v and v in sentence:
            return sentence.replace(v, "______", 1)
    return sentence


def _normalize_round(item: Any, index: int, *, topic: str = "") -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    rtype = str(item.get("type") or "pick").strip().lower()
    if rtype not in {"spot", "pick"}:
        rtype = "pick"
    sentence = str(item.get("sentence") or "").strip()
    prompt = str(item.get("prompt") or "").strip() or "དྲི་བ་འདི་ལན་ཐོབ།"
    if not sentence:
        return None

    options_raw = item.get("options") or []
    options = [str(o).strip() for o in options_raw if str(o).strip()][:8]
    answer = item.get("answer")
    error_span = str(item.get("error_span") or "").strip()
    answer_s = str(answer if not isinstance(answer, int) else "").strip()

    if rtype == "spot":
        # True spot = wrong form in sentence, and answer is a DIFFERENT correct form.
        same_as_answer = bool(
            error_span
            and answer_s
            and (
                error_span == answer_s
                or _strip_punct(error_span) == _strip_punct(answer_s)
                or answer_s in error_span
                or error_span in answer_s
            )
        )
        if not error_span or error_span not in sentence or same_as_answer:
            rtype = "pick"
            if not options:
                correct = answer_s or error_span or "—"
                options = [correct]
            error_span = ""
        else:
            options = []

    if rtype == "pick":
        if isinstance(answer, int):
            # Resolve index after dedupe using raw list first
            raw_opts = options[:] or ["—", "—", "—", "—"]
            while len(raw_opts) < 4:
                raw_opts.append("—")
            idx = max(0, min(3, answer))
            answer_s = raw_opts[idx]
            answer = answer_s
        else:
            answer = str(answer or "").strip()
            answer_s = answer

        options = _pad_distinct_options(options, answer_s, topic=topic)
        if answer_s and _option_key(answer_s) not in {_option_key(o) for o in options}:
            options[0] = answer_s
        # Canonical answer must match an option exactly
        matched = next(
            (o for o in options if _option_key(o) == _option_key(answer_s)),
            options[0],
        )
        answer = matched
        sentence = _ensure_blank(sentence, answer)
        # Prefer fill-in prompt when we blanked
        if "______" in sentence and "སྟོང" not in prompt and "འདེམས" not in prompt:
            prompt = "སྟོང་ཆར་གང་འཇུག"

    return {
        "id": str(item.get("id") or f"r{index + 1}"),
        "type": rtype,
        "prompt": prompt,
        "sentence": sentence,
        "error_span": error_span if rtype == "spot" else "",
        "options": options if rtype == "pick" else [],
        "answer": str(answer or ""),
        "explanation": str(item.get("explanation") or "").strip(),
        "related_rule": str(item.get("related_rule") or "").strip(),
        "source_ref": str(item.get("source_ref") or "").strip(),
        "handbook_excerpt": str(item.get("handbook_excerpt") or "").strip(),
        "page_number": item.get("page_number"),
    }


def normalize_game_payload(
    raw: dict[str, Any],
    *,
    topic: str,
    retrieved_sources: list[dict[str, Any]],
    source: str = "melong",
) -> dict[str, Any]:
    rounds_raw = raw.get("rounds") if isinstance(raw, dict) else None
    rounds: list[dict[str, Any]] = []
    for i, item in enumerate(rounds_raw if isinstance(rounds_raw, list) else []):
        normalized = _normalize_round(item, i, topic=topic)
        if normalized:
            rounds.append(normalized)
        if len(rounds) >= 5:
            break

    return {
        "topic": topic,
        "topic_label": (get_topics().get(topic) or {}).get("label") or topic,
        "rounds": rounds[:5],
        "retrieved_sources": retrieved_sources,
        "offline": source != "melong",
        "source": source,
    }


def build_topic_query(topic: str, recent_mistakes: list[dict[str, Any]] | None = None) -> str:
    key = normalize_topic(topic)
    meta = get_topics().get(key) or get_topics().get("particles") or {}
    parts = [str(meta.get("query") or "")]
    if key == "mistakes" and recent_mistakes:
        for m in recent_mistakes[:6]:
            orig = str(m.get("original") or "").strip()
            corr = str(m.get("correction") or "").strip()
            expl = str(m.get("explanation") or "").strip()
            rule = str(m.get("related_rule") or "").strip()
            chunk = " ".join(x for x in (orig, corr, expl, rule) if x)
            if chunk:
                parts.append(chunk)
    return "\n".join(parts)


async def retrieve_handbook(
    session: AsyncSession, query: str
) -> list[dict[str, Any]]:
    retriever = get_retriever()
    try:
        return await retriever.retrieve_grammar(session, query, top_k=5)
    except Exception:
        logger.exception("grammar game RAG retrieve failed")
        return []


def _payload_from_rag_or_bank(
    *,
    topic: str,
    retrieved: list[dict[str, Any]],
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    rag_rounds = build_rounds_from_rag(retrieved, topic, limit=5)
    if len(rag_rounds) >= 3:
        return normalize_game_payload(
            {"rounds": rag_rounds},
            topic=topic,
            retrieved_sources=sources,
            source="rag",
        )
    # Last resort: static bank, still attach RAG sources when present
    return normalize_game_payload(
        {"rounds": fallback_rounds(topic)},
        topic=topic,
        retrieved_sources=sources,
        source="bank" if not retrieved else "rag-bank",
    )


async def run_grammar_game(
    session: AsyncSession,
    topic: str,
    recent_mistakes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    key = normalize_topic(topic)
    query = build_topic_query(key, recent_mistakes)
    retrieved = await retrieve_handbook(session, query)
    sources = _sources_from_retrieved(retrieved)

    if melong_is_rate_limited():
        logger.info("grammar game: Melong rate-limited → RAG rounds (topic=%s, hits=%s)", key, len(retrieved))
        return _payload_from_rag_or_bank(topic=key, retrieved=retrieved, sources=sources)

    try:
        llm = get_llm()
        result = llm.complete_json(
            prompts.grammar_game_system(),
            prompts.grammar_game_user(key, retrieved, recent_mistakes),
            max_tokens=3500,
            retries=0,
        )
        if not isinstance(result, dict):
            result = {}
        payload = normalize_game_payload(
            result,
            topic=key,
            retrieved_sources=sources,
            source="melong",
        )
        # If Melong returned thin junk, prefer RAG-built rounds
        if len(payload["rounds"]) < 3:
            logger.info("grammar game: Melong thin → RAG rounds")
            return _payload_from_rag_or_bank(topic=key, retrieved=retrieved, sources=sources)
        return payload
    except Exception:
        logger.exception("grammar game: Melong failed → RAG rounds")
        return _payload_from_rag_or_bank(topic=key, retrieved=retrieved, sources=sources)
