import { describe, expect, it, vi } from "vitest";

import { MANUAL_QUESTIONS_V1 } from "@/features/interview/manual/manual-question-set";
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
      expect.objectContaining({ id: "manual-synthetic-id", mode: "manual" }),
    );
  });
});
