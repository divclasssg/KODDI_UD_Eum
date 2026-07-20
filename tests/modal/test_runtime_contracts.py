from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from inference.modal_medgemma.medgemma_app import (
    GPU_MAX_CONTAINERS,
    GPU_MIN_CONTAINERS,
    GPU_SCALEDOWN_WINDOW,
    GPU_TIMEOUT,
    GPU_TYPE,
    MODEL_ID,
    MODEL_IMAGE_PACKAGES,
    MODEL_PYTHON_VERSION,
    GateRejected,
    execute_gate,
)


NOW = datetime(2026, 7, 20, 12, 34, tzinfo=timezone.utc)


def valid_payload() -> dict[str, object]:
    return {
        "kind": "question",
        "context": {
            "version": "1",
            "interviewId": "interview-demo-001",
            "personaId": "persona-kim",
            "filledSlots": {"chief-complaint": "두통"},
            "recentTurns": [],
        },
        "session_hash": "a" * 64,
        "ip_hash": "b" * 64,
    }


def test_runtime_constants_match_the_approved_cost_envelope() -> None:
    assert MODEL_ID == "google/medgemma-1.5-4b-it"
    assert MODEL_PYTHON_VERSION == "3.12"
    assert GPU_TYPE == "T4"
    assert GPU_MIN_CONTAINERS == 0
    assert GPU_MAX_CONTAINERS == 1
    assert GPU_SCALEDOWN_WINDOW == 60
    assert GPU_TIMEOUT == 60
    assert MODEL_IMAGE_PACKAGES == (
        "modal==1.5.2",
        "torch==2.13.0",
        "transformers==5.14.1",
        "accelerate==1.14.0",
        "fastapi==0.139.2",
        "pydantic==2.13.4",
        "huggingface-hub==1.3.4",
    )


def test_invalid_schema_is_rejected_before_quota_and_gpu() -> None:
    store: dict[str, int] = {}
    generated: list[object] = []
    payload = valid_payload()
    payload["extra"] = True

    with pytest.raises(GateRejected) as caught:
        execute_gate(
            payload,
            store,
            NOW,
            actual_enabled=True,
            generate=lambda kind, context: generated.append((kind, context)),
        )

    assert (caught.value.status_code, caught.value.code) == (400, "invalid-request")
    assert store == {}
    assert generated == []


def test_kill_switch_rejects_before_quota_and_gpu() -> None:
    store: dict[str, int] = {}
    generated: list[object] = []

    with pytest.raises(GateRejected) as caught:
        execute_gate(
            valid_payload(),
            store,
            NOW,
            actual_enabled=False,
            generate=lambda kind, context: generated.append((kind, context)),
        )

    assert (caught.value.status_code, caught.value.code) == (
        503,
        "actual-disabled",
    )
    assert store == {}
    assert generated == []


def test_quota_rejection_does_not_start_gpu() -> None:
    store = {f"s:2026-07-20T12:34Z:{'a' * 64}": 5}
    generated: list[object] = []

    with pytest.raises(GateRejected) as caught:
        execute_gate(
            valid_payload(),
            store,
            NOW,
            actual_enabled=True,
            generate=lambda kind, context: generated.append((kind, context)),
        )

    assert (caught.value.status_code, caught.value.code) == (
        429,
        "session-minute",
    )
    assert generated == []


def test_valid_request_reserves_quota_then_returns_model_text() -> None:
    store: dict[str, int] = {}
    calls: list[tuple[str, dict[str, object]]] = []

    def generate(kind: str, context: dict[str, object]) -> str:
        calls.append((kind, context))
        return '{"version":"1","kind":"complete"}'

    result = execute_gate(
        valid_payload(), store, NOW, actual_enabled=True, generate=generate
    )

    assert result == {"text": '{"version":"1","kind":"complete"}'}
    assert calls[0][0] == "question"
    assert calls[0][1]["personaId"] == "persona-kim"
    assert store["d:2026-07-20"] == 1


def test_gpu_error_is_generalized_without_raw_detail() -> None:
    def generate(kind: str, context: dict[str, object]) -> str:
        raise RuntimeError("secret model payload")

    with pytest.raises(GateRejected) as caught:
        execute_gate(
            valid_payload(), {}, NOW, actual_enabled=True, generate=generate
        )

    assert (caught.value.status_code, caught.value.code) == (
        503,
        "generation-failed",
    )
    assert "secret model payload" not in str(caught.value)


def test_smoke_app_is_not_imported_by_the_production_app() -> None:
    source = Path("inference/modal_medgemma/medgemma_app.py").read_text()

    assert "quota_smoke_app" not in source
