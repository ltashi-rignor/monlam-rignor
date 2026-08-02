"""Deterministic V1 simple grammar scans — rjes-'jug cases + evidentiality."""

from __future__ import annotations

import re
from typing import Any

# Particle must end a syllable (tsheg / punctuation / EOS), not sit inside a word.
_BOUND = r"(?=་|[\s།༔\"'”\u0f0d]|$)"
_SYL = r"[\u0f40-\u0f6c\u0f71-\u0f87\u0f90-\u0fbc]*"


def normalize_tibetan_text(text: str) -> str:
    """Light cleanup before scans (always on; no botok required)."""
    raw = text or ""
    # Collapse repeated tshegs and NBSP-ish spaces between Tibetan letters.
    cleaned = re.sub(r"་{2,}", "་", raw)
    cleaned = cleaned.replace("\u00a0", " ").replace("\u200b", "")
    cleaned = re.sub(r"([\u0f00-\u0fff])[ \t]+([\u0f00-\u0fff])", r"\1\2", cleaned)
    return cleaned.strip()


def _mistake(
    *,
    mistake_type: str,
    original: str,
    correction: str,
    explanation: str,
    related_rule: str,
    source_ref: str,
) -> dict[str, Any]:
    return {
        "mistake_type": mistake_type,
        "original": original,
        "correction": correction,
        "explanation": explanation,
        "related_rule": related_rule,
        "source_ref": source_ref,
    }


def _find_all(pattern: str, text: str) -> list[re.Match[str]]:
    return list(re.finditer(pattern, text))


