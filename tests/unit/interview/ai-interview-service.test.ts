import { describe, expect, it, vi } from "vitest";

import {
  createEmptyDraft,
  type CommonDraftV2,
  type QuestionSnapshotV2,
} from "@/features/interview/domain/interview-draft";
import {
  createAiInterviewService,
  createPublicAiHttpClient,
  deriveAiContinuation,
  PUBLIC_AI_COMPLETION_MARKER,
  PUBLIC_AI_SAFETY_MESSAGE,
  type AiInterviewRepositoryPort,
  type AiServiceOperationToken,
  type PublicAiClient,
} from "@/features/interview/ai/ai-interview-service";
import { createAiInterviewApplicationRepositoryPort } from "@/features/interview/ai/ai-interview-application-adapter";
import {
  createDeterministicFirstAiQuestion,
} from "@/features/interview/manual/manual-question-set";
import {
  toUtcTimestamp,
  type CreateInterviewInputV2,
  type InterviewAggregateV1,
  type InterviewMessageInputV1,
  type SaveSummaryInputV1,
} from "@/lib/db/contracts";
import { createRuntimeOperationCoordinator } from "@/lib/runtime/runtime-operation-coordinator";

const NOW = toUtcTimestamp("2026-07-22T03:00:00.000Z");
const FIRST = createDeterministicFirstAiQuestion();

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function draftFor(question: QuestionSnapshotV2, text = ""): CommonDraftV2 {
  const draft = createEmptyDraft(question);
  draft.values.text.value = text;
  return draft;
}

function aggregateFor(
  question = FIRST,
  messages: InterviewAggregateV1["messages"] = [],
  revision = 1,
  draft = draftFor(question),
): InterviewAggregateV1 {
  return {
    interview: {
      id: "ai-interview-001",
      schemaVersion: 2,
      revision,
      status: "draft",
      mode: "ai",
      createdAt: NOW,
      updatedAt: NOW,
      questionSetSnapshot: {
        contractVersion: 2,
        id: "public-ai-intake-v2",
        questions: [structuredClone(FIRST), ...(question.id === FIRST.id ? [] : [structuredClone(question)])],
      },
    },
    draft: {
      interviewId: "ai-interview-001",
      schemaVersion: 2,
      revision,
      currentQuestion: {
        id: question.id,
        slot: question.slot,
        text: question.text,
        selection: question.contracts.choice?.selection ?? "single",
        options: structuredClone(question.contracts.choice?.options ?? []),
      },
      input: {
        mode: draft.activeMode === "chip" ? "choice" : draft.activeMode,
        text: draft.values.text.value,
        selectedOptionIds: [],
        commonDraft: structuredClone(draft),
      },
      updatedAt: NOW,
    },
    messages: structuredClone(messages),
  };
}

function pair(
  question: QuestionSnapshotV2,
  answer: string,
  sequence = 0,
): InterviewAggregateV1["messages"] {
  return [
    {
      interviewId: "ai-interview-001",
      schemaVersion: 1,
      id: `question-message-${sequence}`,
      sequence,
      role: "assistant",
      kind: "question",
      text: question.text,
      createdAt: NOW,
    },
    {
      interviewId: "ai-interview-001",
      schemaVersion: 1,
      id: `answer-message-${sequence + 1}`,
      sequence: sequence + 1,
      role: "user",
      kind: "answer",
      text: answer,
      createdAt: NOW,
    },
  ];
}

function completionMarker(sequence: number): InterviewAggregateV1["messages"][number] {
  return {
    interviewId: "ai-interview-001",
    schemaVersion: 1,
    id: `completion-message-${sequence}`,
    sequence,
    role: "system",
    kind: "completion",
    text: PUBLIC_AI_COMPLETION_MARKER,
    createdAt: NOW,
  };
}

function token(aggregate: InterviewAggregateV1, runtimeGeneration = 7): AiServiceOperationToken {
  return {
    sessionId: "session-001",
    requestId: "request-001",
    interviewId: aggregate.interview.id,
    baseRevision: aggregate.interview.revision,
    runtimeGeneration,
  };
}

