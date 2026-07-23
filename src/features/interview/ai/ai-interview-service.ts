import type {
  AiInterviewContextV2,
  AiQuestionResponseV2,
  AiSummaryResponseV2,
} from "@/lib/ai/contracts";
import { validateGeneratedQuestion } from "@/lib/ai/question-safety-validator";
import { validateSummaryEvidence } from "@/lib/ai/summary-evidence-validator";
import {
  parseAiInterviewContextV2,
  parseAiQuestionResponseV2,
  parseAiSummaryResponseV2,
} from "@/lib/ai/validators";
import {
  toUtcTimestamp,
  type CreateInterviewInputV2,
  type InterviewAggregateV1,
  type InterviewDraftInputV2,
  type InterviewMessageInputV1,
  type RevisionToken,
  type SafetyStopActionV1,
  type SaveGeneratedQuestionInputV2,
  type SaveProgressInputV2,
  type SaveSafetyReviewInputV1,
  type SaveSummaryInputV1,
  type SummaryContentV1,
} from "@/lib/db/contracts";
import { DatabaseCorruptionError } from "@/lib/db/errors";
import type { InterviewRepository } from "@/lib/db/interview-repository";
import type {
  InterviewQuestion,
  InterviewSlotId,
  InterviewSummary,
} from "../model/interview-domain.types";
import {
  createEmptyDraft,
  validateDraft,
  type CommonDraftV2,
  type QuestionSnapshotV2,
  type ValidatedAnswerV2,
} from "../domain/interview-draft";
import {
  runSafetyPreflight,
  type SafetyPreflightResult,
} from "../domain/safety-preflight";
import {
  createDeterministicFallbackAiQuestion,
  createDeterministicFirstAiQuestion,
  createManualSummary,
  PUBLIC_AI_QUESTION_SET_ID,
} from "../manual/manual-question-set";

export const PUBLIC_AI_SAFETY_MESSAGE =
  "지금은 문진보다 안전이 먼저예요. 즉시 119나 주변 사람에게 도움을 요청해 주세요.";
export const PUBLIC_AI_COMPLETION_MARKER =
  "public-ai-question-generation-complete:v1";

const FALLBACK_ID_PREFIX = "public-ai-fallback:";

export type AiServiceOperationToken = {
  sessionId: string;
  requestId: string;
  interviewId: string;
  baseRevision: number;
  runtimeGeneration: number;
};

export type AiTurnSnapshot = {
  id: string;
  questionMessageId: string;
  answerMessageId: string;
  questionId: string;
  slot: string;
  question: string;
  answer: string;
};

export type AiAnsweringSnapshot = {
  phase: "answering";
  interview: AiInterviewIdentity;
  question: QuestionSnapshotV2;
  draft: CommonDraftV2;
};

export type AiReviewSnapshot = {
  phase: "review";
  interview: AiInterviewIdentity;
  summary: { items: string[]; source: "ai" | "manual" };
};

export type AiInterviewIdentity = {
  interviewId: string;
  revision: number;
  runtimeGeneration: number;
};

export type AiContinuationSnapshot =
  | {
      phase: "waiting-for-question" | "waiting-for-summary";
      interview: AiInterviewIdentity;
      history: AiTurnSnapshot[];
      answeredAiFollowUps: number;
    }
  | {
      phase: "safety-review";
      interview: AiInterviewIdentity;
      history: AiTurnSnapshot[];
      reason: Exclude<SafetyPreflightResult, { kind: "none" } | { kind: "verification-needed" }>[
        "reason"
      ];
      message: string;
      actions: SafetyStopActionV1[];
    }
  | { phase: "safety-stopped"; interviewId: string };

export type AiServiceSnapshot =
  | AiAnsweringSnapshot
  | AiReviewSnapshot
  | AiContinuationSnapshot;

export type AiInterviewRepositoryPort = Pick<
  InterviewRepository,
  | "findOrCreateAi"
  | "loadInProgress"
  | "persistDraft"
  | "saveProgress"
  | "saveGeneratedQuestion"
  | "saveSafetyReview"
  | "saveSummary"
  | "confirmSafetyStop"
  | "complete"
>;