def scan_case_particles(text: str) -> list[dict[str, Any]]:
    """Flag clear wrong rjes-'jug + particle pairs (cases 2–6)."""
    out: list[dict[str, Any]] = []

    # Agentive/genitive groups
    stem_ga = rf"({_SYL}[གང])"  # → གི / གིས
    stem_dbs = rf"({_SYL}[དབས])"  # → ཀྱི / ཀྱིས
    stem_nmral = rf"({_SYL}[ནམརལ])"  # → གྱི / གྱིས

    # la-don groups
    stem_tu = rf"({_SYL}[གབད])"  # → ཏུ (ག་བ་ + ད)
    stem_du = rf"({_SYL}[ངནམརལ])"  # → དུ
    stem_ru = rf"({_SYL}[སའ])"  # → རུ

    # ablative
    stem_nas = rf"({_SYL}[ངནམརལ])"  # → ནས
    stem_las = rf"({_SYL}[གདབསའ])"  # → ལས (simplified; open handled lightly)

    # --- Case 3 agentive ---
    for m in _find_all(rf"{stem_nmral}་?གིས{_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་གྱིས",
                explanation="རྗེས་འཇུག ན་མ་ར་ལ་ ཡིན་པས་བྱེད་སྒྲ་ལ་ གྱིས དགོས། ག་ང་ ལ་ གིས དགོས།",
                related_rule="ན་མ་ར་ལ་ → གྱིས། ག་ང་ → གིས།",
                source_ref="simple-rules · རྣམ་དབྱེ་གསུམ་པ",
            )
        )
    for m in _find_all(rf"{stem_ga}་?(?:གྱིས|ཀྱིས){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་གིས",
                explanation="རྗེས་འཇུག ག་ང་ ཡིན་པས་བྱེད་སྒྲ་ལ་ གིས དགོས།",
                related_rule="ག་ང་ → གིས།",
                source_ref="simple-rules · རྣམ་དབྱེ་གསུམ་པ",
            )
        )
    for m in _find_all(rf"{stem_dbs}་?(?:གྱིས|གིས){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་ཀྱིས",
                explanation="རྗེས་འཇུག ད་བ་ས་ ཡིན་པས་བྱེད་སྒྲ་ལ་ ཀྱིས དགོས།",
                related_rule="ད་བ་ས་ → ཀྱིས།",
                source_ref="simple-rules · རྣམ་དབྱེ་གསུམ་པ",
            )
        )

    # --- Case 6 genitive ---
    for m in _find_all(rf"{stem_nmral}་?གི(?!ས){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་གྱི",
                explanation="རྗེས་འཇུག ན་མ་ར་ལ་ ཡིན་པས་འབྲེལ་སྒྲ་ལ་ གྱི དགོས། ག་ང་ ལ་ གི དགོས།",
                related_rule="ན་མ་ར་ལ་ → གྱི། ག་ང་ → གི།",
                source_ref="simple-rules · རྣམ་དབྱེ་དྲུག་པ",
            )
        )
    for m in _find_all(rf"{stem_ga}་?(?:གྱི|ཀྱི)(?!ས){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་གི",
                explanation="རྗེས་འཇུག ག་ང་ ཡིན་པས་འབྲེལ་སྒྲ་ལ་ གི དགོས།",
                related_rule="ག་ང་ → གི།",
                source_ref="simple-rules · རྣམ་དབྱེ་དྲུག་པ",
            )
        )
    for m in _find_all(rf"{stem_dbs}་?(?:གྱི|གི)(?!ས){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་ཀྱི",
                explanation="རྗེས་འཇུག ད་བ་ས་ ཡིན་པས་འབྲེལ་སྒྲ་ལ་ ཀྱི དགོས།",
                related_rule="ད་བ་ས་ → ཀྱི།",
                source_ref="simple-rules · རྣམ་དབྱེ་དྲུག་པ",
            )
        )

    # --- Cases 2/4/7 la-don ---
    # Soft class wrongly takes སུ / ཏུ → དུ
    for m in _find_all(rf"{stem_du}་?(?:སུ|ཏུ){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་དུ",
                explanation="རྗེས་འཇུག ང་ན་མ་ར་ལ་ ཡིན་པས་ལ་དོན་ལ་ དུ དགོས།",
                related_rule="ང་ན་མ་ར་ལ་ → དུ། ག་བ་/ད་ → ཏུ།",
                source_ref="simple-rules · རྣམ་དབྱེ་གཉིས་པ/བཞི་པ/བདུན་པ",
            )
        )
    # Hard class wrongly takes དུ / སུ → ཏུ
    for m in _find_all(rf"{stem_tu}་?(?:དུ|སུ){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་ཏུ",
                explanation="རྗེས་འཇུག ག་བ་ (ཡང་ན་ཡང་འཇུག་ད) ཡིན་པས་ལ་དོན་ལ་ ཏུ དགོས།",
                related_rule="ག་བ་/ད་ → ཏུ།",
                source_ref="simple-rules · རྣམ་དབྱེ་གཉིས་པ/བཞི་པ/བདུན་པ",
            )
        )
    # ས/འ wrongly take དུ/སུ/ཏུ → རུ
    for m in _find_all(rf"{stem_ru}་?(?:དུ|སུ|ཏུ){_BOUND}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་རུ",
                explanation="རྗེས་འཇུག ས་/འ ཡིན་པས་ལ་དོན་ལ་ རུ དགོས།",
                related_rule="ས་/འ → རུ།",
                source_ref="simple-rules · རྣམ་དབྱེ་གཉིས་པ/བཞི་པ/བདུན་པ",
            )
        )

    # --- Case 5 ablative (motion "from …") ---
    motion = r"(?=་?[^།]{0,40}(?:སོང|འགྲོ|ཡོང|ཕེབས|བྱུང|ལོག))"
    for m in _find_all(rf"{stem_nas}་?ལས{motion}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་ནས",
                explanation="འབྱུང་ཁུངས་ (ལས་སུ་བྱ་བ) ལ་རྗེས་འཇུག ང་ན་མ་ར་ལ་ ཡིན་ན་ ནས དགོས།",
                related_rule="ང་ན་མ་ར་ལ་ → ནས། ག་ད་བ་ས་འ/open → ལས།",
                source_ref="simple-rules · རྣམ་དབྱེ་ལྔ་པ",
            )
        )
    for m in _find_all(rf"{stem_las}་?ནས{motion}", text):
        stem = m.group(1)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=m.group(0),
                correction=f"{stem}་ལས",
                explanation="འབྱུང་ཁུངས་ལ་རྗེས་འཇུག ག་ད་བ་ས་ སོགས་ཡིན་ན་ ལས དགོས།",
                related_rule="ག་ད་བ་ས་འ/open → ལས།",
                source_ref="simple-rules · རྣམ་དབྱེ་ལྔ་པ",
            )
        )

    return out