function generatedQuestion(id = "provider-question-001"): QuestionSnapshotV2 {
  return {
    contractVersion: 2,
    id,
    slot: "duration",
    text: "불편함은 언제부터 이어졌나요?",
    allowedModes: ["choice", "text"],
    defaultMode: "choice",
    contracts: {
      text: { minLength: 1, maxLength: 1_000 },
      choice: {
        selection: "single",
        options: [
          { id: "today", label: "오늘부터" },
          { id: "unknown", label: "잘 모르겠어요" },
        ],
        unknownOptionId: "unknown",
      },
    },
  };
}

function providerQuestion(id = "provider-question-001") {
  return {
    version: "2" as const,
    kind: "question" as const,
    question: {
      id,
      slot: "duration" as const,
      text: "불편함은 언제부터 이어졌나요?",
      selection: "single" as const,
      options: [
        { id: "today", label: "오늘부터" },
        { id: "unknown", label: "잘 모르겠어요" },
      ],
    },
  };
}

function providerComplete() {
  return { version: "2" as const, kind: "complete" as const };
}

function createRepository(initial?: InterviewAggregateV1) {
  let current = initial ? structuredClone(initial) : undefined;
  const createFromInput = (input: CreateInterviewInputV2) => {
    current = aggregateFor(
      input.questionSetSnapshot.questions[0],
      [],
      1,
      input.draft.input.commonDraft,
    );
    return structuredClone(current);
  };
  const repository = {
    findOrCreateAi: vi.fn(async (input: CreateInterviewInputV2) =>
      structuredClone(current) ?? createFromInput(input)),
    loadInProgress: vi.fn(async () => structuredClone(current)),
    persistDraft: vi.fn(),
    saveProgress: vi.fn(async (_revisionToken, input) => {
      if (!current?.draft) throw new Error("missing-current");
      const nextRevision = current.interview.revision + 1;
      current = {
        ...current,
        interview: { ...current.interview, revision: nextRevision },
        draft: {
          interviewId: current.interview.id,
          schemaVersion: 2,
          revision: nextRevision,
          ...input.draft,
        },
        messages: [
          ...current.messages,
          ...input.appendedMessages.map((message: InterviewMessageInputV1) => ({
            interviewId: current!.interview.id,
            schemaVersion: 1 as const,
            ...message,
          })),
        ],
      };
      return structuredClone(current);
    }),
    saveGeneratedQuestion: vi.fn(async (_revisionToken, input) => {
      if (!current?.draft || current.interview.schemaVersion !== 2) throw new Error("missing-current");
      const nextRevision = current.interview.revision + 1;
      current = aggregateFor(input.question, current.messages, nextRevision);
      return structuredClone(current);
    }),
    saveSafetyReview: vi.fn(async (_revisionToken, input) => {
      if (!current?.draft) throw new Error("missing-current");
      const nextRevision = current.interview.revision + 1;
      current = {
        ...current,
        interview: { ...current.interview, revision: nextRevision },
        draft: { ...current.draft, revision: nextRevision },
        messages: [
          ...current.messages,
          ...input.appendedMessages.map((message: InterviewMessageInputV1) => ({
            interviewId: current!.interview.id,
            schemaVersion: 1 as const,
            ...message,
          })),
        ],
      };
      return structuredClone(current);
    }),
    saveSummary: vi.fn(async (_revisionToken, input: SaveSummaryInputV1) => {
      if (!current?.draft) throw new Error("missing-current");
      const nextRevision = current.interview.revision + 1;
      current = {
        ...current,
        interview: { ...current.interview, revision: nextRevision, status: "review" },
        draft: { ...current.draft, revision: nextRevision },
        summary: {
          interviewId: current.interview.id,
          schemaVersion: 1,
          revision: nextRevision,
          status: "review",
          ...input,
        },
      };
      return structuredClone(current);
    }),
    confirmSafetyStop: vi.fn(),
    complete: vi.fn(),
  } satisfies AiInterviewRepositoryPort;
  return { repository, getCurrent: () => current };
}

