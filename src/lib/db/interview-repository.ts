import type {
  ConsentRecordV1,
  CreateInterviewInput,
  CreateInterviewInputV2,
  InterviewAggregateV1,
  InterviewDraftRecord,
  InterviewDraftInputV1,
  InterviewDraftInputV2,
  InterviewDraftRecordV2,
  InterviewMessageRecordV1,
  InterviewRecord,
  InterviewRecordV1,
  InterviewRecordV2,
  MedicalProfileRecordV1,
  PersistDraftInputV2,
  ProfileRecordV1,
  RevisionToken,
  SaveFinalProgressInput,
  SaveGeneratedQuestionInputV2,
  SaveProgressInput,
  SaveSafetyReviewInputV1,
  SaveSummaryInputV1,
  SafetyStopActionV1,
  SummaryRecordV1,
  UpgradeLegacyDraftInputV2,
  UtcTimestamp,
} from "./contracts";
import {
  createEmptyDraft,
  type QuestionSnapshotV2,
} from "@/features/interview/domain/interview-draft";
import { requestResult, transactionComplete } from "./database";
import {
  ConsentRequiredError,
  DatabaseCorruptionError,
  ImmutableInterviewError,
  InterviewNotFoundError,
  RevisionConflictError,
} from "./errors";

export type InterviewRepository = {
  create(input: CreateInterviewInput): Promise<InterviewAggregateV1>;
  findOrCreateAi(input: CreateInterviewInputV2): Promise<InterviewAggregateV1>;
  findLatestInProgress(
    mode: "ai" | "manual",
  ): Promise<InterviewAggregateV1 | undefined>;
  loadInProgress(id: string): Promise<InterviewAggregateV1 | undefined>;
  upgradeLegacyDraft(
    token: RevisionToken,
    input: UpgradeLegacyDraftInputV2,
  ): Promise<InterviewAggregateV1>;
  persistDraft(
    token: RevisionToken,
    input: PersistDraftInputV2,
  ): Promise<InterviewAggregateV1>;
  saveGeneratedQuestion(
    token: RevisionToken,
    input: SaveGeneratedQuestionInputV2,
    signal?: AbortSignal,
  ): Promise<InterviewAggregateV1>;
  saveSafetyReview(
    token: RevisionToken,
    input: SaveSafetyReviewInputV1,
  ): Promise<InterviewAggregateV1>;
  confirmSafetyStop(
    token: RevisionToken,
    action: SafetyStopActionV1,
  ): Promise<InterviewAggregateV1>;
  saveProgress(
    token: RevisionToken,
    input: SaveProgressInput,
    signal?: AbortSignal,
  ): Promise<InterviewAggregateV1>;
  saveSummary(
    token: RevisionToken,
    input: SaveSummaryInputV1,
    signal?: AbortSignal,
  ): Promise<InterviewAggregateV1>;
  saveFinalProgress(
    token: RevisionToken,
    input: SaveFinalProgressInput,
  ): Promise<InterviewAggregateV1>;
  complete(token: RevisionToken): Promise<InterviewAggregateV1>;
  listCompleted(): Promise<InterviewRecord[]>;
};

type InterviewRepositoryOptions = {
  now?: () => UtcTimestamp;
  assertRuntimeGeneration?: (generation: number) => void;
  beforeFinalPut?: (
    storeName: "interviews" | "interviewDrafts" | "messages" | "summaries",
  ) => void;
};

async function requireConsent(transaction: IDBTransaction): Promise<void> {
  const consent = await requestResult<ConsentRecordV1 | undefined>(
    transaction.objectStore("consents").get("current"),
  );
  if (!consent) {
    transaction.abort();
    throw new ConsentRequiredError();
  }
}

function assertMutableInterview(
  interview: InterviewRecord | undefined,
  token: RevisionToken,
): asserts interview is InterviewRecord {
  if (!interview || interview.id !== token.interviewId) {
    throw new InterviewNotFoundError();
  }
  if (interview.revision !== token.expectedRevision) {
    throw new RevisionConflictError();
  }
  if (
    interview.status === "completed" ||
    interview.status === "safety-stopped"
  ) {
    throw new ImmutableInterviewError();
  }
}

function validateAggregate(aggregate: InterviewAggregateV1): void {
  if (
    aggregate.draft &&
    aggregate.draft.revision !== aggregate.interview.revision
  ) {
    throw new DatabaseCorruptionError();
  }
  if (
    aggregate.summary &&
    aggregate.summary.revision !== aggregate.interview.revision
  ) {
    throw new DatabaseCorruptionError();
  }
  if (
    aggregate.messages.some(
      (message, index) => message.sequence !== index,
    )
  ) {
    throw new DatabaseCorruptionError();
  }
}

