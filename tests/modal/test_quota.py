from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from inference.modal_medgemma.quota import QuotaDecision, reserve_quota


NOW = datetime(2026, 7, 20, 12, 34, 59, tzinfo=timezone.utc)


def test_reserves_only_hmac_bucket_counts() -> None:
    store: dict[str, int] = {}

    decision = reserve_quota(store, NOW, "a" * 64, "b" * 64)

    assert decision == QuotaDecision(allowed=True, code="ok")
    assert store == {
        f"s:2026-07-20T12:34Z:{'a' * 64}": 1,
        f"i:2026-07-20T12Z:{'b' * 64}": 1,
        "d:2026-07-20": 1,
    }


def test_sixth_session_request_is_rejected_without_partial_increment() -> None:
    store: dict[str, int] = {}
    for _ in range(5):
        assert reserve_quota(store, NOW, "a" * 64, "b" * 64).allowed

    decision = reserve_quota(store, NOW, "a" * 64, "b" * 64)

    assert decision == QuotaDecision(allowed=False, code="session-minute")
    assert store[f"i:2026-07-20T12Z:{'b' * 64}"] == 5
    assert store["d:2026-07-20"] == 5


def test_twenty_first_ip_request_is_rejected() -> None:
    store: dict[str, int] = {}
    for index in range(20):
        assert reserve_quota(
            store, NOW, f"{index:064x}", "b" * 64
        ).allowed

    decision = reserve_quota(store, NOW, "f" * 64, "b" * 64)

    assert decision == QuotaDecision(allowed=False, code="ip-hour")
    assert store["d:2026-07-20"] == 20


def test_one_hundred_first_actual_request_is_rejected() -> None:
    store: dict[str, int] = {}
    for index in range(100):
        assert reserve_quota(
            store, NOW, f"{index:064x}", f"{index:064x}"
        ).allowed

    decision = reserve_quota(store, NOW, "f" * 64, "e" * 64)

    assert decision == QuotaDecision(allowed=False, code="actual-day")
    assert store["d:2026-07-20"] == 100


def test_utc_minute_hour_and_day_boundaries_create_new_buckets() -> None:
    store: dict[str, int] = {}
    assert reserve_quota(store, NOW, "a" * 64, "b" * 64).allowed
    assert reserve_quota(
        store, NOW + timedelta(seconds=1), "a" * 64, "b" * 64
    ).allowed
    assert reserve_quota(
        store, datetime(2026, 7, 20, 13, tzinfo=timezone.utc), "a" * 64, "b" * 64
    ).allowed
    assert reserve_quota(
        store, datetime(2026, 7, 21, tzinfo=timezone.utc), "a" * 64, "b" * 64
    ).allowed

    assert f"s:2026-07-20T12:35Z:{'a' * 64}" in store
    assert f"i:2026-07-20T13Z:{'b' * 64}" in store
    assert "d:2026-07-21" in store


def test_naive_datetime_is_rejected() -> None:
    with pytest.raises(ValueError, match="timezone"):
        reserve_quota({}, datetime(2026, 7, 20), "a" * 64, "b" * 64)
