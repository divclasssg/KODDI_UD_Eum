import type { InterviewRepository } from "@/lib/db/interview-repository";
import {
  toUtcTimestamp,
  type InterviewAggregateV1,
  type InterviewMessageRecordV1,
  type RevisionToken,
} from "@/lib/db/contracts";
import { DatabaseCorruptionError } from "@/lib/db/errors";
import {
  createEmptyDraft,
  type InputModeV2,
  type QuestionSnapshotV2,
} from "../domain/interview-draft";

import {
  createManualSummary,
  formatManualAnswer,
  getManualQuestion,
  getManualQuestionById,
  MANUAL_QUESTIONS_V1,
  MANUAL_QUESTION_SET_V2,
  toQuestionSnapshot,
  type ManualQuestionV1,
} from "./manual-question-set";

export type ManualAnswerDraft = {
  text: string;
  selectedOptionIds: string[];
};

export type ManualInterviewState = {
  phase: "answering" | "review";
  aggregate: InterviewAggregateV1;
  question?: ManualQuestionV1;
  answer: ManualAnswerDraft;
};

export type ManualInterviewService = {
  loadOrCreate(): Promise<ManualInterviewState>;
  saveAnswer(
    state: ManualInterviewState,
    answer: ManualAnswerDraft,
  ): Promise<ManualInterviewState>;
  complete(state: ManualInterviewState): Promise<InterviewAggregateV1>;
};

function manualQuestionFromSnapshot(
  question: QuestionSnapshotV2,
  mode: InputModeV2,
): ManualQuestionV1 {
  if (mode === "measurement") throw new DatabaseCorruptionError();
  const optionContract =
    mode === "chip" ? question.contracts.chip : question.contracts.choice;
  return {
    id: question.id,
    slot: question.slot,
    text: question.text,
    inputMode: mode === "text" ? "text" : "choice",
    selection: optionContract?.selection ?? "single",
    options: optionContract?.options.map((option) => ({ ...option })) ?? [],
  };
}

function storedQuestion(
  aggregate: InterviewAggregateV1,
  questionId: string,
): QuestionSnapshotV2 {
  if (aggregate.interview.schemaVersion !== 2) {
    throw new DatabaseCorruptionError();
  }
  const question = aggregate.interview.questionSetSnapshot.questions.find(
    ({ id }) => id === questionId,
  );
  if (!question) throw new DatabaseCorruptionError();
  return question;
}

type ManualInterviewRepository = Pick<
  InterviewRepository,
  | "create"
  | "findLatestInProgress"
  | "saveProgress"
  | "saveFinalProgress"
  | "complete"
>;

type ManualInterviewServiceDependencies = {
  repository: ManualInterviewRepository;
  captureRuntimeGeneration: () => number;
  now?: () => Date;
  randomId?: () => string;
};

export function manualStateFromAggregate(
  aggregate: InterviewAggregateV1,
): ManualInterviewState {
  if (!aggregate.draft) throw new DatabaseCorruptionError();
  if (aggregate.interview.status === "review") {
    if (!aggregate.summary) throw new DatabaseCorruptionError();
    return {
      phase: "review",
      aggregate,
      answer: { text: "", selectedOptionIds: [] },
    };
  }
  const question =
    aggregate.interview.schemaVersion === 2 &&
    aggregate.draft.schemaVersion === 2
      ? manualQuestionFromSnapshot(
          storedQuestion(aggregate, aggregate.draft.currentQuestion.id),
          aggregate.draft.input.commonDraft.activeMode,
        )
      : getManualQuestionById(aggregate.draft.currentQuestion.id);
  if (!question) throw new DatabaseCorruptionError();
  return {
    phase: "answering",
    aggregate,
    question,
    answer: {
      text: aggregate.draft.input.text,
      selectedOptionIds: [...aggregate.draft.input.selectedOptionIds],
    },
  };
}

