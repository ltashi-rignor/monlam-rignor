"""Unit tests for kids story scene normalization."""

from app.agents.story_agent import _clean_names, _normalize_scenes


def test_clean_names_pads_and_caps():
    assert _clean_names(["པད་མ།"], 3) == ["པད་མ།", "གྲོགས་པོ་2", "གྲོགས་པོ་3"]
    assert len(_clean_names(["a", "b", "c", "d", "e", "f"], 5)) == 5


def test_normalize_scenes_maps_unknown_keys():
    scenes = _normalize_scenes(
        [
            {"scene_key": "volcano", "caption": "ཨ།", "text": "ཨ་རེད།"},
            {"scene_key": "mountain", "caption": "རི།", "text": "རི་ལ་ཕྱིན།"},
            {"scene_key": "play", "caption": "རྩེད།", "text": "རྩེད་མོ་རྩེས།"},
        ],
        ["པད་མ།"],
    )
    assert len(scenes) == 3
    assert scenes[0]["scene_key"] == "home"  # fallback for unknown
    assert scenes[1]["scene_key"] == "mountain"


def test_normalize_scenes_fallback_when_empty():
    scenes = _normalize_scenes([], ["ཚེ་རིང་།"])
    assert len(scenes) >= 3
    assert all("text" in s and "scene_key" in s for s in scenes)
