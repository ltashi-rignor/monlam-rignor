"""Tests for Monlam OCR helpers (no live network)."""

from __future__ import annotations

from app.services.ocr import _pick_text, is_image_upload


def test_is_image_upload():
    assert is_image_upload("page.jpg", "image/jpeg")
    assert is_image_upload("scan.PNG", None)
    assert not is_image_upload("notes.txt", "text/plain")
    assert not is_image_upload("essay.docx", None)


def test_pick_text_variants():
    assert _pick_text({"text": "ང་འགྲོ།"}) == "ང་འགྲོ།"
    assert _pick_text({"output": "བཀྲ་ཤིས།"}) == "བཀྲ་ཤིས།"
    assert _pick_text({"pages": [{"text": "༡"}, {"text": "༢"}]}) == "༡\n\n༢"
    assert _pick_text({}) == ""