export type PublicAiClient = {
  requestQuestion(
    context: AiInterviewContextV2,
    signal?: AbortSignal,
  ): Promise<AiQuestionResponseV2>;
  requestSummary(
    context: AiInterviewContextV2,
    signal?: AbortSignal,
  ): Promise<AiSummaryResponseV2>;
};

export class PublicAiHttpError extends Error {
  constructor(readonly status: number) {
    super(`public-ai-request-failed:${status}`);
    this.name = "PublicAiHttpError";
  }
}

type PublicAiHttpClientOptions = {
  fetch?: typeof globalThis.fetch;
};

export function createPublicAiHttpClient({
  fetch: fetchImplementation = globalThis.fetch,
}: PublicAiHttpClientOptions = {}): PublicAiClient {
  async function post(
    path: string,
    context: AiInterviewContextV2,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const payload = parseAiInterviewContextV2({
      version: context.version,
      interviewId: context.interviewId,
      ...(context.currentSlot === undefined
        ? {}
        : { currentSlot: context.currentSlot }),
      filledSlots: { ...context.filledSlots },
      recentTurns: context.recentTurns.map(({ id, question, answer }) => ({
        id,
        question,
        answer,
      })),
    });
    const response = await fetchImplementation(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) throw new PublicAiHttpError(response.status);
    return response.json();
  }

  return {
    async requestQuestion(context, signal) {
      return parseAiQuestionResponseV2(
        await post("/api/ai/question", context, signal),
      );
    },
    async requestSummary(context, signal) {
      return parseAiSummaryResponseV2(
        await post("/api/ai/summary", context, signal),
        new Set(context.recentTurns.map(({ id }) => id)),
      );
    },
  };
}

function maximumFollowUps(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 3;
  return Math.min(3, Math.max(1, Math.trunc(value)));
}

function identity(
  aggregate: InterviewAggregateV1,
  runtimeGeneration: number,
): AiInterviewIdentity {
  return {
    interviewId: aggregate.interview.id,
    revision: aggregate.interview.revision,
    runtimeGeneration,
  };
}

function requireAiV2Aggregate(aggregate: InterviewAggregateV1): asserts aggregate is
  InterviewAggregateV1 & {
    interview: Extract<InterviewAggregateV1["interview"], { schemaVersion: 2 }>;
    draft: Extract<NonNullable<InterviewAggregateV1["draft"]>, { schemaVersion: 2 }>;
  } {
  if (
    aggregate.interview.mode !== "ai" ||
    aggregate.interview.schemaVersion !== 2 ||
    !aggregate.draft ||
    aggregate.draft.schemaVersion !== 2 ||
    aggregate.draft.interviewId !== aggregate.interview.id ||
    aggregate.draft.revision !== aggregate.interview.revision
  ) {
    throw new DatabaseCorruptionError();
  }
}

function deriveTurns(
  aggregate: InterviewAggregateV1 & {
    interview: Extract<InterviewAggregateV1["interview"], { schemaVersion: 2 }>;
  },
): AiTurnSnapshot[] {
  const turns: AiTurnSnapshot[] = [];
  let messageIndex = 0;
  let questionOrdinal = 0;
  while (messageIndex < aggregate.messages.length) {
    const questionMessage = aggregate.messages[messageIndex];
    if (
      questionMessage?.role === "system" &&
      (questionMessage.kind === "safety" || questionMessage.kind === "completion")
    ) {
      if (messageIndex !== aggregate.messages.length - 1) {
        throw new DatabaseCorruptionError();
      }
      break;
    }
    const answerMessage = aggregate.messages[messageIndex + 1];
    const question =
      aggregate.interview.questionSetSnapshot.questions[questionOrdinal];
    if (
      questionMessage?.role !== "assistant" ||
      questionMessage.kind !== "question" ||
      answerMessage?.role !== "user" ||
      answerMessage.kind !== "answer" ||
      questionMessage.sequence !== messageIndex ||
      answerMessage.sequence !== messageIndex + 1 ||
      !question ||
      questionMessage.text !== question.text
    ) {
      throw new DatabaseCorruptionError();
    }
    turns.push({
      id: answerMessage.id,
      questionMessageId: questionMessage.id,
      answerMessageId: answerMessage.id,
      questionId: question.id,
      slot: question.slot,
      question: questionMessage.text,
      answer: answerMessage.text,
    });
    messageIndex += 2;
    questionOrdinal += 1;
  }
  return turns;
}

