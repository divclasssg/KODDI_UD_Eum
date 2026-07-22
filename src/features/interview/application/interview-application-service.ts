import type {
  CommonDraftV2,
  ValidatedAnswerV2,
} from "../domain/interview-draft";
import {
  transitionInterview,
  type InterviewDomainState,
  type InterviewEffect,
  type OperationToken,
  type SessionSnapshot,
} from "../domain/interview-machine";

export type InterviewApplicationRepositoryPort = {
  loadOrCreateManual(input: {
    runtimeGeneration: number;
  }): Promise<SessionSnapshot>;
  persistDraft(input: {
    token: OperationToken;
    draft: CommonDraftV2;
  }): Promise<SessionSnapshot>;
  submitAnswer(input: {
    token: OperationToken;
    answer: ValidatedAnswerV2;
  }): Promise<SessionSnapshot>;
  complete(input: { token: OperationToken }): Promise<void>;
};

type InterviewApplicationServiceDependencies = {
  repository: InterviewApplicationRepositoryPort;
  navigate: (path: "/home") => void;
  captureRuntimeGeneration: () => number;
  randomId?: () => string;
};

export type InterviewApplicationService = {
  start(): void;
  getState(): InterviewDomainState;
  subscribe(listener: (state: InterviewDomainState) => void): () => void;
  editDraft(draft: CommonDraftV2): void;
  submit(): void;
  complete(): void;
  navigate(path: "/home"): void;
  dispose(): void;
  whenIdle(): Promise<void>;
};

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name || "operation-failed" : "operation-failed";
}

export function createInterviewApplicationService({
  repository,
  navigate,
  captureRuntimeGeneration,
  randomId = () => crypto.randomUUID(),
}: InterviewApplicationServiceDependencies): InterviewApplicationService {
  const sessionId = randomId();
  const runtimeGeneration = captureRuntimeGeneration();
  const createLoadToken = (): OperationToken => ({
    sessionId,
    requestId: randomId(),
    interviewId: "manual-pending",
    baseRevision: 0,
    runtimeGeneration: captureRuntimeGeneration(),
  });
  const initialLoadToken = createLoadToken();
  let state: InterviewDomainState = {
    phase: "loading",
    sessionId,
    operation: initialLoadToken,
  };
  let started = false;
  const listeners = new Set<(nextState: InterviewDomainState) => void>();
  const pending = new Set<Promise<void>>();

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  const createToken = (): OperationToken => {
    const interview =
      state.phase === "answering" ||
      state.phase === "submitting" ||
      state.phase === "review" ||
      state.phase === "completing"
        ? state.interview
        : undefined;
    return {
      sessionId,
      requestId: randomId(),
      interviewId: interview?.interviewId ?? "manual-pending",
      baseRevision: interview?.revision ?? 0,
      runtimeGeneration: interview?.runtimeGeneration ?? runtimeGeneration,
    };
  };

  const track = (operation: Promise<void>) => {
    pending.add(operation);
    void operation.finally(() => pending.delete(operation));
  };

  const dispatch = (event: Parameters<typeof transitionInterview>[1]) => {
    const result = transitionInterview(state, event);
    state = result.state;
    notify();
    result.effects.forEach(runEffect);
  };

  const acceptsRuntimeGeneration = (token: OperationToken): boolean => {
    if (captureRuntimeGeneration() === token.runtimeGeneration) return true;
    dispatch({ type: "RESET_OBSERVED" });
    return false;
  };

  const flushDirtyDraft = () => {
    if (
      state.phase !== "answering" ||
      (state.draftSync !== "dirty" && state.draftSync !== "error")
    ) {
      return;
    }
    dispatch({ type: "DRAFT_PERSIST_REQUESTED", token: createToken() });
  };

  function runEffect(effect: InterviewEffect) {
    if (effect.kind === "navigate") {
      navigate(effect.path);
      return;
    }
    if (effect.kind === "announce") return;
    let operation: Promise<void>;
    if (effect.kind === "load-or-create") {
      operation = repository
        .loadOrCreateManual({ runtimeGeneration: effect.token.runtimeGeneration })
        .then((snapshot) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({ type: "LOAD_SUCCEEDED", token: effect.token, snapshot });
        })
        .catch((error) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({
            type: "LOAD_FAILED",
            token: effect.token,
            errorCode: errorCode(error),
          });
        });
    } else if (effect.kind === "persist-draft") {
      operation = repository
        .persistDraft({ token: effect.token, draft: effect.draft })
        .then((snapshot) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({
            type: "DRAFT_PERSIST_SUCCEEDED",
            token: effect.token,
            revision: snapshot.interview.revision,
          });
          flushDirtyDraft();
        })
        .catch((error) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({
            type: "DRAFT_PERSIST_FAILED",
            token: effect.token,
            errorCode: errorCode(error),
          });
        });
    } else if (effect.kind === "submit-answer") {
      operation = repository
        .submitAnswer({ token: effect.token, answer: effect.answer })
        .then((snapshot) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({ type: "SUBMIT_SUCCEEDED", token: effect.token, snapshot });
        })
        .catch((error) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({
            type: "SUBMIT_FAILED",
            token: effect.token,
            errorCode: errorCode(error),
          });
        });
    } else {
      operation = repository
        .complete({ token: effect.token })
        .then(() => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({ type: "COMPLETE_SUCCEEDED", token: effect.token });
        })
        .catch((error) => {
          if (!acceptsRuntimeGeneration(effect.token)) return;
          dispatch({
            type: "COMPLETE_FAILED",
            token: effect.token,
            errorCode: errorCode(error),
          });
        });
    }
    track(operation);
  }

  return {
    start() {
      if (started) return;
      started = true;
      if (state.phase === "disposed") {
        const token = createLoadToken();
        state = { phase: "loading", sessionId, operation: token };
        notify();
        runEffect({ kind: "load-or-create", token });
        return;
      }
      runEffect({ kind: "load-or-create", token: initialLoadToken });
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    editDraft(draft) {
      dispatch({ type: "DRAFT_EDITED", draft });
      flushDirtyDraft();
    },
    submit() {
      dispatch({ type: "SUBMIT_REQUESTED", token: createToken() });
      flushDirtyDraft();
    },
    complete() {
      dispatch({ type: "COMPLETE_REQUESTED", token: createToken() });
    },
    navigate(path) {
      dispatch({ type: "NAVIGATION_REQUESTED", path });
    },
    dispose() {
      started = false;
      dispatch({ type: "DISPOSED" });
      listeners.clear();
    },
    async whenIdle() {
      while (pending.size > 0) {
        await Promise.allSettled([...pending]);
      }
    },
  };
}