function createClient(overrides: Partial<PublicAiClient> = {}): PublicAiClient {
  return {
    requestQuestion: vi.fn().mockResolvedValue(providerQuestion()),
    requestSummary: vi.fn().mockResolvedValue({
      version: "2",
      kind: "summary",
      summary: {
        subjective: [],
        objective: [],
        verificationNeeded: [],
      },
    }),
    ...overrides,
  };
}

function createService(
  aggregate?: InterviewAggregateV1,
  options: {
    client?: PublicAiClient;
    maximumFollowUps?: number;
    assertAiTransferConsent?: () => Promise<void>;
    captureRuntimeGeneration?: () => number;
    repositoryOverrides?: Partial<AiInterviewRepositoryPort>;
  } = {},
) {
  const holder = createRepository(aggregate);
  Object.assign(holder.repository, options.repositoryOverrides);
  const client = options.client ?? createClient();
  const service = createAiInterviewService({
    repository: holder.repository,
    client,
    maximumFollowUps: options.maximumFollowUps,
    assertAiTransferConsent: options.assertAiTransferConsent ?? vi.fn().mockResolvedValue(undefined),
    captureRuntimeGeneration: options.captureRuntimeGeneration ?? (() => 7),
    now: () => new Date(NOW),
    randomId: (() => {
      let id = 0;
      return () => `immutable-${++id}`;
    })(),
  });
  return { ...holder, client, service };
}