export function createManualInterviewService({
  repository,
  captureRuntimeGeneration,
  now = () => new Date(),
  randomId = () => crypto.randomUUID(),
}: ManualInterviewServiceDependencies): ManualInterviewService {
  const runtimeGeneration = captureRuntimeGeneration();
  const token = (aggregate: InterviewAggregateV1): RevisionToken => ({
    interviewId: aggregate.interview.id,
    expectedRevision: aggregate.interview.revision,
    runtimeGeneration,
  });

  return {
    async loadOrCreate() {
      const existing = await repository.findLatestInProgress("manual");
      if (existing) return manualStateFromAggregate(existing);
      const firstQuestion = getManualQuestion(0);
      if (!firstQuestion) throw new DatabaseCorruptionError();
      const timestamp = toUtcTimestamp(now().toISOString());
      const aggregate = await repository.create({
        id: `manual-${randomId()}`,
        mode: "manual",
        createdAt: timestamp,
        questionSetSnapshot: structuredClone(MANUAL_QUESTION_SET_V2),
        draft: {
          currentQuestion: toQuestionSnapshot(firstQuestion),
          input: {
            mode: firstQuestion.inputMode,
            text: "",
            selectedOptionIds: [],
            commonDraft: createEmptyDraft(MANUAL_QUESTION_SET_V2.questions[0]),
          },
          updatedAt: timestamp,
        },
      });
      return manualStateFromAggregate(aggregate);
    },
    async saveAnswer(state, answer) {
      if (state.phase !== "answering" || !state.question) {
        throw new DatabaseCorruptionError();
      }
      const answerText = formatManualAnswer(state.question, answer);
      if (!answerText) throw new Error("답변이 필요합니다.");
      const v2QuestionSet =
        state.aggregate.interview.schemaVersion === 2
          ? state.aggregate.interview.questionSetSnapshot
          : undefined;
      const questionIndex = (
        v2QuestionSet?.questions ?? MANUAL_QUESTIONS_V1
      ).findIndex((item) => item.id === state.question?.id);
      if (questionIndex < 0) throw new DatabaseCorruptionError();
      const timestamp = toUtcTimestamp(now().toISOString());
      const sequence = state.aggregate.messages.length;
      const appendedMessages = [
        {
          id: `message-${randomId()}`,
          sequence,
          role: "assistant" as const,
          kind: "question" as const,
          text: state.question.text,
          createdAt: timestamp,
        },
        {
          id: `message-${randomId()}`,
          sequence: sequence + 1,
          role: "user" as const,
          kind: "answer" as const,
          text: answerText,
          createdAt: timestamp,
        },
      ];
      const nextQuestionV2 = v2QuestionSet?.questions[questionIndex + 1];
      const nextQuestion = nextQuestionV2
        ? manualQuestionFromSnapshot(nextQuestionV2, nextQuestionV2.defaultMode)
        : v2QuestionSet
          ? undefined
          : getManualQuestion(questionIndex + 1);
      if (nextQuestion) {
        const commonDraftQuestion =
          nextQuestionV2 ?? MANUAL_QUESTION_SET_V2.questions[questionIndex + 1];
        if (!commonDraftQuestion) throw new DatabaseCorruptionError();
        const aggregate = await repository.saveProgress(token(state.aggregate), {
          appendedMessages,
          draft: {
            currentQuestion: toQuestionSnapshot(nextQuestion),
            input: {
              mode: nextQuestion.inputMode,
              text: "",
              selectedOptionIds: [],
              ...(state.aggregate.interview.schemaVersion === 2
                ? { commonDraft: createEmptyDraft(commonDraftQuestion) }
                : {}),
            },
            updatedAt: timestamp,
          },
        });
        return manualStateFromAggregate(aggregate);
      }
      const newMessageRecords: InterviewMessageRecordV1[] = appendedMessages.map(
        (message) => ({
          interviewId: state.aggregate.interview.id,
          schemaVersion: 1,
          ...message,
        }),
      );
      const aggregate = await repository.saveFinalProgress(token(state.aggregate), {
        appendedMessages,
        draft: {
          currentQuestion: toQuestionSnapshot(state.question),
          input: {
            mode: state.question.inputMode,
            text: "",
            selectedOptionIds: [],
            ...(state.aggregate.interview.schemaVersion === 2
              ? {
                  commonDraft: createEmptyDraft(
                    storedQuestion(state.aggregate, state.question.id),
                  ),
                }
              : {}),
          },
          updatedAt: timestamp,
        },
        summary: {
          source: "manual",
          content: createManualSummary([
            ...state.aggregate.messages,
            ...newMessageRecords,
          ]),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return manualStateFromAggregate(aggregate);
    },
    complete(state) {
      if (state.phase !== "review") throw new DatabaseCorruptionError();
      return repository.complete(token(state.aggregate));
    },
  };
}