function summaryItems(content: SummaryContentV1): string[] {
  return [
    ...content.subjective,
    ...content.objective,
    ...content.verificationNeeded,
  ].map(({ text }) => text);
}

export function deriveAiContinuation(
  aggregate: InterviewAggregateV1,
  runtimeGeneration: number,
  configuredMaximumFollowUps?: number,
): AiServiceSnapshot {
  if (
    aggregate.interview.status === "review" &&
    aggregate.summary &&
    aggregate.summary.revision === aggregate.interview.revision
  ) {
    return {
      phase: "review",
      interview: identity(aggregate, runtimeGeneration),
      summary: {
        items: summaryItems(aggregate.summary.content),
        source: aggregate.summary.source,
      },
    };
  }
  requireAiV2Aggregate(aggregate);
  const history = deriveTurns(aggregate);
  const lastMessage = aggregate.messages.at(-1);
  if (lastMessage?.role === "system" && lastMessage.kind === "safety") {
    const lastTurn = history.at(-1);
    const result = lastTurn ? runSafetyPreflight(lastTurn.answer) : { kind: "none" as const };
    if (result.kind !== "urgent") throw new DatabaseCorruptionError();
    return {
      phase: "safety-review",
      interview: identity(aggregate, runtimeGeneration),
      history,
      reason: result.reason,
      message: lastMessage.text,
      actions: ["call-119", "show-to-bystander", "view-summary"],
    };
  }

  const currentQuestion = aggregate.interview.questionSetSnapshot.questions.find(
    ({ id }) => id === aggregate.draft.currentQuestion.id,
  );
  if (!currentQuestion) throw new DatabaseCorruptionError();
  const lastTurn = history.at(-1);
  const firstQuestionId = createDeterministicFirstAiQuestion().id;
  const answeredAiFollowUps = history.filter(
    ({ questionId }) =>
      questionId !== firstQuestionId && !questionId.startsWith(FALLBACK_ID_PREFIX),
  ).length;
  if (lastMessage?.role === "system" && lastMessage.kind === "completion") {
    if (
      lastMessage.text !== PUBLIC_AI_COMPLETION_MARKER ||
      lastTurn?.questionId !== currentQuestion.id
    ) {
      throw new DatabaseCorruptionError();
    }
    return {
      phase: "waiting-for-summary",
      interview: identity(aggregate, runtimeGeneration),
      history,
      answeredAiFollowUps,
    };
  }
  if (!lastTurn || lastTurn.questionId !== currentQuestion.id) {
    return {
      phase: "answering",
      interview: identity(aggregate, runtimeGeneration),
      question: structuredClone(currentQuestion),
      draft: structuredClone(aggregate.draft.input.commonDraft),
    };
  }

  const phase =
    currentQuestion.id.startsWith(FALLBACK_ID_PREFIX) ||
      answeredAiFollowUps >= maximumFollowUps(configuredMaximumFollowUps)
      ? "waiting-for-summary"
      : "waiting-for-question";
  return {
    phase,
    interview: identity(aggregate, runtimeGeneration),
    history,
    answeredAiFollowUps,
  };
}

function revisionToken(token: AiServiceOperationToken): RevisionToken {
  return {
    interviewId: token.interviewId,
    expectedRevision: token.baseRevision,
    runtimeGeneration: token.runtimeGeneration,
  };
}

function currentQuestion(
  aggregate: InterviewAggregateV1 & {
    interview: Extract<InterviewAggregateV1["interview"], { schemaVersion: 2 }>;
    draft: Extract<NonNullable<InterviewAggregateV1["draft"]>, { schemaVersion: 2 }>;
  },
): QuestionSnapshotV2 {
  const question = aggregate.interview.questionSetSnapshot.questions.find(
    ({ id }) => id === aggregate.draft.currentQuestion.id,
  );
  if (!question) throw new DatabaseCorruptionError();
  return question;
}