describe("AI interview service", () => {
  it("새 AI 문진을 deterministic 첫 질문과 empty V2 draft로 만든다", async () => {
    const { repository, service } = createService();

    const snapshot = await service.loadOrCreate({ runtimeGeneration: 7 });

    expect(repository.findOrCreateAi).toHaveBeenCalledWith(expect.objectContaining({
      mode: "ai",
      questionSetSnapshot: {
        contractVersion: 2,
        id: "public-ai-intake-v2",
        questions: [FIRST],
      },
      draft: expect.objectContaining({
        input: expect.objectContaining({
          commonDraft: expect.objectContaining({
            contractVersion: 2,
            questionId: FIRST.id,
            values: expect.objectContaining({ text: { value: "" } }),
          }),
        }),
      }),
    }));
    expect(snapshot).toMatchObject({ phase: "answering", question: FIRST });
  });

  it("동시 loadOrCreate는 하나의 repository find-or-create를 공유한다", async () => {
    const { repository, service } = createService();

    const [first, second] = await Promise.all([
      service.loadOrCreate({ runtimeGeneration: 7 }),
      service.loadOrCreate({ runtimeGeneration: 7 }),
    ]);

    expect(repository.findOrCreateAi).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
  });

  it("현재 snapshot 질문과 마지막 Q/A가 같으면 reload를 waiting-for-question으로 복원한다", () => {
    const aggregate = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);

    expect(deriveAiContinuation(aggregate, 7)).toMatchObject({
      phase: "waiting-for-question",
      interview: { interviewId: aggregate.interview.id, revision: 2, runtimeGeneration: 7 },
      history: [{
        id: "answer-message-1",
        questionMessageId: "question-message-0",
        answerMessageId: "answer-message-1",
        question: FIRST.text,
        answer: "무릎이 불편해요.",
      }],
    });
  });

  it("마지막 Q/A와 다른 다음 snapshot 질문은 answering으로 복원해 답한 질문을 반복하지 않는다", () => {
    const next = generatedQuestion();
    const aggregate = aggregateFor(next, pair(FIRST, "무릎이 불편해요."), 3);

    expect(deriveAiContinuation(aggregate, 7)).toMatchObject({
      phase: "answering",
      question: next,
      draft: { questionId: next.id },
    });
  });

  it("문구가 같은 질문도 immutable snapshot ordinal로 서로 다른 slot에 연결한다", () => {
    const duplicateTextQuestion = {
      ...generatedQuestion("provider-question-duplicate"),
      text: FIRST.text,
      slot: "duration",
    } satisfies QuestionSnapshotV2;
    const messages = [
      ...pair(FIRST, "무릎이 불편해요."),
      ...pair(duplicateTextQuestion, "오늘부터", 2),
    ];
    const aggregate = aggregateFor(duplicateTextQuestion, messages, 4);

    expect(deriveAiContinuation(aggregate, 7)).toMatchObject({
      phase: "waiting-for-question",
      history: [
        expect.objectContaining({ questionId: FIRST.id, slot: FIRST.slot }),
        expect.objectContaining({
          questionId: duplicateTextQuestion.id,
          slot: "duration",
        }),
      ],
    });
  });

  it("기본 최대 3개 AI follow-up을 답하면 summary 대기로 복원한다", () => {
    const questions = [
      generatedQuestion("provider-question-001"),
      { ...generatedQuestion("provider-question-002"), text: "증상은 얼마나 자주 나타나나요?" },
      { ...generatedQuestion("provider-question-003"), text: "불편함의 정도는 어떤가요?" },
    ];
    const messages = [
      ...pair(FIRST, "무릎이 불편해요."),
      ...pair(questions[0], "오늘부터", 2),
      ...pair(questions[1], "자주 나타나요.", 4),
      ...pair(questions[2], "많이 불편해요.", 6),
    ];
    const aggregate = aggregateFor(questions[2], messages, 8);
    if (aggregate.interview.schemaVersion !== 2) throw new Error("expected-v2");
    aggregate.interview.questionSetSnapshot.questions = [FIRST, ...questions];

    expect(deriveAiContinuation(aggregate, 7)).toMatchObject({
      phase: "waiting-for-summary",
      answeredAiFollowUps: 3,
    });
  });

  it("draft 검증 뒤 urgent를 판정해 Q/A와 safety를 원자 저장하고 외부 호출하지 않는다", async () => {
    const urgentDraft = draftFor(FIRST, "지금 숨을 쉬기가 매우 힘들어요.");
    const aggregate = aggregateFor(FIRST, [], 1, urgentDraft);
    const client = createClient();
    const { repository, service } = createService(aggregate, { client });

    const result = await service.submitAnswer({
      token: token(aggregate),
      answer: { mode: "text", value: "지금 숨을 쉬기가 매우 힘들어요." },
    });

    expect(repository.saveProgress).not.toHaveBeenCalled();
    expect(repository.saveSafetyReview).toHaveBeenCalledOnce();
    expect(repository.saveSafetyReview).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 1, runtimeGeneration: 7 }),
      expect.objectContaining({
        appendedMessages: [
          expect.objectContaining({ role: "assistant", kind: "question", text: FIRST.text }),
          expect.objectContaining({ role: "user", kind: "answer", text: "지금 숨을 쉬기가 매우 힘들어요." }),
          expect.objectContaining({ role: "system", kind: "safety", text: PUBLIC_AI_SAFETY_MESSAGE }),
        ],
      }),
    );
    expect(client.requestQuestion).not.toHaveBeenCalled();
    expect(client.requestSummary).not.toHaveBeenCalled();
    expect(result).toMatchObject({ phase: "safety-review", reason: "breathing" });
  });

  it("유효하지 않은 durable draft는 safety 검사와 저장 전에 거절한다", async () => {
    const aggregate = aggregateFor(FIRST);
    const { repository, service } = createService(aggregate);

    await expect(service.submitAnswer({
      token: token(aggregate),
      answer: { mode: "text", value: "호흡이 힘들어요." },
    })).rejects.toThrow("invalid-draft");
    expect(repository.saveProgress).not.toHaveBeenCalled();
    expect(repository.saveSafetyReview).not.toHaveBeenCalled();
  });

  it("부정된 위험 문구는 정상 commit 뒤 V2 question client를 호출한다", async () => {
    const answer = "지금 숨쉬기가 힘들지 않고 괜찮아요.";
    const aggregate = aggregateFor(FIRST, [], 1, draftFor(FIRST, answer));
    const { client, repository, service } = createService(aggregate);

    const waiting = await service.submitAnswer({
      token: token(aggregate),
      answer: { mode: "text", value: answer },
    });
    expect(waiting.phase).toBe("waiting-for-question");
    expect(repository.saveProgress).toHaveBeenCalledOnce();
    expect(repository.saveSafetyReview).not.toHaveBeenCalled();

    await service.requestAiQuestion({
      token: { ...token(aggregate), baseRevision: 2, requestId: "question-request" },
      history: waiting.phase === "waiting-for-question" ? waiting.history : [],
    });

    expect(client.requestQuestion).toHaveBeenCalledOnce();
    expect(client.requestQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ version: "2", interviewId: "ai-interview-001" }),
    );
  });

  it("application adapter의 abort signal을 question client에 전달한다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const controller = new AbortController();
    const requestQuestion = vi.fn().mockResolvedValue(providerQuestion());
    const { service } = createService(answered, {
      client: createClient({ requestQuestion }),
    });

    await service.requestAiQuestion({
      token: token(answered),
      history: [],
      signal: controller.signal,
    });

    expect(requestQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ version: "2" }),
      controller.signal,
    );
  });

  it("question fetch 뒤 generated-question 저장 중 abort되면 durable commit을 남기지 않는다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const persistenceStarted = deferred<void>();
    const releasePersistence = deferred<void>();
    let commits = 0;
    const saveGeneratedQuestion = vi.fn(async (_token, _input, signal) => {
      persistenceStarted.resolve();
      await releasePersistence.promise;
      if (signal?.aborted) {
        throw new DOMException("합성 저장 취소", "AbortError");
      }
      commits += 1;
      return aggregateFor(generatedQuestion(), answered.messages, 3);
    });
    const { service } = createService(answered, {
      repositoryOverrides: { saveGeneratedQuestion },
    });
    const adapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: createRuntimeOperationCoordinator(),
    });

    const requesting = adapter.requestAiQuestion({
      token: token(answered),
      history: [],
    });
    await persistenceStarted.promise;
    adapter.dispose();
    releasePersistence.resolve();

    await expect(requesting).rejects.toMatchObject({ name: "AbortError" });
    expect(commits).toBe(0);
  });

  it("question complete marker 저장 중 abort되면 durable commit을 남기지 않는다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const persistenceStarted = deferred<void>();
    const releasePersistence = deferred<void>();
    let commits = 0;
    const saveProgress = vi.fn(async (_token, _input, signal) => {
      persistenceStarted.resolve();
      await releasePersistence.promise;
      if (signal?.aborted) {
        throw new DOMException("합성 저장 취소", "AbortError");
      }
      commits += 1;
      return aggregateFor(
        FIRST,
        [...answered.messages, completionMarker(2)],
        3,
      );
    });
    const { service } = createService(answered, {
      client: createClient({
        requestQuestion: vi.fn().mockResolvedValue(providerComplete()),
      }),
      repositoryOverrides: { saveProgress },
    });
    const adapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: createRuntimeOperationCoordinator(),
    });

    const requesting = adapter.requestAiQuestion({
      token: token(answered),
      history: [],
    });
    await persistenceStarted.promise;
    adapter.dispose();
    releasePersistence.resolve();

    await expect(requesting).rejects.toMatchObject({ name: "AbortError" });
    expect(commits).toBe(0);
  });

  it("question 오류는 service 재호출 없이 deterministic fallback 질문을 저장한다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const client = createClient({
      requestQuestion: vi.fn().mockRejectedValue(new Error("provider-retries-exhausted")),
    });
    const { repository, service } = createService(answered, { client });

    const result = await service.requestAiQuestion({ token: token(answered), history: [] });

    expect(client.requestQuestion).toHaveBeenCalledOnce();
    expect(repository.saveGeneratedQuestion).toHaveBeenCalledOnce();
    expect(repository.saveGeneratedQuestion.mock.calls[0]?.[1].question).toMatchObject({
      contractVersion: 2,
      id: expect.stringContaining("fallback"),
    });
    expect(result.phase).toBe("answering");
  });

  it("provider complete를 기존 message history에 원자 저장해 reload도 summary 대기로 복원한다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const client = createClient({
      requestQuestion: vi.fn().mockResolvedValue(providerComplete()),
    });
    const { getCurrent, repository, service } = createService(answered, { client });

    const result = await service.requestAiQuestion({
      token: token(answered),
      history: [],
    });

    expect(repository.saveProgress).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 2, runtimeGeneration: 7 }),
      expect.objectContaining({
        appendedMessages: [expect.objectContaining({
          role: "system",
          kind: "completion",
          text: PUBLIC_AI_COMPLETION_MARKER,
        })],
      }),
    );
    expect(result).toMatchObject({
      phase: "waiting-for-summary",
      interview: { revision: 3 },
    });
    const restored = getCurrent();
    if (!restored) throw new Error("missing-restored");
    expect(deriveAiContinuation(restored, 7)).toMatchObject({
      phase: "waiting-for-summary",
      interview: { revision: 3 },
    });
  });

  it("다른 exact operation이 시작된 뒤 도착한 stale complete는 marker를 저장하지 않는다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    let resolveFirst!: (value: ReturnType<typeof providerComplete>) => void;
    let resolveSecond!: (value: ReturnType<typeof providerQuestion>) => void;
    const client = createClient({
      requestQuestion: vi.fn()
        .mockImplementationOnce(() => new Promise((resolve) => {
          resolveFirst = resolve;
        }))
        .mockImplementationOnce(() => new Promise((resolve) => {
          resolveSecond = resolve;
        })),
    });
    const { repository, service } = createService(answered, { client });
    const first = service.requestAiQuestion({
      token: token(answered),
      history: [],
    });
    await vi.waitFor(() => expect(client.requestQuestion).toHaveBeenCalledTimes(1));
    const second = service.requestAiQuestion({
      token: {
        ...token(answered),
        sessionId: "session-002",
        requestId: "request-002",
      },
      history: [],
    });
    await vi.waitFor(() => expect(client.requestQuestion).toHaveBeenCalledTimes(2));

    resolveFirst(providerComplete());
    await expect(first).rejects.toThrow("stale-ai-operation");
    expect(repository.saveProgress).not.toHaveBeenCalled();

    resolveSecond(providerQuestion());
    await second;
    expect(repository.saveGeneratedQuestion).toHaveBeenCalledOnce();
  });

  it("안전 validator가 거절한 model 질문은 저장하지 않고 fallback만 저장한다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const client = createClient({
      requestQuestion: vi.fn().mockResolvedValue({
        ...providerQuestion(),
        question: { ...providerQuestion().question, text: "약을 중단하세요?" },
      }),
    });
    const { repository, service } = createService(answered, { client });

    await service.requestAiQuestion({ token: token(answered), history: [] });

    const stored = repository.saveGeneratedQuestion.mock.calls[0]?.[1].question;
    expect(stored.id).toContain("fallback");
    expect(stored.text).not.toBe("약을 중단하세요?");
  });

  it("질문형이 아닌 model 출력은 저장하지 않고 fallback 질문으로 전환한다", async () => {
    const originalAnswer = "합성 상황에서 무릎이 불편해요.";
    const answered = aggregateFor(FIRST, pair(FIRST, originalAnswer), 2);
    const repeatedAnswer = "합성 상황에서 무릎이 불편해요?";
    const client = createClient({
      requestQuestion: vi.fn().mockResolvedValue({
        ...providerQuestion(),
        question: { ...providerQuestion().question, text: repeatedAnswer },
      }),
    });
    const { repository, service } = createService(answered, { client });

    await service.requestAiQuestion({ token: token(answered), history: [] });

    const stored = repository.saveGeneratedQuestion.mock.calls[0]?.[1].question;
    expect(stored.id).toContain("fallback");
    expect(stored.text).not.toBe(repeatedAnswer);
  });

  it("설정된 최소 follow-up 1개를 답하면 추가 question 호출 없이 summary로 간다", async () => {
    const followUp = generatedQuestion();
    const messages = [...pair(FIRST, "무릎이 불편해요."), ...pair(followUp, "오늘부터", 2)];
    const answered = aggregateFor(followUp, messages, 4);
    const client = createClient();
    const { service } = createService(answered, { client, maximumFollowUps: 1 });

    const result = await service.requestAiQuestion({ token: token(answered), history: [] });

    expect(result.phase).toBe("waiting-for-summary");
    expect(client.requestQuestion).not.toHaveBeenCalled();
  });

  it("정상 summary는 immutable answer message ID를 evidence로 source ai에 저장한다", async () => {
    const messages = [
      ...pair(FIRST, "오늘부터 무릎이 불편해요."),
      completionMarker(2),
    ];
    const answered = aggregateFor(FIRST, messages, 3);
    const client = createClient({
      requestSummary: vi.fn().mockResolvedValue({
        version: "2",
        kind: "summary",
        summary: {
          subjective: [{
            id: "summary-001",
            text: "오늘부터 무릎이 불편해요.",
            evidenceTurnIds: ["answer-message-1"],
          }],
          objective: [],
          verificationNeeded: [],
        },
      }),
    });
    const { repository, service } = createService(answered, { client });

    const result = await service.requestAiSummary({ token: token(answered), history: [] });

    expect(repository.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 3 }),
      expect.objectContaining({
        source: "ai",
        content: {
          subjective: [{
            id: "summary-001",
            text: "오늘부터 무릎이 불편해요.",
            evidenceMessageIds: ["answer-message-1"],
          }],
          objective: [],
          verificationNeeded: [],
        },
      }),
    );
    expect(result.phase).toBe("review");
  });

  it("summary fetch 뒤 저장 중 abort되면 durable commit을 남기지 않는다", async () => {
    const answered = aggregateFor(
      FIRST,
      [...pair(FIRST, "무릎이 불편해요."), completionMarker(2)],
      3,
    );
    const persistenceStarted = deferred<void>();
    const releasePersistence = deferred<void>();
    let commits = 0;
    const saveSummary = vi.fn(async (_token, _input, signal) => {
      persistenceStarted.resolve();
      await releasePersistence.promise;
      if (signal?.aborted) {
        throw new DOMException("합성 저장 취소", "AbortError");
      }
      commits += 1;
      return answered;
    });
    const { service } = createService(answered, {
      repositoryOverrides: { saveSummary },
    });
    const adapter = createAiInterviewApplicationRepositoryPort({
      service,
      runtimeCoordinator: createRuntimeOperationCoordinator(),
    });

    const requesting = adapter.requestAiSummary({
      token: token(answered),
      history: [],
    });
    await persistenceStarted.promise;
    adapter.dispose();
    releasePersistence.resolve();

    await expect(requesting).rejects.toMatchObject({ name: "AbortError" });
    expect(commits).toBe(0);
  });

  it.each(["error", "empty"] as const)("summary %s는 deterministic source manual로 복구한다", async (kind) => {
    const answered = aggregateFor(
      FIRST,
      [...pair(FIRST, "무릎이 불편해요."), completionMarker(2)],
      3,
    );
    const client = createClient({
      requestSummary: kind === "error"
        ? vi.fn().mockRejectedValue(new Error("summary-failed"))
        : vi.fn().mockResolvedValue({
            version: "2",
            kind: "summary",
            summary: { subjective: [], objective: [], verificationNeeded: [] },
          }),
    });
    const { repository, service } = createService(answered, { client });

    await service.requestAiSummary({ token: token(answered), history: [] });

    expect(repository.saveSummary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: "manual",
        content: expect.objectContaining({
          subjective: [expect.objectContaining({
            text: "무릎이 불편해요.",
            evidenceMessageIds: ["answer-message-1"],
          })],
        }),
      }),
    );
  });

  it("durable waiting-for-summary 전에는 consent와 summary client를 호출하지 않는다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const assertAiTransferConsent = vi.fn().mockResolvedValue(undefined);
    const client = createClient();
    const { repository, service } = createService(answered, {
      client,
      assertAiTransferConsent,
    });

    await expect(service.requestAiSummary({ token: token(answered), history: [] }))
      .rejects.toThrow("ai-summary-not-waiting");

    expect(assertAiTransferConsent).not.toHaveBeenCalled();
    expect(client.requestSummary).not.toHaveBeenCalled();
    expect(repository.saveSummary).not.toHaveBeenCalled();
  });

  it("AI 전송 동의를 외부 호출 전에 확인한다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    const order: string[] = [];
    const client = createClient({
      requestQuestion: vi.fn(async () => {
        order.push("external");
        return providerQuestion();
      }),
    });
    const { repository, service } = createService(answered, {
      client,
      assertAiTransferConsent: async () => {
        order.push("consent");
        throw new Error("ai-transfer-consent-required");
      },
    });

    await expect(service.requestAiQuestion({ token: token(answered), history: [] }))
      .rejects.toThrow("ai-transfer-consent-required");
    expect(order).toEqual(["consent"]);
    expect(repository.saveGeneratedQuestion).not.toHaveBeenCalled();
  });

  it("외부 응답 중 runtime generation이 바뀌면 stale 결과를 저장하지 않는다", async () => {
    const answered = aggregateFor(FIRST, pair(FIRST, "무릎이 불편해요."), 2);
    let generation = 7;
    const client = createClient({
      requestQuestion: vi.fn(async () => {
        generation = 8;
        return providerQuestion();
      }),
    });
    const { repository, service } = createService(answered, {
      client,
      captureRuntimeGeneration: () => generation,
    });

    await expect(service.requestAiQuestion({ token: token(answered), history: [] }))
      .rejects.toThrow("stale-runtime-generation");
    expect(repository.saveGeneratedQuestion).not.toHaveBeenCalled();
  });

  it("safety action만 terminal 저장소에 전달한다", async () => {
    const safetyMessages = [
      ...pair(FIRST, "지금 숨을 쉬기가 매우 힘들어요."),
      {
        interviewId: "ai-interview-001",
        schemaVersion: 1 as const,
        id: "safety-message-2",
        sequence: 2,
        role: "system" as const,
        kind: "safety" as const,
        text: PUBLIC_AI_SAFETY_MESSAGE,
        createdAt: NOW,
      },
    ];
    const reviewed = aggregateFor(FIRST, safetyMessages, 2);
    const { repository, service } = createService(reviewed);
    repository.confirmSafetyStop.mockResolvedValue({
      ...reviewed,
      interview: { ...reviewed.interview, revision: 3, status: "safety-stopped" },
      draft: undefined,
    });

    const result = await service.acknowledgeSafety({
      token: token(reviewed),
      action: "call-119",
    });

    expect(repository.confirmSafetyStop).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 2, runtimeGeneration: 7 }),
      "call-119",
    );
    expect(result).toEqual({
      phase: "safety-stopped",
      interviewId: reviewed.interview.id,
    });
  });
});