const SAFETY_STOP_ACTIONS = new Set<SafetyStopActionV1>([
  "call-119",
  "show-to-bystander",
  "view-summary",
]);

function abortTransaction(transaction: IDBTransaction): void {
  try {
    transaction.abort();
  } catch {
    return;
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("interview-operation-aborted", "AbortError");
  }
}

function registerTransactionAbort(
  transaction: IDBTransaction,
  signal?: AbortSignal,
): () => void {
  if (!signal) return () => undefined;
  const abort = () => abortTransaction(transaction);
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

function assertExactSafetyMessages(
  messages: InterviewMessageRecordV1[] | SaveSafetyReviewInputV1["appendedMessages"],
  firstSequence: number,
  questionText: string,
): void {
  const [question, answer, safety] = messages;
  if (
    messages.length !== 3 ||
    question.sequence !== firstSequence ||
    question.role !== "assistant" ||
    question.kind !== "question" ||
    question.text !== questionText ||
    answer.sequence !== firstSequence + 1 ||
    answer.role !== "user" ||
    answer.kind !== "answer" ||
    safety.sequence !== firstSequence + 2 ||
    safety.role !== "system" ||
    safety.kind !== "safety"
  ) {
    throw new DatabaseCorruptionError();
  }
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sameOptions(
  left: { id: string; label: string }[],
  right: { id: string; label: string }[],
): boolean {
  return left.length === right.length && left.every((option, index) =>
    option.id === right[index]?.id && option.label === right[index]?.label
  );
}

function hasValidQuestionContract(question: QuestionSnapshotV2): boolean {
  return question.contractVersion === 2 &&
    question.allowedModes.includes(question.defaultMode) &&
    question.allowedModes.every((mode) => question.contracts[mode] !== undefined);
}

function currentQuestionMatchesSnapshot(
  draft: InterviewDraftRecordV2,
  question: QuestionSnapshotV2,
): boolean {
  const commonDraft = draft.input.commonDraft;
  const normalizedMode = commonDraft.activeMode === "chip"
    ? "choice"
    : commonDraft.activeMode;
  const selectedOptionIds = commonDraft.activeMode === "chip"
    ? commonDraft.values.chip.selectedOptionIds
    : commonDraft.values.choice.selectedOptionIds;
  const defaultOptionContract = question.defaultMode === "chip"
    ? question.contracts.chip
    : question.defaultMode === "choice"
      ? question.contracts.choice
      : undefined;
  const matchesOptionContract = (contract: NonNullable<
    typeof question.contracts.choice
  >) => draft.currentQuestion.selection === contract.selection &&
    sameOptions(draft.currentQuestion.options, contract.options);
  const currentOptionsMatch = defaultOptionContract
    ? matchesOptionContract(defaultOptionContract)
    : (
      draft.currentQuestion.options.length === 0 &&
      draft.currentQuestion.selection === "single"
    );
  return draft.currentQuestion.id === question.id &&
    draft.currentQuestion.slot === question.slot &&
    draft.currentQuestion.text === question.text &&
    commonDraft.contractVersion === 2 &&
    commonDraft.questionId === question.id &&
    sameStringArray(commonDraft.allowedModes, question.allowedModes) &&
    commonDraft.allowedModes.includes(commonDraft.activeMode) &&
    draft.input.mode === normalizedMode &&
    draft.input.text === commonDraft.values.text.value &&
    sameStringArray(draft.input.selectedOptionIds, selectedOptionIds) &&
    currentOptionsMatch;
}

function assertAiV2AggregateIntegrity(
  aggregate: InterviewAggregateV1,
): asserts aggregate is InterviewAggregateV1 & {
  interview: InterviewRecordV2;
  draft: InterviewDraftRecordV2;
} {
  validateAggregate(aggregate);
  const { interview, draft, messages, summary } = aggregate;
  if (
    interview.schemaVersion !== 2 ||
    interview.mode !== "ai" ||
    interview.questionSetSnapshot.contractVersion !== 2 ||
    !draft ||
    draft.schemaVersion !== 2 ||
    draft.interviewId !== interview.id ||
    draft.revision !== interview.revision ||
    messages.some((message) =>
      message.schemaVersion !== 1 || message.interviewId !== interview.id
    ) ||
    (summary !== undefined && (
      summary.schemaVersion !== 1 ||
      summary.interviewId !== interview.id ||
      summary.revision !== interview.revision
    ))
  ) {
    throw new DatabaseCorruptionError();
  }
  const questionIds = new Set<string>();
  if (interview.questionSetSnapshot.questions.some((question) => {
    if (!hasValidQuestionContract(question) || questionIds.has(question.id)) {
      return true;
    }
    questionIds.add(question.id);
    return false;
  })) {
    throw new DatabaseCorruptionError();
  }
  const currentQuestion = interview.questionSetSnapshot.questions.find(
    ({ id }) => id === draft.currentQuestion.id,
  );
  if (!currentQuestion || !currentQuestionMatchesSnapshot(draft, currentQuestion)) {
    throw new DatabaseCorruptionError();
  }
}

async function readAggregate(
  transaction: IDBTransaction,
  interviewId: string,
): Promise<InterviewAggregateV1 | undefined> {
  const interview = await requestResult<InterviewRecord | undefined>(
    transaction.objectStore("interviews").get(interviewId),
  );
  if (!interview) return undefined;
  const draft = await requestResult<InterviewDraftRecord | undefined>(
    transaction.objectStore("interviewDrafts").get(interviewId),
  );
  const messages = await requestResult<InterviewMessageRecordV1[]>(
    transaction
      .objectStore("messages")
      .index("byInterviewId")
      .getAll(interviewId),
  );
  const summary = await requestResult<SummaryRecordV1 | undefined>(
    transaction.objectStore("summaries").get(interviewId),
  );
  const aggregate = {
    interview,
    draft,
    messages: messages.sort((left, right) => left.sequence - right.sequence),
    summary,
  };
  validateAggregate(aggregate);
  return aggregate;
}

export function createInterviewRepository(
  database: IDBDatabase,
  options: InterviewRepositoryOptions = {},
): InterviewRepository {
  const now = options.now ?? (() => new Date().toISOString() as UtcTimestamp);
  const assertRuntimeGeneration = options.assertRuntimeGeneration ?? (() => {});
  const loadInProgress = async (id: string) => {
    const transaction = database.transaction(
      ["consents", "interviews", "interviewDrafts", "messages", "summaries"],
      "readonly",
    );
    await requireConsent(transaction);
    const aggregate = await readAggregate(transaction, id);
    if (
      aggregate?.interview.status === "completed" ||
      aggregate?.interview.status === "safety-stopped"
    ) {
      return undefined;
    }
    return aggregate;
  };

  return {
    async create(input) {
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts"],
        "readwrite",
      );
      await requireConsent(transaction);
      let interview: InterviewRecord;
      let draft: InterviewDraftRecord;
      if ("questionSetSnapshot" in input) {
        interview = {
          id: input.id,
          schemaVersion: 2,
          revision: 1,
          status: "draft",
          mode: input.mode,
          createdAt: input.createdAt,
          updatedAt: input.draft.updatedAt,
          questionSetSnapshot: structuredClone(input.questionSetSnapshot),
        };
        draft = {
          interviewId: input.id,
          schemaVersion: 2,
          revision: 1,
          ...input.draft,
        };
      } else {
        interview = {
          id: input.id,
          schemaVersion: 1,
          revision: 1,
          status: "draft",
          mode: input.mode,
          createdAt: input.createdAt,
          updatedAt: input.draft.updatedAt,
        };
        draft = {
          interviewId: input.id,
          schemaVersion: 1,
          revision: 1,
          ...input.draft,
        };
      }
      transaction.objectStore("interviews").add(interview);
      transaction.objectStore("interviewDrafts").add(draft);
      await transactionComplete(transaction);
      return { interview, draft, messages: [] };
    },
    async findOrCreateAi(input) {
      if (input.mode !== "ai") throw new DatabaseCorruptionError();
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts", "messages", "summaries"],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      await requireConsent(transaction);
      const index = transaction.objectStore("interviews").index("byStatusUpdatedAt");
      const [drafts, reviews] = await Promise.all([
        requestResult<InterviewRecord[]>(
          index.getAll(IDBKeyRange.bound(["draft", ""], ["draft", "\uffff"])),
        ),
        requestResult<InterviewRecord[]>(
          index.getAll(IDBKeyRange.bound(["review", ""], ["review", "\uffff"])),
        ),
      ]);
      const latest = [...drafts, ...reviews]
        .filter((interview) => interview.mode === "ai")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
      if (latest) {
        const aggregate = await readAggregate(transaction, latest.id);
        await completion;
        if (!aggregate) throw new InterviewNotFoundError();
        return aggregate;
      }

      const interview: InterviewRecordV2 = {
        id: input.id,
        schemaVersion: 2,
        revision: 1,
        status: "draft",
        mode: "ai",
        createdAt: input.createdAt,
        updatedAt: input.draft.updatedAt,
        questionSetSnapshot: structuredClone(input.questionSetSnapshot),
      };
      const draft: InterviewDraftRecordV2 = {
        interviewId: input.id,
        schemaVersion: 2,
        revision: 1,
        ...structuredClone(input.draft),
      };
      transaction.objectStore("interviews").add(interview);
      transaction.objectStore("interviewDrafts").add(draft);
      await completion;
      return { interview, draft, messages: [] };
    },
    async findLatestInProgress(mode) {
      const transaction = database.transaction(
        ["consents", "interviews"],
        "readonly",
      );
      const completion = transactionComplete(transaction);
      await requireConsent(transaction);
      const index = transaction.objectStore("interviews").index("byStatusUpdatedAt");
      const [drafts, reviews] = await Promise.all([
        requestResult<InterviewRecordV1[]>(
          index.getAll(IDBKeyRange.bound(["draft", ""], ["draft", "\uffff"])),
        ),
        requestResult<InterviewRecordV1[]>(
          index.getAll(IDBKeyRange.bound(["review", ""], ["review", "\uffff"])),
        ),
      ]);
      await completion;
      const latest = [...drafts, ...reviews]
        .filter((interview) => interview.mode === mode)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
      return latest ? loadInProgress(latest.id) : undefined;
    },
    loadInProgress,
    async upgradeLegacyDraft(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts"],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(token.interviewId),
      );
      if (
        interview.schemaVersion !== 1 ||
        draft?.schemaVersion !== 1 ||
        draft.revision !== interview.revision ||
        input.commonDraft.questionId !== draft.currentQuestion.id ||
        !input.questionSetSnapshot.questions.some(
          ({ id }) => id === input.commonDraft.questionId,
        )
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const nextRevision = interview.revision + 1;
      const nextInterview: InterviewRecordV2 = {
        ...interview,
        schemaVersion: 2,
        revision: nextRevision,
        updatedAt: input.updatedAt,
        questionSetSnapshot: structuredClone(input.questionSetSnapshot),
      };
      const commonDraft = structuredClone(input.commonDraft);
      const selectedOptionIds =
        commonDraft.activeMode === "chip"
          ? commonDraft.values.chip.selectedOptionIds
          : commonDraft.values.choice.selectedOptionIds;
      const nextDraft: InterviewDraftRecordV2 = {
        ...draft,
        schemaVersion: 2,
        revision: nextRevision,
        updatedAt: input.updatedAt,
        input: {
          mode:
            commonDraft.activeMode === "chip"
              ? "choice"
              : commonDraft.activeMode,
          text: commonDraft.values.text.value,
          selectedOptionIds: [...selectedOptionIds],
          commonDraft,
        },
      };
      transaction.objectStore("interviews").put(nextInterview);
      transaction.objectStore("interviewDrafts").put(nextDraft);
      await transactionComplete(transaction);
      const aggregate = await loadInProgress(interview.id);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async persistDraft(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts"],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(token.interviewId),
      );
      if (
        interview.schemaVersion !== 2 ||
        draft?.schemaVersion !== 2 ||
        draft.revision !== interview.revision ||
        input.commonDraft.questionId !== draft.currentQuestion.id ||
        !interview.questionSetSnapshot.questions.some(
          ({ id }) => id === input.commonDraft.questionId,
        )
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const nextRevision = interview.revision + 1;
      const nextInterview: InterviewRecordV2 = {
        ...interview,
        revision: nextRevision,
        updatedAt: input.updatedAt,
      };
      const commonDraft = structuredClone(input.commonDraft);
      const selectedOptionIds =
        commonDraft.activeMode === "chip"
          ? commonDraft.values.chip.selectedOptionIds
          : commonDraft.values.choice.selectedOptionIds;
      const nextDraft: InterviewDraftRecordV2 = {
        ...draft,
        revision: nextRevision,
        updatedAt: input.updatedAt,
        input: {
          mode:
            commonDraft.activeMode === "chip"
              ? "choice"
              : commonDraft.activeMode,
          text: commonDraft.values.text.value,
          selectedOptionIds: [...selectedOptionIds],
          ...(commonDraft.values.measurement.state === "known"
            ? {
                measurement: {
                  value: Number(commonDraft.values.measurement.rawValue),
                  unit: commonDraft.values.measurement.unitId,
                },
              }
            : {}),
          commonDraft,
        },
      };
      transaction.objectStore("interviews").put(nextInterview);
      transaction.objectStore("interviewDrafts").put(nextDraft);
      await transactionComplete(transaction);
      const aggregate = await loadInProgress(interview.id);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async saveGeneratedQuestion(token, input, signal) {
      const inputSnapshot = structuredClone(input);
      assertNotAborted(signal);
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts", "messages", "summaries"],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      const unregisterAbort = registerTransactionAbort(transaction, signal);
      let prospectiveAggregate: InterviewAggregateV1 | undefined;
      try {
        await requireConsent(transaction);
        const aggregate = await readAggregate(transaction, token.interviewId);
        assertMutableInterview(aggregate?.interview, token);
        if (!aggregate) throw new InterviewNotFoundError();
        assertAiV2AggregateIntegrity(aggregate);
        const { interview } = aggregate;
        if (
          interview.status !== "draft" ||
          aggregate.summary !== undefined ||
          inputSnapshot.question.contractVersion !== 2 ||
          interview.questionSetSnapshot.questions.some(
            ({ id }) => id === inputSnapshot.question.id,
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        let commonDraft;
        try {
          commonDraft = createEmptyDraft(inputSnapshot.question);
        } catch {
          throw new DatabaseCorruptionError();
        }
        if (!hasValidQuestionContract(inputSnapshot.question)) {
          throw new DatabaseCorruptionError();
        }
        const optionContract = inputSnapshot.question.defaultMode === "chip"
          ? inputSnapshot.question.contracts.chip
          : inputSnapshot.question.defaultMode === "choice"
            ? inputSnapshot.question.contracts.choice
            : undefined;
        const nextRevision = interview.revision + 1;
        const nextInterview: InterviewRecordV2 = {
          ...interview,
          revision: nextRevision,
          status: "draft",
          updatedAt: inputSnapshot.updatedAt,
          questionSetSnapshot: {
            ...structuredClone(interview.questionSetSnapshot),
            questions: [
              ...structuredClone(interview.questionSetSnapshot.questions),
              structuredClone(inputSnapshot.question),
            ],
          },
        };
        const nextDraft: InterviewDraftRecordV2 = {
          interviewId: interview.id,
          schemaVersion: 2,
          revision: nextRevision,
          currentQuestion: {
            id: inputSnapshot.question.id,
            slot: inputSnapshot.question.slot,
            text: inputSnapshot.question.text,
            selection: optionContract?.selection ?? "single",
            options: structuredClone(optionContract?.options ?? []),
          },
          input: {
            mode: inputSnapshot.question.defaultMode === "chip"
              ? "choice"
              : inputSnapshot.question.defaultMode,
            text: "",
            selectedOptionIds: [],
            commonDraft,
          },
          updatedAt: inputSnapshot.updatedAt,
        };
        prospectiveAggregate = {
          interview: nextInterview,
          draft: nextDraft,
          messages: aggregate.messages,
          summary: aggregate.summary,
        };
        assertAiV2AggregateIntegrity(prospectiveAggregate);
        options.beforeFinalPut?.("interviews");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviews").put(nextInterview);
        options.beforeFinalPut?.("interviewDrafts");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviewDrafts").put(nextDraft);
      } catch (error) {
        abortTransaction(transaction);
        await completion.catch(() => undefined);
        unregisterAbort();
        throw error;
      }
      try {
        await completion;
        if (!prospectiveAggregate) throw new InterviewNotFoundError();
        return prospectiveAggregate;
      } finally {
        unregisterAbort();
      }
    },
    async saveSafetyReview(token, input) {
      const inputSnapshot = structuredClone(input);
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts", "messages", "summaries"],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      let prospectiveAggregate: InterviewAggregateV1 | undefined;
      try {
        await requireConsent(transaction);
        const aggregate = await readAggregate(transaction, token.interviewId);
        assertMutableInterview(aggregate?.interview, token);
        if (!aggregate) throw new InterviewNotFoundError();
        assertAiV2AggregateIntegrity(aggregate);
        const { interview, draft } = aggregate;
        if (
          interview.status !== "draft" ||
          aggregate.summary !== undefined
        ) {
          throw new DatabaseCorruptionError();
        }
        assertExactSafetyMessages(
          inputSnapshot.appendedMessages,
          aggregate.messages.length,
          draft.currentQuestion.text,
        );
        const nextRevision = interview.revision + 1;
        const nextInterview: InterviewRecordV2 = {
          ...interview,
          revision: nextRevision,
          status: "draft",
          updatedAt: inputSnapshot.updatedAt,
        };
        const nextDraft: InterviewDraftRecordV2 = {
          ...draft,
          revision: nextRevision,
          updatedAt: inputSnapshot.updatedAt,
        };
        const appendedRecords = inputSnapshot.appendedMessages.map((message) => ({
          interviewId: interview.id,
          schemaVersion: 1 as const,
          ...message,
        }));
        prospectiveAggregate = {
          interview: nextInterview,
          draft: nextDraft,
          messages: [...aggregate.messages, ...appendedRecords],
          summary: aggregate.summary,
        };
        assertAiV2AggregateIntegrity(prospectiveAggregate);
        options.beforeFinalPut?.("interviews");
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviews").put(nextInterview);
        options.beforeFinalPut?.("interviewDrafts");
        transaction.objectStore("interviewDrafts").put(nextDraft);
        for (const record of appendedRecords) {
          options.beforeFinalPut?.("messages");
          transaction.objectStore("messages").add(record);
        }
      } catch (error) {
        abortTransaction(transaction);
        await completion.catch(() => undefined);
        throw error;
      }
      await completion;
      if (!prospectiveAggregate) throw new InterviewNotFoundError();
      return prospectiveAggregate;
    },
    async confirmSafetyStop(token, action) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        ["consents", "interviews", "interviewDrafts", "messages", "summaries"],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      let prospectiveAggregate: InterviewAggregateV1 | undefined;
      try {
        await requireConsent(transaction);
        const aggregate = await readAggregate(transaction, token.interviewId);
        assertMutableInterview(aggregate?.interview, token);
        if (!aggregate) throw new InterviewNotFoundError();
        assertAiV2AggregateIntegrity(aggregate);
        const { interview, draft, messages } = aggregate;
        if (
          interview.status !== "draft" ||
          aggregate.summary !== undefined ||
          !SAFETY_STOP_ACTIONS.has(action) ||
          messages.length < 3
        ) {
          throw new DatabaseCorruptionError();
        }
        assertExactSafetyMessages(
          messages.slice(-3),
          messages.length - 3,
          draft.currentQuestion.text,
        );
        const stoppedInterview: InterviewRecordV2 = {
          ...interview,
          revision: interview.revision + 1,
          status: "safety-stopped",
          updatedAt: now(),
          safetyStopAction: action,
        };
        prospectiveAggregate = {
          interview: stoppedInterview,
          draft: undefined,
          messages,
          summary: undefined,
        };
        validateAggregate(prospectiveAggregate);
        options.beforeFinalPut?.("interviews");
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviews").put(stoppedInterview);
        options.beforeFinalPut?.("interviewDrafts");
        transaction.objectStore("interviewDrafts").delete(interview.id);
      } catch (error) {
        abortTransaction(transaction);
        await completion.catch(() => undefined);
        throw error;
      }
      await completion;
      if (!prospectiveAggregate) throw new InterviewNotFoundError();
      return prospectiveAggregate;
    },
    async saveProgress(token, input, signal) {
      assertNotAborted(signal);
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      const unregisterAbort = registerTransactionAbort(transaction, signal);
      try {
        await requireConsent(transaction);
        const interview = await requestResult<InterviewRecord | undefined>(
          transaction.objectStore("interviews").get(token.interviewId),
        );
        assertMutableInterview(interview, token);
        const existingMessages = await requestResult<InterviewMessageRecordV1[]>(
          transaction
            .objectStore("messages")
            .index("byInterviewId")
            .getAll(token.interviewId),
        );
        if (
          input.appendedMessages.some(
            (message, index) =>
              message.sequence !== existingMessages.length + index,
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        const nextRevision = interview.revision + 1;
        const nextInterview: InterviewRecord = {
          ...interview,
          revision: nextRevision,
          status: "draft",
          updatedAt: input.draft.updatedAt,
        };
        let nextDraft: InterviewDraftRecord;
        if (interview.schemaVersion === 2) {
          if (!("commonDraft" in input.draft.input)) {
            throw new DatabaseCorruptionError();
          }
          const draftInput = input.draft as InterviewDraftInputV2;
          nextDraft = {
            interviewId: interview.id,
            schemaVersion: 2,
            revision: nextRevision,
            ...draftInput,
          };
        } else {
          if ("commonDraft" in input.draft.input) {
            throw new DatabaseCorruptionError();
          }
          const draftInput = input.draft as InterviewDraftInputV1;
          nextDraft = {
            interviewId: interview.id,
            schemaVersion: 1,
            revision: nextRevision,
            ...draftInput,
          };
        }
        options.beforeFinalPut?.("interviews");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviews").put(nextInterview);
        options.beforeFinalPut?.("interviewDrafts");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviewDrafts").put(nextDraft);
        options.beforeFinalPut?.("summaries");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("summaries").delete(interview.id);
        for (const message of input.appendedMessages) {
          options.beforeFinalPut?.("messages");
          assertNotAborted(signal);
          assertRuntimeGeneration(token.runtimeGeneration);
          const record: InterviewMessageRecordV1 = {
            interviewId: interview.id,
            schemaVersion: 1,
            ...message,
          };
          transaction.objectStore("messages").add(record);
        }
        await completion;
      } catch (error) {
        abortTransaction(transaction);
        await completion.catch(() => undefined);
        throw error;
      } finally {
        unregisterAbort();
      }
      const aggregate = await loadInProgress(token.interviewId);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async saveSummary(token, input, signal) {
      assertNotAborted(signal);
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      const unregisterAbort = registerTransactionAbort(transaction, signal);
      try {
        await requireConsent(transaction);
        const interview = await requestResult<InterviewRecord | undefined>(
          transaction.objectStore("interviews").get(token.interviewId),
        );
        assertMutableInterview(interview, token);
        const draft = await requestResult<InterviewDraftRecord | undefined>(
          transaction.objectStore("interviewDrafts").get(interview.id),
        );
        if (!draft || draft.revision !== interview.revision) {
          throw new DatabaseCorruptionError();
        }
        const messages = await requestResult<InterviewMessageRecordV1[]>(
          transaction
            .objectStore("messages")
            .index("byInterviewId")
            .getAll(interview.id),
        );
        const messageIds = new Set(messages.map(({ id }) => id));
        const summaryItems = [
          ...input.content.subjective,
          ...input.content.objective,
          ...input.content.verificationNeeded,
        ];
        if (
          summaryItems.some(({ evidenceMessageIds }) =>
            evidenceMessageIds.some((id) => !messageIds.has(id)),
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        const nextRevision = interview.revision + 1;
        const nextInterview: InterviewRecord = {
          ...interview,
          revision: nextRevision,
          status: "review",
          updatedAt: input.updatedAt,
        };
        const nextDraft = { ...draft, revision: nextRevision };
        const summary: SummaryRecordV1 = {
          interviewId: interview.id,
          schemaVersion: 1,
          revision: nextRevision,
          status: "review",
          ...input,
        };
        options.beforeFinalPut?.("interviews");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviews").put(nextInterview);
        options.beforeFinalPut?.("interviewDrafts");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("interviewDrafts").put(nextDraft);
        options.beforeFinalPut?.("summaries");
        assertNotAborted(signal);
        assertRuntimeGeneration(token.runtimeGeneration);
        transaction.objectStore("summaries").put(summary);
        await completion;
      } catch (error) {
        abortTransaction(transaction);
        await completion.catch(() => undefined);
        throw error;
      } finally {
        unregisterAbort();
      }
      const aggregate = await loadInProgress(token.interviewId);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async saveFinalProgress(token, input) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      const completion = transactionComplete(transaction);
      try {
        await requireConsent(transaction);
        const interview = await requestResult<InterviewRecord | undefined>(
          transaction.objectStore("interviews").get(token.interviewId),
        );
        assertMutableInterview(interview, token);
        const existingMessages = await requestResult<InterviewMessageRecordV1[]>(
          transaction
            .objectStore("messages")
            .index("byInterviewId")
            .getAll(interview.id),
        );
        if (
          input.appendedMessages.some(
            (message, index) =>
              message.sequence !== existingMessages.length + index,
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        const evidenceIds = new Set([
          ...existingMessages.map(({ id }) => id),
          ...input.appendedMessages.map(({ id }) => id),
        ]);
        const summaryItems = [
          ...input.summary.content.subjective,
          ...input.summary.content.objective,
          ...input.summary.content.verificationNeeded,
        ];
        if (
          summaryItems.some(({ evidenceMessageIds }) =>
            evidenceMessageIds.some((id) => !evidenceIds.has(id)),
          )
        ) {
          throw new DatabaseCorruptionError();
        }
        const nextRevision = interview.revision + 1;
        const nextInterview: InterviewRecord = {
          ...interview,
          revision: nextRevision,
          status: "review",
          updatedAt: input.summary.updatedAt,
        };
        let nextDraft: InterviewDraftRecord;
        if (interview.schemaVersion === 2) {
          if (!("commonDraft" in input.draft.input)) {
            throw new DatabaseCorruptionError();
          }
          const draftInput = input.draft as InterviewDraftInputV2;
          nextDraft = {
            interviewId: interview.id,
            schemaVersion: 2,
            revision: nextRevision,
            ...draftInput,
          };
        } else {
          if ("commonDraft" in input.draft.input) {
            throw new DatabaseCorruptionError();
          }
          const draftInput = input.draft as InterviewDraftInputV1;
          nextDraft = {
            interviewId: interview.id,
            schemaVersion: 1,
            revision: nextRevision,
            ...draftInput,
          };
        }
        const summary: SummaryRecordV1 = {
          interviewId: interview.id,
          schemaVersion: 1,
          revision: nextRevision,
          status: "review",
          ...input.summary,
        };
        options.beforeFinalPut?.("interviews");
        transaction.objectStore("interviews").put(nextInterview);
        options.beforeFinalPut?.("interviewDrafts");
        transaction.objectStore("interviewDrafts").put(nextDraft);
        for (const message of input.appendedMessages) {
          options.beforeFinalPut?.("messages");
          const record: InterviewMessageRecordV1 = {
            interviewId: interview.id,
            schemaVersion: 1,
            ...message,
          };
          transaction.objectStore("messages").add(record);
        }
        options.beforeFinalPut?.("summaries");
        transaction.objectStore("summaries").put(summary);
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          await completion.catch(() => undefined);
          throw error;
        }
        await completion.catch(() => undefined);
        throw error;
      }
      await completion;
      const aggregate = await loadInProgress(token.interviewId);
      if (!aggregate) throw new InterviewNotFoundError();
      return aggregate;
    },
    async complete(token) {
      assertRuntimeGeneration(token.runtimeGeneration);
      const transaction = database.transaction(
        [
          "consents",
          "profiles",
          "medicalProfiles",
          "interviews",
          "interviewDrafts",
          "messages",
          "summaries",
        ],
        "readwrite",
      );
      await requireConsent(transaction);
      const interview = await requestResult<InterviewRecord | undefined>(
        transaction.objectStore("interviews").get(token.interviewId),
      );
      assertMutableInterview(interview, token);
      const profile = await requestResult<ProfileRecordV1 | undefined>(
        transaction.objectStore("profiles").get("default"),
      );
      const medicalProfile = await requestResult<
        MedicalProfileRecordV1 | undefined
      >(transaction.objectStore("medicalProfiles").get("default"));
      const draft = await requestResult<InterviewDraftRecord | undefined>(
        transaction.objectStore("interviewDrafts").get(interview.id),
      );
      const summary = await requestResult<SummaryRecordV1 | undefined>(
        transaction.objectStore("summaries").get(interview.id),
      );
      if (
        interview.status !== "review" ||
        !profile ||
        !medicalProfile ||
        !draft ||
        draft.revision !== interview.revision ||
        !summary ||
        summary.revision !== interview.revision
      ) {
        transaction.abort();
        throw new DatabaseCorruptionError();
      }
      const completedAt = now();
      const nextRevision = interview.revision + 1;
      const completedInterview: InterviewRecord = {
        ...interview,
        revision: nextRevision,
        status: "completed",
        updatedAt: completedAt,
        completedAt,
        profileSnapshot: {
          schemaVersion: 1,
          capturedAt: completedAt,
          profile: {
            schemaVersion: profile.schemaVersion,
            displayName: profile.displayName,
            birthDate: profile.birthDate,
            sex: profile.sex,
          },
          medicalProfile: {
            schemaVersion: medicalProfile.schemaVersion,
            conditions: structuredClone(medicalProfile.conditions),
            medications: structuredClone(medicalProfile.medications),
            allergies: structuredClone(medicalProfile.allergies),
            familyHistory: structuredClone(medicalProfile.familyHistory),
            medicalHistory: structuredClone(medicalProfile.medicalHistory),
            surgicalHistory: structuredClone(medicalProfile.surgicalHistory),
            smoking: structuredClone(medicalProfile.smoking),
            alcohol: structuredClone(medicalProfile.alcohol),
            ...(medicalProfile.heightCm === undefined
              ? {}
              : { heightCm: medicalProfile.heightCm }),
            ...(medicalProfile.weightKg === undefined
              ? {}
              : { weightKg: medicalProfile.weightKg }),
          },
        },
      };
      const confirmedSummary: SummaryRecordV1 = {
        ...summary,
        revision: nextRevision,
        status: "confirmed",
        updatedAt: completedAt,
        confirmedAt: completedAt,
      };
      const messages = await requestResult<InterviewMessageRecordV1[]>(
        transaction
          .objectStore("messages")
          .index("byInterviewId")
          .getAll(interview.id),
      );
      transaction.objectStore("interviews").put(completedInterview);
      transaction.objectStore("summaries").put(confirmedSummary);
      transaction.objectStore("interviewDrafts").delete(interview.id);
      await transactionComplete(transaction);
      return {
        interview: completedInterview,
        messages: messages.sort((left, right) => left.sequence - right.sequence),
        summary: confirmedSummary,
      };
    },
    async listCompleted() {
      const transaction = database.transaction(
        ["consents", "interviews"],
        "readonly",
      );
      await requireConsent(transaction);
      const completed = await requestResult<InterviewRecord[]>(
        transaction.objectStore("interviews").index("byStatus").getAll("completed"),
      );
      return completed.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    },
  };
}
