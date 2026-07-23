import { describe, expect, it, vi } from "vitest";

import { createAiInterviewApplicationRepositoryPort } from "@/features/interview/ai/ai-interview-application-adapter";
import type { AiInterviewService } from "@/features/interview/ai/ai-interview-service";
import { createInterviewApplicationService } from "@/features/interview/application/interview-application-service";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";
import { createRuntimeOperationCoordinator } from "@/lib/runtime/runtime-operation-coordinator";

const QUESTION = MANUAL_QUESTION_SET_V2.questions[0];

function abortableResult(signal: AbortSignal) {
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      reject(new DOMException("합성 취소", "AbortError"));
    }, { once: true });
  });
}

function createService(overrides: Partial<AiInterviewService> = {}): AiInterviewService {
  return {
    loadOrCreate: vi.fn(),
    persistDraft: vi.fn(),
    submitAnswer: vi.fn(),
    requestAiQuestion: vi.fn(),
    requestAiSummary: vi.fn(),
    acknowledgeSafety: vi.fn(),
    complete: vi.fn(),
    ...overrides,
  };
}

describe("AI interview application adapter", () => {
  it("application dispose 뒤 같은 service를 다시 start하면 새 AI 요청을 실행한다", async () => {
    const coordinator = createRuntimeOperationCoordinator();
    let firstSignal: AbortSignal | undefined;
    const requestAiQuestion = vi
      .fn()
      .mockImplementationOnce((input) => {
        firstSignal = input.signal;
        return abortableResult(input.signal);
      })
      .mockResolvedValueOnce({
        phase: "answering",
        interview: {
          interviewId: "interview-1",
          revision: 3,
          runtimeGeneration: 0,
        },
        question: QUESTION,
        draft: createEmptyDraft(QUESTION),
      });
    const aiService = createService({
      loadOrCreate: vi.fn().mockResolvedValue({
        phase: "waiting-for-question",
        interview: {
          interviewId: "interview-1",
          revision: 2,
          runtimeGeneration: 0,
        },
        history: [],
        answeredAiFollowUps: 0,
      }),
      requestAiQuestion,
    });
    const repository = createAiInterviewApplicationRepositoryPort({
      service: aiService,
      runtimeCoordinator: coordinator,
    });
    let id = 0;
    const application = createInterviewApplicationService({
      repository,
      navigate: vi.fn(),
      captureRuntimeGeneration: coordinator.capture,
      randomId: () => `restart-${++id}`,
    });

    application.start();
    await vi.waitFor(() => expect(requestAiQuestion).toHaveBeenCalledTimes(1));
    application.dispose();
    await application.whenIdle();

    expect(firstSignal?.aborted).toBe(true);

    application.start();
    await application.whenIdle();

    expect(requestAiQuestion).toHaveBeenCalledTimes(2);
    expect(application.getState()).toMatchObject({
      phase: "answering",
      interview: { revision: 3 },
    });
  });

  it("runtime reset은 등록된 AI 질문 signal을 abort한다", async () => {
    const coordinator = createRuntimeOperationCoordinator();
    let receivedSignal: AbortSignal | undefined;
    const service = createService({
      requestAiQuestion: vi.fn((input) => {
        receivedSignal = input.signal;
        return abortableResult(input.signal);
      }),
    });
    const adapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: coordinator,
    });
    const operation = adapter.requestAiQuestion({
      token: {
        sessionId: "session-1",
        requestId: "question-1",
        interviewId: "interview-1",
        baseRevision: 2,
        runtimeGeneration: 0,
      },
      history: [],
    });

    coordinator.invalidateAndCancel();

    expect(receivedSignal?.aborted).toBe(true);
    await expect(operation).rejects.toMatchObject({ name: "AbortError" });
  });

  it("dispose와 reset은 각각 진행 중인 AI 요청을 abort한다", async () => {
    const coordinator = createRuntimeOperationCoordinator();
    const signals: AbortSignal[] = [];
    const service = createService({
      requestAiQuestion: vi.fn((input) => {
        signals.push(input.signal);
        return abortableResult(input.signal);
      }),
      requestAiSummary: vi.fn((input) => {
        signals.push(input.signal);
        return abortableResult(input.signal);
      }),
    });
    const token = {
      sessionId: "session-1",
      requestId: "request-1",
      interviewId: "interview-1",
      baseRevision: 2,
      runtimeGeneration: 0,
    };
    const firstAdapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: coordinator,
    });
    const question = firstAdapter.requestAiQuestion({ token, history: [] });

    firstAdapter.dispose();
    expect(signals[0]?.aborted).toBe(true);
    await expect(question).rejects.toMatchObject({ name: "AbortError" });

    const secondAdapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: coordinator,
    });
    const summary = secondAdapter.requestAiSummary({ token, history: [] });
    secondAdapter.reset();
    expect(signals[1]?.aborted).toBe(true);
    await expect(summary).rejects.toMatchObject({ name: "AbortError" });
  });

  it("완료된 요청 controller는 coordinator에서 등록 해제한다", async () => {
    const coordinator = createRuntimeOperationCoordinator();
    let receivedSignal: AbortSignal | undefined;
    const service = createService({
      requestAiQuestion: vi.fn(async (input) => {
        receivedSignal = input.signal;
        return {
          phase: "waiting-for-summary" as const,
          interview: {
            interviewId: "interview-1",
            revision: 3,
            runtimeGeneration: 0,
          },
          history: [],
          answeredAiFollowUps: 0,
        };
      }),
    });
    const adapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: coordinator,
    });

    await adapter.requestAiQuestion({
      token: {
        sessionId: "session-1",
        requestId: "question-1",
        interviewId: "interview-1",
        baseRevision: 2,
        runtimeGeneration: 0,
      },
      history: [],
    });
    coordinator.invalidateAndCancel();

    expect(receivedSignal?.aborted).toBe(false);
  });
});