describe("public AI V2 HTTP client", () => {
  it("Persona와 profile 없이 V2 allowlist payload만 전송하고 응답 shape를 검증한다", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(providerQuestion()),
    });
    const client = createPublicAiHttpClient({ fetch: fetch as unknown as typeof globalThis.fetch });

    const runtimeContext = {
      version: "2",
      interviewId: "ai-interview-001",
      currentSlot: "chief-complaint",
      filledSlots: { "chief-complaint": "무릎이 불편해요." },
      recentTurns: [{
        id: "answer-message-1",
        question: FIRST.text,
        answer: "무릎이 불편해요.",
        profile: { displayName: "전송되면 안 됨" },
      }],
      personaId: "persona-kim",
      profile: { displayName: "전송되면 안 됨" },
    } as unknown as Parameters<typeof client.requestQuestion>[0];

    const result = await client.requestQuestion(runtimeContext);

    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(body).toEqual({
      version: "2",
      interviewId: "ai-interview-001",
      currentSlot: "chief-complaint",
      filledSlots: { "chief-complaint": "무릎이 불편해요." },
      recentTurns: [{ id: "answer-message-1", question: FIRST.text, answer: "무릎이 불편해요." }],
    });
    expect(body).not.toHaveProperty("personaId");
    expect(body).not.toHaveProperty("profile");
    expect(result).toEqual(providerQuestion());
  });

  it("전달받은 abort signal을 fetch에 연결한다", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(providerQuestion()),
    });
    const client = createPublicAiHttpClient({
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const controller = new AbortController();

    await client.requestQuestion({
      version: "2",
      interviewId: "ai-interview-001",
      filledSlots: {},
      recentTurns: [],
    }, controller.signal);

    expect(fetch).toHaveBeenCalledWith("/api/ai/question", expect.objectContaining({
      signal: controller.signal,
    }));
  });
});