function sameAnswer(left: ValidatedAnswerV2, right: ValidatedAnswerV2): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function answerText(question: QuestionSnapshotV2, answer: ValidatedAnswerV2): string {
  if (answer.mode === "text") return answer.value;
  if (answer.mode === "measurement") {
    if (answer.value.state === "unknown") return "잘 모르겠어요";
    const measurement = answer.value;
    const unit = question.contracts.measurement?.units.find(
      ({ id }) => id === measurement.unitId,
    )?.label ?? measurement.unitId;
    return `${measurement.value} ${unit}${
      measurement.measuredAt ? `, ${measurement.measuredAt}` : ""
    }`;
  }
  const contract = answer.mode === "chip"
    ? question.contracts.chip
    : question.contracts.choice;
  if (!contract) throw new DatabaseCorruptionError();
  const selected = new Set(answer.value.selectedOptionIds);
  return contract.options
    .filter(({ id }) => selected.has(id))
    .map(({ label }) => label)
    .join(", ");
}

function draftInput(
  aggregate: InterviewAggregateV1 & {
    draft: Extract<NonNullable<InterviewAggregateV1["draft"]>, { schemaVersion: 2 }>;
  },
  question: QuestionSnapshotV2,
  timestamp: ReturnType<typeof toUtcTimestamp>,
): InterviewDraftInputV2 {
  const commonDraft = createEmptyDraft(question);
  return {
    currentQuestion: structuredClone(aggregate.draft.currentQuestion),
    input: {
      mode: commonDraft.activeMode === "chip" ? "choice" : commonDraft.activeMode,
      text: "",
      selectedOptionIds: [],
      commonDraft,
    },
    updatedAt: timestamp,
  };
}

function aiContext(
  aggregate: InterviewAggregateV1 & {
    interview: Extract<InterviewAggregateV1["interview"], { schemaVersion: 2 }>;
  },
  history: readonly AiTurnSnapshot[],
): AiInterviewContextV2 {
  const recentHistory = history.slice(-10);
  const filledSlots: AiInterviewContextV2["filledSlots"] = {};
  for (const turn of recentHistory) {
    filledSlots[turn.slot as InterviewSlotId] = turn.answer;
  }
  const lastTurn = recentHistory.at(-1);
  return {
    version: "2",
    interviewId: aggregate.interview.id,
    ...(lastTurn ? { currentSlot: lastTurn.slot as InterviewSlotId } : {}),
    filledSlots,
    recentTurns: recentHistory.map(({ id, question, answer }) => ({
      id,
      question,
      answer,
    })),
  };
}

function toQuestionSnapshot(question: InterviewQuestion): QuestionSnapshotV2 {
  return {
    contractVersion: 2,
    id: question.id,
    slot: question.slot,
    text: question.text,
    allowedModes: ["choice", "text"],
    defaultMode: "choice",
    contracts: {
      text: { minLength: 1, maxLength: 1_000 },
      choice: {
        selection: question.selection,
        options: structuredClone(question.options),
        ...(question.options.some(({ id }) => id === "unknown")
          ? { unknownOptionId: "unknown" }
          : {}),
      },
    },
  };
}

function toSummaryContent(summary: InterviewSummary): SummaryContentV1 {
  const section = (items: InterviewSummary["subjective"]) =>
    items.map(({ id, text, evidenceTurnIds }) => ({
      id,
      text,
      evidenceMessageIds: [...evidenceTurnIds],
    }));
  return {
    subjective: section(summary.subjective),
    objective: section(summary.objective),
    verificationNeeded: section(summary.verificationNeeded),
  };
}

type AiInterviewServiceDependencies = {
  repository: AiInterviewRepositoryPort;
  client: PublicAiClient;
  assertAiTransferConsent: () => Promise<void>;
  captureRuntimeGeneration: () => number;
  maximumFollowUps?: number;
  now?: () => Date;
  randomId?: () => string;
};

export type AiInterviewService = {
  loadOrCreate(input: { runtimeGeneration: number }): Promise<AiServiceSnapshot>;
  persistDraft(input: {
    token: AiServiceOperationToken;
    draft: CommonDraftV2;
  }): Promise<AiServiceSnapshot>;
  submitAnswer(input: {
    token: AiServiceOperationToken;
    answer: ValidatedAnswerV2;
  }): Promise<AiServiceSnapshot>;
  requestAiQuestion(input: {
    token: AiServiceOperationToken;
    history: readonly AiTurnSnapshot[];
    signal?: AbortSignal;
  }): Promise<AiServiceSnapshot>;
  requestAiSummary(input: {
    token: AiServiceOperationToken;
    history: readonly AiTurnSnapshot[];
    signal?: AbortSignal;
  }): Promise<AiServiceSnapshot>;
  acknowledgeSafety(input: {
    token: AiServiceOperationToken;
    action: SafetyStopActionV1;
  }): Promise<AiContinuationSnapshot>;
  complete(input: { token: AiServiceOperationToken }): Promise<void>;
};

