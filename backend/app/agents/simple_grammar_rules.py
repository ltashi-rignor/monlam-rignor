"""Simple Tibetan grammar rules for the Grammar Agent (V1).

Source: classical rjes-'jug case chart (Thonmi) + evidentiality auxiliaries.
"""

from __future__ import annotations

SIMPLE_GRAMMAR_RULES = """
SIMPLE TIBETAN GRAMMAR RULES (V1 primary ground truth)

A) RJES-'JUG CLASSES
  Class A hard: ག་ ད་ བ་ ས
  Class B soft: ང་ ན་ མ་ ར་ ལ་
  Class C: འ (a-chung)
  Class D: open syllable (no suffix letter)

B) CASES 3 & 6 — Agentive / Genitive (CRITICAL)
  After ག་ ང་     → གིས / གི     (e.g. ཁོང་གིས, བདག་གི)
  After ད་ བ་ ས་  → ཀྱིས / ཀྱི   (e.g. བཀྲ་ཤིས་ཀྱིས)
  After ན་ མ་ ར་ ལ་ → གྱིས / གྱི (e.g. དགེ་རྒན་གྱིས)
  After འ or open → འིས/ཡིས/ས  and འི/ཡི

C) CASES 2, 4, 7 — la-don (terminative / dative / locative)
  After ག་ བ་ (and secondary ད་) → ཏུ
  After ང་ ན་ མ་ ར་ ལ་         → དུ
  After ས་ / འ                   → རུ
  Open syllable                  → ར
  Locative may also use invariant ན or ལ after any ending.

D) CASE 5 — Ablative ("from")
  After ང་ ན་ མ་ ར་ ལ་ → ནས   (e.g. ཁྱིམ་ནས)
  After ག་ ད་ བ་ ས་ འ or open → ལས

E) CASE 1 — Nominative: bare stem (optional ནི). CASE 8 — Vocative: not by rjes-'jug.

F) EVIDENTIALITY
  Identity ("to be"):
    1st person → ཡིན
    2nd/3rd    → རེད
  Existence / possession ("have / there is"):
    1st person known → ཡོད
    3rd observed     → འདུག
    3rd general fact → ཡོད་རེད
  Age / essence of self (ང་ལོ་…) → ཡིན (not ཡོད)
  1st intention / progressive (ང་…གི་…) → གི་ཡིན (not གི་རེད)
  2nd person question about ongoing action → གི་ཡོད / ཡོད་པས (not གི་འདུག)

G) V1 SCOPE
  Only flag clear case-suffix mismatches and clear ཡིན/རེད/ཡོད/འདུག errors.
  Do not invent complex literary grammar. If unsure → no mistake.
""".strip()
