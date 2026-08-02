"""Grammar-seed practice drills must target wrong→fix pairs."""

from app.agents.practice_agent import drills_from_seed_mistakes, sanitize_practice_exercises


def test_drills_from_seed_mistakes_uses_wrong_fix_pairs():
    mistakes = [
        {
            "mistake_type": 'རྣམ་དབྱེ།',
            "original": 'ང་སློབ་གྲྭ་གིས་འགྲོ།',
            "correction": 'ང་སློབ་གྲྭ་ལ་འགྲོ།',
            "explanation": "test",
        },
        {
            "mistake_type": 'ཡིན་རེད་ཡོད་འདུག',
            "original": 'ཁོང་ནི་དགེ་རྒན་ཞིག་ཡིན།',
            "correction": 'ཁོང་ནི་དགེ་རྒན་ཞིག་རེད།',
        },
    ]
    drills = drills_from_seed_mistakes(mistakes)
    assert len(drills) == 2
    assert drills[0]["type"] == "correct_sentence"
    assert drills[0]["answer"] == 'ང་སློབ་གྲྭ་ལ་འགྲོ།'
    assert 'ང་སློབ་གྲྭ་གིས་འགྲོ།' in drills[0]["prompt"]
    assert drills[0]["answer"] in drills[0]["options"]
    assert drills[1]["answer"] == 'ཁོང་ནི་དགེ་རྒན་ཞིག་རེད།'


def test_sanitize_prefers_seed_fillers_over_generic_bank():
    mistakes = [
        {
            "mistake_type": 'རྣམ་དབྱེ།',
            "original": 'ང་སློབ་གྲྭ་གིས་འགྲོ།',
            "correction": 'ང་སློབ་གྲྭ་ལ་འགྲོ།',
        }
    ]
    out = sanitize_practice_exercises(
        {"title": "t", "focus_areas": [], "exercises": []},
        fill_bank=True,
        seed_mistakes=mistakes,
    )
    prompts = [ex["prompt"] for ex in out["exercises"]]
    assert any('ང་སློབ་གྲྭ་གིས་འགྲོ།' in p for p in prompts)
    assert not any("school" in p.lower() for p in prompts)
    assert out["focus_areas"] == ['རྣམ་དབྱེ།']