export function createAiInterviewService({
  repository,
  client,
  assertAiTransferConsent,
  captureRuntimeGeneration,
  maximumFollowUps: configuredMaximumFollowUps,
  now = () => new Date(),
  randomId = () => crypto.randomUUID(),
}: AiInterviewServiceDependencies): AiInterviewService {
  const followUpLimit = maximumFollowUps(configuredMaximumFollowUps);
  let activeQuestionOperation: AiServiceOperationToken | undefined;
  let activeSummaryOperation: AiServiceOperationToken | undefined;
  let activeLoadOperation:
    | { runtimeGeneration: number; promise: Promise<AiServiceSnapshot> }
    | undefined;

  const assertRuntime = (runtimeGeneration: number): void => {
    if (captureRuntimeGeneration() !== runtimeGeneration) {
      throw new Error("stale-runtime-generation");
    }
  };

  const loadExact = async (operation: AiServiceOperationToken) => {
    assertRuntime(operation.runtimeGeneration);
    const aggregate = await repository.loadInProgress(operation.interviewId);
    if (
      !aggregate ||
      aggregate.interview.id !== operation.interviewId ||
      aggregate.interview.revision !== operation.baseRevision
    ) {
      throw new Error("stale-ai-operation");
    }
    requireAiV2Aggregate(aggregate);
    assertRuntime(operation.runtimeGeneration);
    return aggregate;
  };

  const timestamp = () => toUtcTimestamp(now().toISOString());

  const sameOperation = (
    left: AiServiceOperationToken | undefined,
    right: AiServiceOperationToken,
  ): boolean => Boolean(
    left &&
      left.sessionId === right.sessionId &&
      left.requestId === right.requestId &&
      left.interviewId === right.interviewId &&
      left.baseRevision === right.baseRevision &&
      left.runtimeGeneration === right.runtimeGeneration,
  );

  const assertExactOperation = (
    active: AiServiceOperationToken | undefined,
    operation: AiServiceOperationToken,
    aggregate: InterviewAggregateV1,
  ): void => {
    assertRuntime(operation.runtimeGeneration);
    if (
      !sameOperation(active, operation) ||
      aggregate.interview.id !== operation.interviewId ||
      aggregate.interview.revision !== operation.baseRevision
    ) {
      throw new Error("stale-ai-operation");
    }
  };

  const messagesForAnswer = (
    aggregate: InterviewAggregateV1 & {
      interview: Extract<InterviewAggregateV1["interview"], { schemaVersion: 2 }>;
      draft: Extract<NonNullable<InterviewAggregateV1["draft"]>, { schemaVersion: 2 }>;
    },
    text: string,
    createdAt: ReturnType<typeof toUtcTimestamp>,
  ): InterviewMessageInputV1[] => {
    const sequence = aggregate.messages.length;
    return [
      {
        id: `message-${randomId()}`,
        sequence,
        role: "assistant",
        kind: "question",
        text: aggregate.draft.currentQuestion.text,
        createdAt,
      },
      {
        id: `message-${randomId()}`,
        sequence: sequence + 1,
        role: "user",
        kind: "answer",
        text,
        createdAt,
      },
    ];
  };

  const fallbackQuestion = async (
    aggregate: Awaited<ReturnType<typeof loadExact>>,
    operation: AiServiceOperationToken,
    history: readonly AiTurnSnapshot[],
    signal?: AbortSignal,
  ): Promise<AiServiceSnapshot> => {
    assertExactOperation(activeQuestionOperation, operation, aggregate);
    const question = createDeterministicFallbackAiQuestion(
      history.map(({ slot }) => slot),
      aggregate.interview.questionSetSnapshot.questions.length + 1,
    );
    const input: SaveGeneratedQuestionInputV2 = {
      question,
      updatedAt: timestamp(),
    };
    const revision = revisionToken(operation);
    const saved = signal
      ? await repository.saveGeneratedQuestion(revision, input, signal)
      : await repository.saveGeneratedQuestion(revision, input);
    return deriveAiContinuation(saved, operation.runtimeGeneration, followUpLimit);
  };

  return {
    async loadOrCreate({ runtimeGeneration }) {
      if (activeLoadOperation?.runtimeGeneration === runtimeGeneration) {
        return activeLoadOperation.promise;
      }
      const promise = (async () => {
        assertRuntime(runtimeGeneration);
        await assertAiTransferConsent();
        assertRuntime(runtimeGeneration);
        const firstQuestion = createDeterministicFirstAiQuestion();
        const createdAt = timestamp();
        const commonDraft = createEmptyDraft(firstQuestion);
        const input: CreateInterviewInputV2 = {
          id: `ai-${randomId()}`,
          mode: "ai",
          createdAt,
          questionSetSnapshot: {
            contractVersion: 2,
            id: PUBLIC_AI_QUESTION_SET_ID,
            questions: [structuredClone(firstQuestion)],
          },
          draft: {
            currentQuestion: {
              id: firstQuestion.id,
              slot: firstQuestion.slot,
              text: firstQuestion.text,
              selection: "single",
              options: [],
            },
            input: {
              mode: "text",
              text: "",
              selectedOptionIds: [],
              commonDraft,
            },
            updatedAt: createdAt,
          },
        };
        const aggregate = await repository.findOrCreateAi(input);
        return deriveAiContinuation(aggregate, runtimeGeneration, followUpLimit);
      })();
      activeLoadOperation = { runtimeGeneration, promise };
      try {
        return await promise;
      } finally {
        if (activeLoadOperation?.promise === promise) {
          activeLoadOperation = undefined;
        }
      }
    },

    async persistDraft({ token: operation, draft }) {
      const aggregate = await loadExact(operation);
      const question = currentQuestion(aggregate);
      if (draft.questionId !== question.id) throw new Error("invalid-draft");
      const saved = await repository.persistDraft(revisionToken(operation), {
        commonDraft: structuredClone(draft),
        updatedAt: timestamp(),
      });
      return deriveAiContinuation(saved, operation.runtimeGeneration, followUpLimit);
    },

    async submitAnswer({ token: operation, answer }) {
      const aggregate = await loadExact(operation);
      const question = currentQuestion(aggregate);
      const validation = validateDraft(question, aggregate.draft.input.commonDraft);
      if (validation.status !== "valid" || !sameAnswer(validation.answer, answer)) {
        throw new Error("invalid-draft");
      }
      const text = answerText(question, validation.answer);
      const safety = runSafetyPreflight(text);
      const createdAt = timestamp();
      const appendedMessages = messagesForAnswer(aggregate, text, createdAt);
      if (safety.kind === "urgent") {
        const input: SaveSafetyReviewInputV1 = {
          appendedMessages: [
            ...appendedMessages,
            {
              id: `message-${randomId()}`,
              sequence: appendedMessages[1]!.sequence + 1,
              role: "system",
              kind: "safety",
              text: PUBLIC_AI_SAFETY_MESSAGE,
              createdAt,
            },
          ],
          updatedAt: createdAt,
        };
        const saved = await repository.saveSafetyReview(revisionToken(operation), input);
        return deriveAiContinuation(saved, operation.runtimeGeneration, followUpLimit);
      }
      const input: SaveProgressInputV2 = {
        appendedMessages,
        draft: draftInput(aggregate, question, createdAt),
      };
      const saved = await repository.saveProgress(revisionToken(operation), input);
      return deriveAiContinuation(saved, operation.runtimeGeneration, followUpLimit);
    },

    async requestAiQuestion({ token: operation, signal }) {
      const aggregate = await loadExact(operation);
      const continuation = deriveAiContinuation(
        aggregate,
        operation.runtimeGeneration,
        followUpLimit,
      );
      if (continuation.phase === "waiting-for-summary") return continuation;
      if (continuation.phase !== "waiting-for-question") {
        throw new Error("ai-question-not-waiting");
      }
      const durableHistory = continuation.history;
      activeQuestionOperation = structuredClone(operation);
      await assertAiTransferConsent();
      assertExactOperation(activeQuestionOperation, operation, aggregate);
      let response: AiQuestionResponseV2;
      try {
        const context = aiContext(aggregate, durableHistory);
        response = signal
          ? await client.requestQuestion(context, signal)
          : await client.requestQuestion(context);
      } catch (error) {
        if (signal?.aborted) throw error;
        assertExactOperation(activeQuestionOperation, operation, aggregate);
        return fallbackQuestion(aggregate, operation, durableHistory, signal);
      }
      if (signal?.aborted) throw new DOMException("ai-question-aborted", "AbortError");
      assertExactOperation(activeQuestionOperation, operation, aggregate);
      if (response.kind === "complete") {
        const createdAt = timestamp();
        const question = currentQuestion(aggregate);
        const revision = revisionToken(operation);
        const input: SaveProgressInputV2 = {
          draft: draftInput(aggregate, question, createdAt),
          appendedMessages: [{
            id: `message-${randomId()}`,
            sequence: aggregate.messages.length,
            role: "system",
            kind: "completion",
            text: PUBLIC_AI_COMPLETION_MARKER,
            createdAt,
          }],
        };
        const saved = signal
          ? await repository.saveProgress(revision, input, signal)
          : await repository.saveProgress(revision, input);
        return deriveAiContinuation(
          saved,
          operation.runtimeGeneration,
          followUpLimit,
        );
      }
      if (
        validateGeneratedQuestion(
          response.question,
          durableHistory.map(({ question }) => question),
          durableHistory.map(({ answer }) => answer),
        ).status === "invalid"
      ) {
        return fallbackQuestion(aggregate, operation, durableHistory, signal);
      }
      const revision = revisionToken(operation);
      const input = {
        question: toQuestionSnapshot(response.question),
        updatedAt: timestamp(),
      };
      const saved = signal
        ? await repository.saveGeneratedQuestion(revision, input, signal)
        : await repository.saveGeneratedQuestion(revision, input);
      return deriveAiContinuation(saved, operation.runtimeGeneration, followUpLimit);
    },

    async requestAiSummary({ token: operation, signal }) {
      const aggregate = await loadExact(operation);
      const continuation = deriveAiContinuation(
        aggregate,
        operation.runtimeGeneration,
        followUpLimit,
      );
      if (continuation.phase !== "waiting-for-summary") {
        throw new Error("ai-summary-not-waiting");
      }
      const history = continuation.history;
      if (history.length === 0) throw new Error("ai-summary-without-history");
      activeSummaryOperation = structuredClone(operation);
      await assertAiTransferConsent();
      assertExactOperation(activeSummaryOperation, operation, aggregate);
      let source: "ai" | "manual" = "manual";
      let content: SummaryContentV1 | undefined;
      try {
        const context = aiContext(aggregate, history);
        const response = signal
          ? await client.requestSummary(context, signal)
          : await client.requestSummary(context);
        assertExactOperation(activeSummaryOperation, operation, aggregate);
        const validation = validateSummaryEvidence(response.summary, history);
        if (!validation.usedFallback) {
          source = "ai";
          content = toSummaryContent(validation.summary);
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        assertExactOperation(activeSummaryOperation, operation, aggregate);
      }
      if (signal?.aborted) throw new DOMException("ai-summary-aborted", "AbortError");
      if (!content) content = createManualSummary(aggregate.messages);
      assertExactOperation(activeSummaryOperation, operation, aggregate);
      const createdAt = timestamp();
      const input: SaveSummaryInputV1 = {
        source,
        content,
        createdAt,
        updatedAt: createdAt,
      };
      const revision = revisionToken(operation);
      const saved = signal
        ? await repository.saveSummary(revision, input, signal)
        : await repository.saveSummary(revision, input);
      return deriveAiContinuation(saved, operation.runtimeGeneration, followUpLimit);
    },

    async acknowledgeSafety({ token: operation, action }) {
      await loadExact(operation);
      const stopped = await repository.confirmSafetyStop(revisionToken(operation), action);
      if (stopped.interview.status !== "safety-stopped" || stopped.draft) {
        throw new DatabaseCorruptionError();
      }
      return { phase: "safety-stopped", interviewId: stopped.interview.id };
    },

    async complete({ token: operation }) {
      await loadExact(operation);
      await repository.complete(revisionToken(operation));
    },
  };
}