def _stem_ending_class(stem: str) -> str:
    """Map stem's final letter to rjes-'jug class used by V1 case rules."""
    s = (stem or "").rstrip("་").strip()
    if not s:
        return ""
    ch = s[-1]
    if ch in "གང":
        return "ga"
    if ch in "དབས":
        return "dbs"
    if ch in "ནམརལ":
        return "nmral"
    if ch in "སའ":
        return "ru"
    return ""


def s_endswith(stem: str, chars: str) -> bool:
    s = (stem or "").rstrip("་").strip()
    return bool(s) and s[-1] in chars


def scan_case_particles_botok(text: str) -> list[dict[str, Any]]:
    """
    Case-particle mistakes from botok stem+affix pairs.
    Fail-open: returns [] when botok is disabled or unavailable.
    Ablative (nas/las + motion) stays on the regex scanner.
    """
    try:
        from app.services.botok_tokenize import botok_available, stem_particle_pairs
    except Exception:
        return []
    if not botok_available():
        return []

    out: list[dict[str, Any]] = []
    for stem, particle, span in stem_particle_pairs(text):
        if not stem or not particle:
            continue
        klass = _stem_ending_class(stem)
        if particle == "གིས" and klass == "nmral":
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་གྱིས",
                    explanation="རྗེས་འཇུག ན་མ་ར་ལ་ ཡིན་པས་བྱེད་སྒྲ་ལ་ གྱིས དགོས། ག་ང་ ལ་ གིས དགོས།",
                    related_rule="ན་མ་ར་ལ་ → གྱིས། ག་ང་ → གིས།",
                    source_ref="botok+rules · རྣམ་དབྱེ་གསུམ་པ",
                )
            )
            continue
        if particle in {"གྱིས", "ཀྱིས"} and klass == "ga":
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་གིས",
                    explanation="རྗེས་འཇུག ག་ང་ ཡིན་པས་བྱེད་སྒྲ་ལ་ གིས དགོས།",
                    related_rule="ག་ང་ → གིས།",
                    source_ref="botok+rules · རྣམ་དབྱེ་གསུམ་པ",
                )
            )
            continue
        if particle in {"གྱིས", "གིས"} and klass == "dbs":
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་ཀྱིས",
                    explanation="རྗེས་འཇུག ད་བ་ས་ ཡིན་པས་བྱེད་སྒྲ་ལ་ ཀྱིས དགོས།",
                    related_rule="ད་བ་ས་ → ཀྱིས།",
                    source_ref="botok+rules · རྣམ་དབྱེ་གསུམ་པ",
                )
            )
            continue
        if particle == "གི" and klass == "nmral":
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་གྱི",
                    explanation="རྗེས་འཇུག ན་མ་ར་ལ་ ཡིན་པས་འབྲེལ་སྒྲ་ལ་ གྱི དགོས། ག་ང་ ལ་ གི དགོས།",
                    related_rule="ན་མ་ར་ལ་ → གྱི། ག་ང་ → གི།",
                    source_ref="botok+rules · རྣམ་དབྱེ་དྲུག་པ",
                )
            )
            continue
        if particle in {"གྱི", "ཀྱི"} and klass == "ga":
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་གི",
                    explanation="རྗེས་འཇུག ག་ང་ ཡིན་པས་འབྲེལ་སྒྲ་ལ་ གི དགོས།",
                    related_rule="ག་ང་ → གི།",
                    source_ref="botok+rules · རྣམ་དབྱེ་དྲུག་པ",
                )
            )
            continue
        if particle in {"གྱི", "གི"} and klass == "dbs":
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་ཀྱི",
                    explanation="རྗེས་འཇུག ད་བ་ས་ ཡིན་པས་འབྲེལ་སྒྲ་ལ་ ཀྱི དགོས།",
                    related_rule="ད་བ་ས་ → ཀྱི།",
                    source_ref="botok+rules · རྣམ་དབྱེ་དྲུག་པ",
                )
            )
            continue
        if particle in {"སུ", "ཏུ"} and s_endswith(stem, "ངནམརལ"):
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་དུ",
                    explanation="རྗེས་འཇུག ང་ན་མ་ར་ལ་ ཡིན་པས་ལ་དོན་ལ་ དུ དགོས།",
                    related_rule="ང་ན་མ་ར་ལ་ → དུ། ག་བ་/ད་ → ཏུ།",
                    source_ref="botok+rules · རྣམ་དབྱེ་གཉིས་པ/བཞི་པ/བདུན་པ",
                )
            )
            continue
        if particle in {"དུ", "སུ"} and s_endswith(stem, "གབད"):
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་ཏུ",
                    explanation="རྗེས་འཇུག ག་བ་ (ཡང་ན་ཡང་འཇུག་ད) ཡིན་པས་ལ་དོན་ལ་ ཏུ དགོས།",
                    related_rule="ག་བ་/ད་ → ཏུ།",
                    source_ref="botok+rules · རྣམ་དབྱེ་གཉིས་པ/བཞི་པ/བདུན་པ",
                )
            )
            continue
        if particle in {"དུ", "སུ", "ཏུ"} and s_endswith(stem, "སའ"):
            out.append(
                _mistake(
                    mistake_type="རྣམ་དབྱེ།",
                    original=span,
                    correction=f"{stem}་རུ",
                    explanation="རྗེས་འཇུག ས་/འ ཡིན་པས་ལ་དོན་ལ་ རུ དགོས།",
                    related_rule="ས་/འ → རུ།",
                    source_ref="botok+rules · རྣམ་དབྱེ་གཉིས་པ/བཞི་པ/བདུན་པ",
                )
            )
            continue

    return out


