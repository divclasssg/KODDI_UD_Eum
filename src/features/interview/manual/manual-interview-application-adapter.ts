import type { InterviewApplicationRepositoryPort } from "../application/interview-application-service";
import {
  createEmptyDraft,
  type CommonDraftV2,
  type QuestionSnapshotV2,
  type ValidatedAnswerV2,
} from "../domain/interview-draft";
import type { SessionSnapshot } from "../domain/interview-machine";
import type { InterviewRepository } from "@/lib/db/interview-repository";
import {
  toUtcTimestamp,
  type InterviewAggregateV1,
  type RevisionToken,
  type UtcTimestamp,
} from "@/lib/db/contracts";
import { DatabaseCorruptionError } from "@/lib/db/errors";

import {
  manualStateFromAggregate,
  type ManualAnswerDraft,
  type ManualInterviewService,
  type ManualInterviewState,
} from "./manual-interview-service";
import { MANUAL_QUESTION_SET_V2 } from "./manual-question-set";

type ManualApplicationRepository = Pick<
  InterviewRepository,
  "upgradeLegacyDraft" | "persistDraft"
>;

type Dependencies = {
  legacyService: ManualInterviewService;
  repository: ManualApplicationRepository;
  now?: () => UtcTimestamp;
};

function revisionToken(
  interviewId: string,
  revision: number,
  runtimeGeneration: number,
): RevisionToken {
  return {
    interviewId,
    expectedRevision: revision,
    runtimeGeneration,
  };
}

function questionFromAggregate(
  aggregate: InterviewAggregateV1,
): QuestionSnapshotV2 {
  if (!aggregate.draft || aggregate.interview.schemaVersion !== 2) {
    throw new DatabaseCorruptionError();
  }
  const question = aggregate.interview.questionSetSnapshot.questions.find(
    ({ id }) => id === aggregate.draft?.currentQuestion.id,
  );
  if (!question) throw new DatabaseCorruptionError();
  return structuredClone(question);
}

function toSessionSnapshot(
  state: ManualInterviewState,
  runtimeGeneration: number,
): SessionSnapshot {
  const identity = {
    interviewId: state.aggregate.interview.id,
    revision: state.aggregate.interview.revision,
    runtimeGeneration,
  };
  if (state.phase === "review") {
    if (!state.aggregate.summary) throw new DatabaseCorruptionError();
    return {
      phase: "review",
      interview: identity,
      summary: {
        items: state.aggregate.summary.content.subjective.map(({ text }) => text),
      },
    };
  }
  if (
    !state.aggregate.draft ||
    state.aggregate.draft.schemaVersion !== 2
  ) {
    throw new DatabaseCorruptionError();
  }
  return {
    phase: "answering",
    interview: identity,
    question: questionFromAggregate(state.aggregate),
    draft: structuredClone(state.aggregate.draft.input.commonDraft),
  };
}

function legacyDraftToCommonDraft(
  state: ManualInterviewState,
): CommonDraftV2 {
  if (!state.aggregate.draft) throw new DatabaseCorruptionError();
  const question = MANUAL_QUESTION_SET_V2.questions.find(
    ({ id }) => id === state.aggregate.draft?.currentQuestion.id,
  );
  if (!question) throw new DatabaseCorruptionError();
  const draft = createEmptyDraft(question);
  draft.values.text.value = state.aggregate.draft.input.text;
  const selectedOptionIds = [
    ...state.aggregate.draft.input.selectedOptionIds,
  ];
  if (question.defaultMode === "chip") {
    draft.values.chip.selectedOptionIds = selectedOptionIds;
  } else {
    draft.values.choice.selectedOptionIds = selectedOptionIds;
  }
  return draft;
}

function toManualAnswer(answer: ValidatedAnswerV2): ManualAnswerDraft {
  if (answer.mode === "text") {
    return { text: answer.value, selectedOptionIds: [] };
  }
  if (answer.mode === "choice" || answer.mode === "chip") {
    return {
      text: "",
      selectedOptionIds: [...answer.value.selectedOptionIds],
    };
  }
  throw new Error("manual-measurement-question-not-configured");
}

export function createManualInterviewApplicationRepositoryPort({
  legacyService,
  repository,
  now = () => toUtcTimestamp(new Date().toISOString()),
}: Dependencies): InterviewApplicationRepositoryPort {
  let currentState: ManualInterviewState | undefined;
  let runtimeGeneration = 0;

  return {
    async loadOrCreateManual(input) {
      runtimeGeneration = input.runtimeGeneration;
      let state = await legacyService.loadOrCreate();
      if (state.aggregate.interview.schemaVersion === 1) {
        const upgraded = await repository.upgradeLegacyDraft(
          revisionToken(
            state.aggregate.interview.id,
            state.aggregate.interview.revision,
            runtimeGeneration,
          ),
          {
            questionSetSnapshot: structuredClone(MANUAL_QUESTION_SET_V2),
            commonDraft: legacyDraftToCommonDraft(state),
            updatedAt: now(),
          },
        );
        state = manualStateFromAggregate(upgraded);
      }
      currentState = state;
      return toSessionSnapshot(state, runtimeGeneration);
    },
    async persistDraft({ token, draft }) {
      const aggregate = await repository.persistDraft(
        revisionToken(token.interviewId, token.baseRevision, token.runtimeGeneration),
        { commonDraft: structuredClone(draft), updatedAt: now() },
      );
      currentState = manualStateFromAggregate(aggregate);
      return toSessionSnapshot(currentState, token.runtimeGeneration);
    },
    async submitAnswer({ token, answer }) {
      if (!currentState) throw new DatabaseCorruptionError();
      const state = await legacyService.saveAnswer(
        currentState,
        toManualAnswer(answer),
      );
      currentState = state;
      return toSessionSnapshot(state, token.runtimeGeneration);
    },
    async complete() {
      if (!currentState) throw new DatabaseCorruptionError();
      await legacyService.complete(currentState);
    },
  };
}
