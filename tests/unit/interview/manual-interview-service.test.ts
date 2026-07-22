import { describe, expect, it, vi } from "vitest";

import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import {
  MANUAL_QUESTIONS_V1,
  MANUAL_QUESTION_SET_V2,
} from "@/features/interview/manual/manual-question-set";
import { createManualInterviewService } from "@/features/interview/manual/manual-interview-service";
import {
  toUtcTimestamp,
  type InterviewAggregateV1,
} from "@/lib/db/contracts";

const FIRST_QUESTION = MANUAL_QUESTIONS_V1[0];

const SYNTHETIC_AGGREGATE: InterviewAggregateV1 = {
  interview: {
    id: "manual-synthetic",
    schemaVersion: 1,
    revision: 1,
    status: "draft",
    mode: "manual",
    createdAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
    updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
  draft: {
    interviewId: "manual-synthetic",
    schemaVersion: 1,
    revision: 1,
    currentQuestion: FIRST_QUESTION,
    input: {
      mode: "text",
      text: "합성 작성 중 답변",
      selectedOptionIds: [],
    },
    updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
  messages: [],
};

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn(),
    findLatestInProgress: vi.fn().mockResolvedValue(SYNTHETIC_AGGREGATE),
    loadInProgress: vi.fn(),
    saveProgress: vi.fn(),
    saveSummary: vi.fn(),
    saveFinalProgress: vi.fn(),
    complete: vi.fn(),
    listCompleted: vi.fn(),
    ...overrides,
  };
}

describe("manual interview service", () => {
  it("진행 중 manual aggregate가 있으면 새로 만들지 않고 복원한다", async () => {
    const repository = createRepository();
    const service = createManualInterviewService({
      repository,
      captureRuntimeGeneration: () => 0,
      now: () => new Date("2026-07-22T01:00:00.000Z"),
      randomId: () => "synthetic-id",
    });

    const state = await service.loadOrCreate();

    expect(repository.create).not.toHaveBeenCalled();
    expect(state.phase).toBe("answering");
    expect(state.answer.text).toBe("합성 작성 중 답변");
  });

  it("진행 중 문진이 없으면 첫 질문으로 manual record를 만든다", async () => {
    const repository = createRepository({
      findLatestInProgress: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(SYNTHETIC_AGGREGATE),
    });
    const service = createManualInterviewService({
      repository,
      captureRuntimeGeneration: () => 3,
      now: () => new Date("2026-07-22T01:00:00.000Z"),
      randomId: () => "synthetic-id",
    });

    await service.loadOrCreate();

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "manual-synthetic-id",
        mode: "manual",
        questionSetSnapshot: expect.objectContaining({
          contractVersion: 2,
          id: "manual-intake-v1",
        }),
        draft: expect.objectContaining({
          input: expect.objectContaining({
            commonDraft: expect.objectContaining({ contractVersion: 2 }),
          }),
        }),
      }),
    );
  });

  it("V2 재개와 제출은 저장된 질문 snapshot의 문구와 선택지를 사용한다", async () => {
    const questionSetSnapshot = structuredClone(MANUAL_QUESTION_SET_V2);
    const currentQuestion = questionSetSnapshot.questions[1];
    const nextQuestion = questionSetSnapshot.questions[2];
    currentQuestion.text = "저장 당시 합성 기간 질문";
    nextQuestion.text = "저장 당시 합성 양상 질문";
    const daysOption = currentQuestion.contracts.chip?.options.find(
      ({ id }) => id === "days",
    );
    if (!daysOption) throw new Error("expected-days-option");
    daysOption.label = "저장 당시 며칠 전";
    const commonDraft = createEmptyDraft(currentQuestion);
    commonDraft.values.chip.selectedOptionIds = ["days"];
    const aggregate: InterviewAggregateV1 = {
      interview: {
        ...SYNTHETIC_AGGREGATE.interview,
        schemaVersion: 2,
        questionSetSnapshot,
      },
      draft: {
        ...SYNTHETIC_AGGREGATE.draft!,
        schemaVersion: 2,
        currentQuestion: MANUAL_QUESTIONS_V1[1],
        input: {
          mode: "choice",
          text: "",
          selectedOptionIds: ["days"],
          commonDraft,
        },
      },
      messages: [],
    };
    const repository = createRepository({
      findLatestInProgress: vi.fn().mockResolvedValue(aggregate),
      saveProgress: vi.fn().mockImplementation(async (_token, input) => ({
        interview: { ...aggregate.interview, revision: 2 },
        draft: {
          interviewId: aggregate.interview.id,
          schemaVersion: 2,
          revision: 2,
          ...input.draft,
        },
        messages: input.appendedMessages.map((message: object) => ({
          interviewId: aggregate.interview.id,
          schemaVersion: 1,
          ...message,
        })),
      })),
    });
    const service = createManualInterviewService({
      repository,
      captureRuntimeGeneration: () => 0,
      now: () => new Date("2026-07-22T01:00:00.000Z"),
      randomId: () => "synthetic-id",
    });

    const restored = await service.loadOrCreate();
    expect(restored.question?.text).toBe("저장 당시 합성 기간 질문");

    const advanced = await service.saveAnswer(restored, {
      text: "",
      selectedOptionIds: ["days"],
    });

    expect(repository.saveProgress).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        appendedMessages: [
          expect.objectContaining({ text: "저장 당시 합성 기간 질문" }),
          expect.objectContaining({ text: "저장 당시 며칠 전" }),
        ],
        draft: expect.objectContaining({
          currentQuestion: expect.objectContaining({
            text: "저장 당시 합성 양상 질문",
          }),
        }),
      }),
    );
    expect(advanced.question?.text).toBe("저장 당시 합성 양상 질문");
  });
});
