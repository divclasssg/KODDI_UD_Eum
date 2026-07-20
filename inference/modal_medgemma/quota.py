from __future__ import annotations

from collections.abc import MutableMapping
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal


QuotaCode = Literal["ok", "session-minute", "ip-hour", "actual-day"]


@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    code: QuotaCode


def _utc(now: datetime) -> datetime:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("timezone-aware datetime is required")
    return now.astimezone(timezone.utc)


def reserve_quota(
    store: MutableMapping[str, int],
    now: datetime,
    session_hash: str,
    ip_hash: str,
) -> QuotaDecision:
    current = _utc(now)
    minute = current.strftime("%Y-%m-%dT%H:%MZ")
    hour = current.strftime("%Y-%m-%dT%HZ")
    day = current.strftime("%Y-%m-%d")
    session_key = f"s:{minute}:{session_hash}"
    ip_key = f"i:{hour}:{ip_hash}"
    day_key = f"d:{day}"

    session_count = int(store.get(session_key, 0))
    ip_count = int(store.get(ip_key, 0))
    day_count = int(store.get(day_key, 0))

    if session_count >= 5:
        return QuotaDecision(allowed=False, code="session-minute")
    if ip_count >= 20:
        return QuotaDecision(allowed=False, code="ip-hour")
    if day_count >= 100:
        return QuotaDecision(allowed=False, code="actual-day")

    store[session_key] = session_count + 1
    store[ip_key] = ip_count + 1
    store[day_key] = day_count + 1
    return QuotaDecision(allowed=True, code="ok")
