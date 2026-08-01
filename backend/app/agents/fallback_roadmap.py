"""Offline learning roadmap when Melong is rate-limited or unavailable.

Template lives in ``content/roadmap.yaml``.
"""

from __future__ import annotations

import copy
from typing import Any

from app.content.loader import load_yaml


def build_fallback_roadmap(profile: dict[str, Any] | None = None) -> dict[str, Any]:
    profile = profile or {}
    data = load_yaml("roadmap")

    name = str(profile.get("name") or "").strip()
    interests = profile.get("interests") or []
    motivations = profile.get("motivations") or []
    likes = str(profile.get("likes") or "").strip()
    favorites = str(profile.get("favorites") or "").strip()
    variety = str(profile.get("tibetan_variety") or profile.get("school_class") or "").strip()

    who = name or str(data.get("default_who") or "སློབ་ཕྲུག")
    interest = (
        ", ".join(interests[:3])
        if interests
        else likes or favorites or str(data.get("default_interest") or "ཉིན་རེའི་སྐད་ཆ།")
    )
    if motivations and not interests:
        interest = ", ".join(motivations[:2])
    class_bit = f" · {variety}" if variety else ""

    title_tmpl = str(data.get("title_template") or "{who}་ཡི་བོད་ཡིག་སློབ་ལམ།")
    summary_tmpl = str(
        data.get("summary_template")
        or "མེ་ལོང་མི་འདུག་པས་རང་འགུལ་སློབ་ལམ་བཟོས། དགའ་པོ་{interest}་དང་མཉམ་དུ་སྦྱོང་།{class_bit}"
    )

    weeks = copy.deepcopy(data.get("weeks") or [])
    return {
        "title": title_tmpl.format(who=who, interest=interest, class_bit=class_bit),
        "summary": summary_tmpl.format(who=who, interest=interest, class_bit=class_bit),
        "weeks": weeks,
        "offline": True,
        "source": "fallback",
    }
