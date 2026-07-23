from __future__ import annotations

import pytest
from pydantic import ValidationError
from typing import Any

from inference.modal_medgemma.schemas import InferenceRequest


def valid_request() -> dict[str, object]:
    return {
        "kind": "question",
        "context": {
            "version": "1",
            "interviewId": "interview-demo-001",
            "personaId": "persona-kim",
            "currentSlot": "duration",
            "filledSlots": {"chief-complaint": "두통"},
            "recentTurns": [
                {
                    "id": "turn-001",
                    "question": "어디가 불편하신가요?",
                    "answer": "두통이 있어요",
                }
            ],
        },
        "session_hash": "a" * 64,
        "ip_hash": "b" * 64,
    }


def valid_public_request() -> dict[str, object]:
    return {
        "kind": "question",
        "context": {
            "version": "2",
            "interviewId": "ai-public-001",
            "filledSlots": {"chief-complaint": "두통"},
            "recentTurns": [],
        },
        "session_hash": "a" * 64,
        "ip_hash": "b" * 64,
    }


def test_accepts_versioned_question_request() -> None:
    request = InferenceRequest.model_validate(valid_request())

    assert request.kind == "question"
    assert request.context.persona_id == "persona-kim"
    assert request.context.current_slot == "duration"


def test_accepts_persona_free_public_v2_request() -> None:
    request = InferenceRequest.model_validate(valid_public_request())

    assert request.context.version == "2"
    assert request.context.interview_id == "ai-public-001"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("personaId", "persona-kim"),
        ("displayName", "김하나"),
        ("birthDate", "1990-01-01"),
    ],
)
def test_rejects_profile_fields_from_public_v2_request(
    field: str, value: object
) -> None:
    payload = valid_public_request()
    context = payload["context"]
    assert isinstance(context, dict)
    context[field] = value

    with pytest.raises(ValidationError):
        InferenceRequest.model_validate(payload)


@pytest.mark.parametrize(
    ("path", "value"),
    [
        (("extra",), True),
        (("context", "extra"), True),
        (("context", "recentTurns", 0, "extra"), True),
        (("context", "version"), "2"),
        (("context", "currentSlot"), "diagnosis"),
        (("session_hash",), "a" * 63),
        (("ip_hash",), "A" * 64),
    ],
)
def test_rejects_unknown_or_invalid_fields(
    path: tuple[str | int, ...], value: object
) -> None:
    payload = valid_request()
    target: Any = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value

    with pytest.raises(ValidationError):
        InferenceRequest.model_validate(payload)


def test_rejects_more_than_ten_recent_turns() -> None:
    payload = valid_request()
    context = payload["context"]
    assert isinstance(context, dict)
    context["recentTurns"] = [
        {"id": f"turn-{index}", "question": "질문", "answer": "답변"}
        for index in range(11)
    ]

    with pytest.raises(ValidationError):
        InferenceRequest.model_validate(payload)
