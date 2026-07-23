from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


InterviewSlotId = Literal[
    "chief-complaint",
    "onset",
    "duration",
    "severity",
    "pattern",
    "associated-symptoms",
    "medications",
    "allergies",
    "safety",
]
DemoPersonaId = Literal["persona-kim", "persona-lee", "persona-park"]
BoundedId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=128),
]
QuestionText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=1_000),
]
AnswerText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2_000),
]
HashText = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class InterviewTurn(StrictModel):
    id: BoundedId
    question: QuestionText
    answer: AnswerText


class AiInterviewContextV1(StrictModel):
    version: Literal["1"]
    interview_id: BoundedId = Field(alias="interviewId")
    persona_id: DemoPersonaId = Field(alias="personaId")
    current_slot: InterviewSlotId | None = Field(default=None, alias="currentSlot")
    filled_slots: dict[InterviewSlotId, AnswerText] = Field(alias="filledSlots")
    recent_turns: list[InterviewTurn] = Field(alias="recentTurns", max_length=10)


class AiInterviewContextV2(StrictModel):
    version: Literal["2"]
    interview_id: BoundedId = Field(alias="interviewId")
    current_slot: InterviewSlotId | None = Field(default=None, alias="currentSlot")
    filled_slots: dict[InterviewSlotId, AnswerText] = Field(alias="filledSlots")
    recent_turns: list[InterviewTurn] = Field(alias="recentTurns", max_length=10)


AiInterviewContext = Annotated[
    AiInterviewContextV1 | AiInterviewContextV2,
    Field(discriminator="version"),
]


class InferenceRequest(StrictModel):
    kind: Literal["question", "summary"]
    context: AiInterviewContext
    session_hash: HashText
    ip_hash: HashText
