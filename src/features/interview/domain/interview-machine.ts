import {
  validateDraft,
  type CommonDraftV2,
  type QuestionSnapshotV2,
  type ValidatedAnswerV2,
} from "./interview-draft";

export type InterviewIdentity = {
  interviewId: string;
  revision: number;
  runtimeGeneration: number;
};

export type OperationToken = {
  sessionId: string;
  requestId: string;
  interviewId: string;
  baseRevision: number;
  runtimeGeneration: number;
};

export type AnsweringState = {
  phase: "answering";
  sessionId: string;
  interview: InterviewIdentity;
  question: QuestionSnapshotV2;
  draft: CommonDraftV2;
  draftSync: "clean" | "dirty" | "saving" | "error";
  dirtySincePersist: boolean;
  operation?: OperationToken;
  submitQueued: boolean;
  queuedSubmitToken?: OperationToken;
  errorCode?: string;
};

export type SubmittingState = {
  phase: "submitting";
  sessionId: string;
  interview: InterviewIdentity;
  question: QuestionSnapshotV2;
  draft: CommonDraftV2;
  answer: ValidatedAnswerV2;
  operation: OperationToken;
};

export type ReviewState = {
  phase: "review";
  sessionId: string;
  interview: InterviewIdentity;
  summary: { items: string[] };
  errorCode?: string;
};

export type CompletingState = Omit<ReviewState, "phase"> & {
  phase: "completing";
  operation: OperationToken;
};

export type InterviewDomainState =
  | { phase: "loading"; sessionId: string; operation: OperationToken }
  | AnsweringState
  | SubmittingState
  | ReviewState
  | CompletingState
  | { phase: "completed"; sessionId: string; interviewId: string }
  | { phase: "load-error"; sessionId: string; errorCode: string }
  | { phase: "disposed"; sessionId: string };

export type SessionSnapshot =
  | {
      phase: "answering";
      interview: InterviewIdentity;
      question: QuestionSnapshotV2;
      draft: CommonDraftV2;
    }
  | {
      phase: "review";
      interview: InterviewIdentity;
      summary: { items: string[] };
    };

export type InterviewEvent =
  | { type: "LOAD_SUCCEEDED"; token: OperationToken; snapshot: SessionSnapshot }
  | { type: "LOAD_FAILED"; token: OperationToken; errorCode: string }
  | { type: "DRAFT_EDITED"; draft: CommonDraftV2 }
  | { type: "DRAFT_PERSIST_REQUESTED"; token: OperationToken }
  | {
      type: "DRAFT_PERSIST_SUCCEEDED";
      token: OperationToken;
      revision: number;
    }
  | { type: "DRAFT_PERSIST_FAILED"; token: OperationToken; errorCode: string }
  | { type: "SUBMIT_REQUESTED"; token: OperationToken }
  | { type: "SUBMIT_SUCCEEDED"; token: OperationToken; snapshot: SessionSnapshot }
  | { type: "SUBMIT_FAILED"; token: OperationToken; errorCode: string }
  | { type: "COMPLETE_REQUESTED"; token: OperationToken }
  | { type: "COMPLETE_SUCCEEDED"; token: OperationToken }
  | { type: "COMPLETE_FAILED"; token: OperationToken; errorCode: string }
  | { type: "NAVIGATION_REQUESTED"; path: "/home" }
  | { type: "RESET_OBSERVED" }
  | { type: "DISPOSED" };

export type InterviewEffect =
  | { kind: "load-or-create"; token: OperationToken }
  | { kind: "persist-draft"; token: OperationToken; draft: CommonDraftV2 }
  | {
      kind: "submit-answer";
      token: OperationToken;
      answer: ValidatedAnswerV2;
    }
  | { kind: "complete-interview"; token: OperationToken }
  | { kind: "navigate"; path: "/home" }
  | {
      kind: "announce";
      messageKey:
        | "save-before-navigation"
        | "draft-save-failed"
        | "submit-failed"
        | "complete-failed";
    };