def scan_copula_existential(text: str) -> list[dict[str, Any]]:
    """Flag clear ཡིན/རེད/ཡོད/འདུག person/evidentiality mistakes."""
    out: list[dict[str, Any]] = []
    gap = r"[^།]{0,48}?"

    def _fix_identity_span(span: str) -> str:
        # Identity noun must not carry agentive བས (སློབ་གྲྭ་བས → བ).
        fixed = re.sub(r"བས་ཞིག", "བ་ཞིག", span)
        fixed = re.sub(r"རེད$", "ཡིན", fixed)
        return fixed

    # 1st identity with རེད (and optional wrongful agentive བས)
    for m in _find_all(rf"ང་ནི་{gap}རེད", text):
        span = m.group(0)
        if "ཡིན" in span:
            continue
        correction = _fix_identity_span(span)
        out.append(
            _mistake(
                mistake_type="ཡིན་རེད།",
                original=span,
                correction=correction,
                explanation=(
                    "ང་ (དང་པོ་པོ་ཉིད) ཡིན་ན་ངོ་བོ་སྟོན་སྐབས་ ཡིན དགོས། "
                    "རེད ནི་གཞན་པ་ལ་བཀོལ། ངོ་བོའི་མིང་ལ་བྱེད་སྒྲ་བས་མི་འཐུས།"
                ),
                related_rule="དང་པོ་པོ་ཉིད་ངོ་བོ། → ཡིན། བས་མིན།",
                source_ref="simple-rules · ཡིན/རེད",
            )
        )

    # Identity already uses ཡིན but still has wrongful agentive བས
    for m in _find_all(rf"ང་ནི་{gap}བས་ཞིག", text):
        span = m.group(0)
        # Skip if this identity clause already ends in རེད (covered by fuller span above).
        # Non-greedy བས match never includes trailing རེད, so check the following chars.
        end = m.end()
        if text[end : end + 2].startswith("་རེད") or text[end:].startswith("རེད"):
            continue
        if "རེད" in span:
            continue
        correction = re.sub(r"བས་ཞིག", "བ་ཞིག", span)
        if correction == span:
            continue
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=span,
                correction=correction,
                explanation="ངོ་བོ་སྟོན་སྐབས་མིང་ལ་བྱེད་སྒྲ་ བས མི་དགོས། སློབ་གྲྭ་བ་ཞིག དགོས།",
                related_rule="ངོ་བོ། → བ་ཞིག། བས་མིན།",
                source_ref="simple-rules · རྣམ་དབྱེ་གསུམ་པ",
            )
        )

    # Age: ང་ལོ་…ཡོད → ཡིན
    for m in _find_all(r"ང་ལོ་[^།]{0,30}?ཡོད", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="ཡིན་རེད།",
                original=span,
                correction=re.sub(r"ཡོད$", "ཡིན", span),
                explanation="ལོ་ཚོད་ནི་ངོ་བོའི་དོན་ཡིན་པས་ ཡིན དགོས། ཡོད ནི་ཡོད་པ/འཆང་བ་ལ་བཀོལ།",
                related_rule="ང་ལོ་… → ཡིན།",
                source_ref="simple-rules · ཡིན/རེད",
            )
        )

    # 1st progressive/intention with གི་རེད → གི་ཡིན
    for m in _find_all(r"ང་[^།\"”]{0,50}?གི་རེད", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="ཡིན་རེད།",
                original=span,
                correction=re.sub(r"གི་རེད$", "གི་ཡིན", span),
                explanation="རང་ཉིད་ཀྱི་བསམ་འཆར/འགྲོ་རྩིས་ལ་ གི་ཡིན དགོས། གི་རེད ནི་གསུམ་པ་པོ་ཉིད་ལ་བཀོལ།",
                related_rule="ང་ + གི་ཡིན། རེད་མིན།",
                source_ref="simple-rules · ཡིན/རེད",
            )
        )

    # 1st possession with འདུག → ཡོད (no quotes between)
    for m in _find_all(r"ང་ལ་[^།\"”']{0,40}?འདུག", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="ཡོད་འདུག།",
                original=span,
                correction=re.sub(r"འདུག$", "ཡོད", span),
                explanation="ང་ལ་ ཡོད་པ་རང་གིས་ཤེས་པ་ལ་ ཡོད དགོས། འདུག ནི་མཐོང་བ་ལ་བཀོལ།",
                related_rule="ང་ལ་ … → ཡོད།",
                source_ref="simple-rules · ཡོད/འདུག",
            )
        )

    # 2nd person ongoing question/statement with གི་འདུག → གི་ཡོད
    for m in _find_all(r"ཁྱོད[^།]{0,40}?གི་འདུག", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="ཡོད་འདུག།",
                original=span,
                correction=re.sub(r"གི་འདུག$", "གི་ཡོད", span),
                explanation="ཁྱོད་ལ་འགྲོ་བཞིན་པའི་དྲི་བ་ལ་ གི་ཡོད / ཡོད་པས དགོས།",
                related_rule="ཁྱོད་…གི་ཡོད།",
                source_ref="simple-rules · ཡོད/འདུག",
            )
        )

    # 3rd identity with ཡིན → རེད
    for m in _find_all(rf"(?:ཁོང|ཁོ|མོ)་ནི་{gap}ཡིན", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="ཡིན་རེད།",
                original=span,
                correction=re.sub(r"ཡིན$", "རེད", span),
                explanation="གསུམ་པ་པོ་ཉིད་ཀྱི་ངོ་བོ་ལ་ རེད དགོས།",
                related_rule="ཁོ/ཁོང/མོ་ ངོ་བོ། → རེད།",
                source_ref="simple-rules · ཡིན/རེད",
            )
        )

    # 3rd possession with ཡིན → ཡོད་རེད
    for m in _find_all(rf"(?:ཁོང|ཁོ|མོ)་ལ་{gap}ཡིན", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="ཡོད་འདུག།",
                original=span,
                correction=re.sub(r"ཡིན$", "ཡོད་རེད", span),
                explanation="གསུམ་པ་པོ་ཉིད་ཀྱི་ཡོད་པ/འཆང་བ་ལ་ ཡོད་རེད དགོས། ཡིན མི་འཐུས།",
                related_rule="ཁོང་ལ་ … → ཡོད་རེད།",
                source_ref="simple-rules · ཡོད/འདུག",
            )
        )

    return out


