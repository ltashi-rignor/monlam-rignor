"""Unit tests for dashboard activity series bucketing."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.api.dashboard import ACTIVITY_DAYS, _build_activity_series


def _row(**kwargs):
    return SimpleNamespace(**kwargs)


def test_activity_series_fills_14_days_and_buckets():
    today = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc).date()
    now = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)

    practices = [
        _row(created_at=now - timedelta(days=1), completed=True, score=80.0),
        _row(created_at=now - timedelta(days=1), completed=True, score=60.0),
        _row(created_at=now - timedelta(days=1), completed=False, score=99.0),
        _row(created_at=now - timedelta(days=20), completed=True, score=50.0),
    ]
    stories = [
        {"created_at": now.isoformat()},
        {"created_at": now.isoformat()},
    ]
    mistakes = [
        _row(created_at=now),
        _row(created_at=now - timedelta(days=2)),
    ]

    series = _build_activity_series(practices, stories, mistakes, today=today)
    assert len(series) == ACTIVITY_DAYS
    assert series[0]["date"] == (today - timedelta(days=ACTIVITY_DAYS - 1)).isoformat()
    assert series[-1]["date"] == today.isoformat()

    yesterday = series[-2]
    assert yesterday["practices_completed"] == 2
    assert yesterday["practice_avg_score"] == 70.0

    today_bucket = series[-1]
    assert today_bucket["stories"] == 2
    assert today_bucket["mistakes"] == 1

    two_ago = series[-3]
    assert two_ago["mistakes"] == 1
    assert two_ago["practices_completed"] == 0