export type MachineResult = {
  state: InterviewDomainState;
  effects: InterviewEffect[];
};

function sameToken(left: OperationToken, right: OperationToken): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.requestId === right.requestId &&
    left.interviewId === right.interviewId &&
    left.baseRevision === right.baseRevision &&
    left.runtimeGeneration === right.runtimeGeneration
  );
}

function stateFromSnapshot(
  sessionId: string,
  snapshot: SessionSnapshot,
): AnsweringState | ReviewState {
  if (snapshot.phase === "review") {
    return {
      phase: "review",
      sessionId,
      interview: snapshot.interview,
      summary: snapshot.summary,
    };
  }
  return {
    phase: "answering",
    sessionId,
    interview: snapshot.interview,
    question: snapshot.question,
    draft: snapshot.draft,
    draftSync: "clean",
    dirtySincePersist: false,
    submitQueued: false,
  };
}

function beginSubmit(
  state: AnsweringState,
  token: OperationToken,
): MachineResult {
  const result = validateDraft(state.question, state.draft);
  if (result.status !== "valid") return { state, effects: [] };
  const currentToken = {
    ...token,
    interviewId: state.interview.interviewId,
    baseRevision: state.interview.revision,
    runtimeGeneration: state.interview.runtimeGeneration,
  };
  const nextState: SubmittingState = {
    phase: "submitting",
    sessionId: state.sessionId,
    interview: state.interview,
    question: state.question,
    draft: state.draft,
    answer: result.answer,
    operation: currentToken,
  };
  return {
    state: nextState,
    effects: [
      { kind: "submit-answer", token: currentToken, answer: result.answer },
    ],
  };
}

function blockNavigation(state: InterviewDomainState): MachineResult {
  return {
    state,
    effects: [{ kind: "announce", messageKey: "save-before-navigation" }],
  };
}