def scan_role_case(text: str) -> list[dict[str, Any]]:
    """Flag clear wrong agentive/patient role on common verbs."""
    out: list[dict[str, Any]] = []

    # Meeting is not agentive: ངས་…དང་ཐུག → ང་…དང་ཐུག
    for m in _find_all(r"ངས་[^།]{0,48}?དང་ཐུག", text):
        span = m.group(0)
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=span,
                correction=re.sub(r"^ངས་", "ང་", span),
                explanation="ཐུག་པ་ལ་བྱེད་སྒྲ་མི་དགོས། ང་ … དང་ཐུག དགོས།",
                related_rule="སྒྲོམ་གཞི། ཐུག་པ། → ང་ (བྱེད་སྒྲ་མིན)།",
                source_ref="simple-rules · རྣམ་དབྱེ་གསུམ་པ",
            )
        )

    # Answering is agentive: ང་ལ་…ལན་བཏབ → ངས་…ལན་བཏབ
    # Allow newline/space between ང་ and ལ་ (line-wrapped student text).
    for m in _find_all(r"ང་\s*ལ་[^།]{0,80}?ལན་བཏབ", text):
        span = m.group(0)
        correction = re.sub(r"^ང་\s*ལ་", "ངས་", span)
        # If quoted reply also has གི་རེད, fix it in the same span.
        correction = correction.replace("གི་རེད", "གི་ཡིན")
        out.append(
            _mistake(
                mistake_type="རྣམ་དབྱེ།",
                original=span,
                correction=correction,
                explanation="ལན་བཏབ་མཁན་ལ་བྱེད་སྒྲ་ ངས དགོས། ང་ལ་ ནི་ལས་སུ་བྱ་བ་ལ་བཀོལ།",
                related_rule="སྒྲོམ་གཞི། ལན་བཏབ། → ངས།",
                source_ref="simple-rules · རྣམ་དབྱེ་གསུམ་པ",
            )
        )

    return out


