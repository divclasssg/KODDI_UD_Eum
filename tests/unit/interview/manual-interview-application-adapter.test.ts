import { describe, expect, it, vi } from "vitest";

import { createManualInterviewApplicationRepositoryPort } from "@/features/interview/manual/manual-interview-application-adapter";
import { MANUAL_QUESTIONS_V1, MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import { toUtcTimestamp, type InterviewAggregateV1 } from "@/lib/db/contracts";

const timestamp = toUtcTimestamp("2026-07-22T01:00:00.000Z");

function legacyAggregate(): InterviewAggregateV1 {
  return {
    interview: {
      id: "legacy-manual",
      schemaVersion: 1,
      revision: 1,
      status: "draft",
      mode: "manual",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    draft: {
      interviewId: "legacy-manual",
      schemaVersion: 1,
      revision: 1,
      currentQuestion: MANUAL_QUESTIONS_V1[0],
      input: { mode: "text", text: "합성 legacy 입력", selectedOptionIds: [] },
      updatedAt: timestamp,
    },
    messages: [],
  };
}

function v2Aggregate(): InterviewAggregateV1 {
  const commonDraft = createEmptyDraft(MANUAL_QUESTION_SET_V2.questions[0]);
  commonDraft.values.text.value = "합성 legacy 입력";
  return {
    interview: {
      ...legacyAggregate().interview,
      schemaVersion: 2,
      revision: 2,
      questionSetSnapshot: structuredClone(MANUAL_QUESTION_SET_V2),
    },
    draft: {
      ...legacyAggregate().draft!,
      schemaVersion: 2,
      revision: 2,
      input: {
        mode: "text",
        text: "합성 legacy 입력",
        selectedOptionIds: [],
        commonDraft,
      },
    },
    messages: [],
  };
}

describe("manual interview application repository adapter", () => {
  it("V1 진행 문진을 load에서 한 번 V2로 올리고 common draft를 반환한다", async () => {
    const upgradeLegacyDraft = vi.fn().mockResolvedValue(v2Aggregate());
    const port = createManualInterviewApplicationRepositoryPort({
      legacyService: {
        loadOrCreate: vi.fn().mockResolvedValue({
          phase: "answering",
          aggregate: legacyAggregate(),
          question: MANUAL_QUESTIONS_V1[0],
          answer: { text: "합성 legacy 입력", selectedOptionIds: [] },
        }),
        saveAnswer: vi.fn(),
        complete: vi.fn(),
      },
      repository: {
        upgradeLegacyDraft,
        persistDraft: vi.fn(),
      },
      now: () => timestamp,
    });

    const restored = await port.loadOrCreateManual({ runtimeGeneration: 0 });

    expect(upgradeLegacyDraft).toHaveBeenCalledOnce();
    expect(restored).toMatchObject({
      phase: "answering",
      interview: { interviewId: "legacy-manual", revision: 2 },
      draft: {
        contractVersion: 2,
        values: { text: { value: "합성 legacy 입력" } },
      },
    });
  });
});