export function transitionInterview(
  state: InterviewDomainState,
  event: InterviewEvent,
): MachineResult {
  if (state.phase === "disposed") {
    return { state, effects: [] };
  }
  if (state.phase === "completed") {
    if (event.type === "NAVIGATION_REQUESTED") {
      return {
        state: { phase: "disposed", sessionId: state.sessionId },
        effects: [{ kind: "navigate", path: event.path }],
      };
    }
    return { state, effects: [] };
  }
  if (event.type === "RESET_OBSERVED" || event.type === "DISPOSED") {
    return {
      state: { phase: "disposed", sessionId: state.sessionId },
      effects: [],
    };
  }
  if (event.type === "NAVIGATION_REQUESTED") {
    if (
      state.phase === "submitting" ||
      state.phase === "completing" ||
      (state.phase === "answering" && state.draftSync !== "clean")
    ) {
      return blockNavigation(state);
    }
    return {
      state: { phase: "disposed", sessionId: state.sessionId },
      effects: [{ kind: "navigate", path: event.path }],
    };
  }
  if (state.phase === "loading") {
    if (
      (event.type === "LOAD_SUCCEEDED" || event.type === "LOAD_FAILED") &&
      sameToken(state.operation, event.token)
    ) {
      return event.type === "LOAD_SUCCEEDED"
        ? { state: stateFromSnapshot(state.sessionId, event.snapshot), effects: [] }
        : {
            state: {
              phase: "load-error",
              sessionId: state.sessionId,
              errorCode: event.errorCode,
            },
            effects: [],
          };
    }
    return { state, effects: [] };
  }
  if (state.phase === "answering") {
    if (event.type === "DRAFT_EDITED") {
      return {
        state: {
          ...state,
          draft: structuredClone(event.draft),
          draftSync: state.draftSync === "saving" ? "saving" : "dirty",
          dirtySincePersist: state.draftSync === "saving",
          errorCode: undefined,
        },
        effects: [],
      };
    }
    if (event.type === "DRAFT_PERSIST_REQUESTED") {
      if (state.draftSync !== "dirty" && state.draftSync !== "error") {
        return { state, effects: [] };
      }
      const currentToken = {
        ...event.token,
        interviewId: state.interview.interviewId,
        baseRevision: state.interview.revision,
        runtimeGeneration: state.interview.runtimeGeneration,
      };
      return {
        state: {
          ...state,
          draftSync: "saving",
          dirtySincePersist: false,
          operation: currentToken,
          errorCode: undefined,
        },
        effects: [
          {
            kind: "persist-draft",
            token: currentToken,
            draft: structuredClone(state.draft),
          },
        ],
      };
    }
    if (
      event.type === "DRAFT_PERSIST_SUCCEEDED" ||
      event.type === "DRAFT_PERSIST_FAILED"
    ) {
      if (!state.operation || !sameToken(state.operation, event.token)) {
        return { state, effects: [] };
      }
      if (event.type === "DRAFT_PERSIST_FAILED") {
        return {
          state: {
            ...state,
            draftSync: "error",
            operation: undefined,
            submitQueued: false,
            queuedSubmitToken: undefined,
            errorCode: event.errorCode,
          },
          effects: [{ kind: "announce", messageKey: "draft-save-failed" }],
        };
      }
      const persisted: AnsweringState = {
        ...state,
        interview: { ...state.interview, revision: event.revision },
        draftSync: state.dirtySincePersist ? "dirty" : "clean",
        dirtySincePersist: false,
        operation: undefined,
      };
      if (persisted.draftSync === "clean" && persisted.queuedSubmitToken) {
        return beginSubmit(
          {
            ...persisted,
            submitQueued: false,
            queuedSubmitToken: undefined,
          },
          persisted.queuedSubmitToken,
        );
      }
      return { state: persisted, effects: [] };
    }
    if (event.type === "SUBMIT_REQUESTED") {
      if (state.submitQueued) return { state, effects: [] };
      if (state.draftSync !== "clean") {
        return {
          state: {
            ...state,
            submitQueued: true,
            queuedSubmitToken: event.token,
          },
          effects: [],
        };
      }
      return beginSubmit(state, event.token);
    }
    return { state, effects: [] };
  }
  if (state.phase === "submitting") {
    if (
      (event.type !== "SUBMIT_SUCCEEDED" && event.type !== "SUBMIT_FAILED") ||
      !sameToken(state.operation, event.token)
    ) {
      return { state, effects: [] };
    }
    if (event.type === "SUBMIT_SUCCEEDED") {
      return {
        state: stateFromSnapshot(state.sessionId, event.snapshot),
        effects: [],
      };
    }
    return {
      state: {
        phase: "answering",
        sessionId: state.sessionId,
        interview: state.interview,
        question: state.question,
        draft: state.draft,
        draftSync: "clean",
        dirtySincePersist: false,
        submitQueued: false,
        errorCode: event.errorCode,
      },
      effects: [{ kind: "announce", messageKey: "submit-failed" }],
    };
  }
  if (state.phase === "review") {
    if (event.type !== "COMPLETE_REQUESTED") return { state, effects: [] };
    const currentToken = {
      ...event.token,
      interviewId: state.interview.interviewId,
      baseRevision: state.interview.revision,
      runtimeGeneration: state.interview.runtimeGeneration,
    };
    return {
      state: { ...state, phase: "completing", operation: currentToken },
      effects: [{ kind: "complete-interview", token: currentToken }],
    };
  }
  if (state.phase === "completing") {
    if (
      (event.type !== "COMPLETE_SUCCEEDED" &&
        event.type !== "COMPLETE_FAILED") ||
      !sameToken(state.operation, event.token)
    ) {
      return { state, effects: [] };
    }
    if (event.type === "COMPLETE_SUCCEEDED") {
      return {
        state: {
          phase: "completed",
          sessionId: state.sessionId,
          interviewId: state.interview.interviewId,
        },
        effects: [],
      };
    }
    return {
      state: {
        phase: "review",
        sessionId: state.sessionId,
        interview: state.interview,
        summary: state.summary,
        errorCode: event.errorCode,
      },
      effects: [{ kind: "announce", messageKey: "complete-failed" }],
    };
  }
  return { state, effects: [] };
}