def scan_simple_mistakes(text: str, *, max_items: int = 14) -> list[dict[str, Any]]:
    raw = normalize_tibetan_text(text)
    if not raw:
        return []
    # botok case spans first (when available); regex always runs as coverage/fallback.
    items = (
        scan_copula_existential(raw)
        + scan_role_case(raw)
        + scan_case_particles_botok(raw)
        + scan_case_particles(raw)
    )
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        key = (item.get("original") or "").strip()
        if not key or key in seen:
            continue
        overlapping = [s for s in seen if key in s or s in key]
        if overlapping:
            # Prefer the longest span; drop shorter overlaps.
            if any(len(s) > len(key) for s in overlapping):
                continue
            for s in overlapping:
                out = [x for x in out if (x.get("original") or "").strip() != s]
                seen.discard(s)
        seen.add(key)
        out.append(item)
        if len(out) >= max_items:
            break
    return out


def apply_simple_corrections(text: str, mistakes: list[dict[str, Any]]) -> str:
    """Apply corrections for all occurrences (longest originals first)."""
    result = text
    ordered = sorted(
        mistakes,
        key=lambda m: len(m.get("original") or ""),
        reverse=True,
    )
    for m in ordered:
        original = m.get("original") or ""
        correction = m.get("correction") or ""
        if not original or original == correction:
            continue
        if original in result:
            result = result.replace(original, correction)
    return result
