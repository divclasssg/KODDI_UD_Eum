import { describe, expect, it } from "vitest";

import {
  transitionInterview,
  type AnsweringState,
  type OperationToken,
  type ReviewState,
  type SubmittingState,
} from "@/features/interview/domain/interview-machine";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";

const QUESTION = MANUAL_QUESTION_SET_V2.questions[0];

function token(requestId: string, revision = 1): OperationToken {
  return {
    sessionId: "session-1",
    requestId,
    interviewId: "interview-1",
    baseRevision: revision,
    runtimeGeneration: 0,
  };
}

function answeringState(
  overrides: Partial<AnsweringState> = {},
): AnsweringState {
  const draft = createEmptyDraft(QUESTION);
  draft.values.text.value = "합성 두통";
  return {
    phase: "answering",
    sessionId: "session-1",
    interview: {
      interviewId: "interview-1",
      revision: 1,
      runtimeGeneration: 0,
    },
    question: QUESTION,
    draft,
    draftSync: "clean",
    dirtySincePersist: false,
    submitQueued: false,
    ...overrides,
  };
}

function reviewState(): ReviewState {
  return {
    phase: "review",
    sessionId: "session-1",
    interview: {
      interviewId: "interview-1",
      revision: 2,
      runtimeGeneration: 0,
    },
    summary: { items: ["합성 두통"] },
  };
}

function snapshotForQuestion() {
  const state = answeringState();
  return {
    phase: "answering" as const,
    interview: state.interview,
    question: state.question,
    draft: state.draft,
  };
}

function submittingState(): SubmittingState {
  const state = answeringState();
  return {
    phase: "submitting",
    sessionId: state.sessionId,
    interview: state.interview,
    question: state.question,
    draft: state.draft,
    answer: { mode: "text", value: "합성 두통" },
    operation: token("submit-1"),
  };
}

const HISTORY = [{
  id: "answer-message-1",
  questionMessageId: "question-message-0",
  answerMessageId: "answer-message-1",
  questionId: QUESTION.id,
  slot: QUESTION.slot,
  question: QUESTION.text,
  answer: "합성 두통",
}];

describe("interview domain machine", () => {
  it("submit 성공의 exact token만 새 token으로 AI 질문 effect를 시작한다", () => {
    const state = submittingState();
    const aiToken = token("ai-question-1", 2);
    const snapshot = {
      phase: "waiting-for-question" as const,
      interview: { ...state.interview, revision: 2 },
      history: HISTORY,
      answeredAiFollowUps: 0,
    };

    expect(transitionInterview(state, {
      type: "SUBMIT_SUCCEEDED",
      token: state.operation,
      snapshot,
      continuationToken: aiToken,
    })).toMatchObject({
      state: { phase: "waiting-for-question", operation: aiToken },
      effects: [{ kind: "request-ai-question", token: aiToken, history: HISTORY }],
    });
    expect(transitionInterview(state, {
      type: "SUBMIT_SUCCEEDED",
      token: { ...state.operation, requestId: "stale-submit" },
      snapshot,
      continuationToken: aiToken,
    })).toEqual({ state, effects: [] });
  });

  it("AI 질문 완료는 새 exact token으로 summary effect를 이어간다", () => {
    const operation = token("ai-question-1", 2);
    const summaryToken = token("ai-summary-1", 3);
    const state = {
      phase: "waiting-for-question" as const,
      sessionId: "session-1",
      interview: { ...answeringState().interview, revision: 2 },
      history: HISTORY,
      answeredAiFollowUps: 0,
      operation,
    };
    const snapshot = {
      phase: "waiting-for-summary" as const,
      interview: { ...state.interview, revision: 3 },
      history: HISTORY,
      answeredAiFollowUps: 0,
    };

    expect(transitionInterview(state, {
      type: "AI_QUESTION_SUCCEEDED",
      token: operation,
      snapshot,
      continuationToken: summaryToken,
    })).toMatchObject({
      state: { phase: "waiting-for-summary", operation: summaryToken },
      effects: [{ kind: "request-ai-summary", token: summaryToken, history: HISTORY }],
    });
  });

  it("AI summary 성공은 review snapshot으로 전이한다", () => {
    const operation = token("ai-summary-1", 3);
    const state = {
      phase: "waiting-for-summary" as const,
      sessionId: "session-1",
      interview: { ...answeringState().interview, revision: 3 },
      history: HISTORY,
      answeredAiFollowUps: 0,
      operation,
    };
    const snapshot = {
      phase: "review" as const,
      interview: { ...state.interview, revision: 4 },
      summary: { items: ["합성 두통"], source: "ai" as const },
    };

    expect(transitionInterview(state, {
      type: "AI_SUMMARY_SUCCEEDED",
      token: operation,
      snapshot,
    })).toMatchObject({
      state: { phase: "review", summary: snapshot.summary },
      effects: [],
    });
  });

  it("urgent submit은 AI effect 없이 safety review를 보존한다", () => {
    const state = submittingState();
    const snapshot = {
      phase: "safety-review" as const,
      interview: { ...state.interview, revision: 2 },
      history: HISTORY,
      reason: "breathing-difficulty" as const,
      message: "지금은 문진보다 안전이 먼저예요.",
      actions: ["call-119", "show-to-bystander", "view-summary"] as const,
    };

    expect(transitionInterview(state, {
      type: "SUBMIT_SUCCEEDED",
      token: state.operation,
      snapshot,
      continuationToken: token("unused", 2),
    })).toMatchObject({ state: { phase: "safety-review" }, effects: [] });
  });

  it.each(["call-119", "show-to-bystander", "view-summary"] as const)(
    "허용 safety action %s는 exact success 뒤 terminal로 전이한다",
    (action) => {
      const operation = token(`safety-${action}`, 2);
      const state = {
        phase: "safety-review" as const,
        sessionId: "session-1",
        interview: { ...answeringState().interview, revision: 2 },
        history: HISTORY,
        reason: "breathing-difficulty" as const,
        message: "지금은 문진보다 안전이 먼저예요.",
        actions: ["call-119", "show-to-bystander", "view-summary"] as const,
      };
      const requested = transitionInterview(state, {
        type: "SAFETY_ACTION_REQUESTED",
        token: operation,
        action,
      });

      expect(requested).toMatchObject({
        state: { phase: "safety-review", operation },
        effects: [{ kind: "acknowledge-safety", token: operation, action }],
      });
      expect(transitionInterview(requested.state, {
        type: "SAFETY_ACTION_SUCCEEDED",
        token: operation,
      })).toEqual({
        state: {
          phase: "safety-stopped",
          sessionId: "session-1",
          interviewId: "interview-1",
        },
        effects: [],
      });
    },
  );

  it("허용 목록 밖 safety action은 runtime에서도 무시한다", () => {
    const state = {
      phase: "safety-review" as const,
      sessionId: "session-1",
      interview: { ...answeringState().interview, revision: 2 },
      history: HISTORY,
      reason: "breathing-difficulty" as const,
      message: "지금은 문진보다 안전이 먼저예요.",
      actions: ["call-119", "show-to-bystander", "view-summary"] as const,
    };

    expect(transitionInterview(state, {
      type: "SAFETY_ACTION_REQUESTED",
      token: token("invalid-action", 2),
      action: "open-external-share",
    } as never)).toEqual({ state, effects: [] });
  });

  it.each([
    ["waiting-for-question", "AI_QUESTION"],
    ["waiting-for-summary", "AI_SUMMARY"],
  ] as const)("%s의 stale success와 failure를 모두 무시한다", (phase, prefix) => {
    const operation = token("current-ai", 2);
    const state = {
      phase,
      sessionId: "session-1",
      interview: { ...answeringState().interview, revision: 2 },
      history: HISTORY,
      answeredAiFollowUps: 0,
      operation,
    };
    const snapshot = phase === "waiting-for-question"
      ? { ...snapshotForQuestion(), interview: state.interview }
      : { phase: "review" as const, interview: state.interview, summary: { items: [] } };
    for (const [field, value] of [
      ["sessionId", "stale-session"],
      ["requestId", "stale-request"],
      ["interviewId", "stale-interview"],
      ["baseRevision", 99],
      ["runtimeGeneration", 99],
    ] as const) {
      const staleToken = { ...operation, [field]: value };
      expect(transitionInterview(state, {
        type: `${prefix}_SUCCEEDED`,
        token: staleToken,
        snapshot,
        continuationToken: token("next-ai", 2),
      } as never)).toEqual({ state, effects: [] });
      expect(transitionInterview(state, {
        type: `${prefix}_FAILED`,
        token: staleToken,
        errorCode: "stale-ai-failure",
      } as never)).toEqual({ state, effects: [] });
    }
  });

  it.each([
    ["waiting-for-question", "AI_QUESTION_FAILED", "request-ai-question"],
    ["waiting-for-summary", "AI_SUMMARY_FAILED", "request-ai-summary"],
  ] as const)(
    "%s 실패는 operation을 해제하고 새 exact token으로 재시도한다",
    (phase, failureType, effectKind) => {
      const operation = token("failed-ai", 2);
      const state = {
        phase,
        sessionId: "session-1",
        interview: { ...answeringState().interview, revision: 2 },
        history: HISTORY,
        answeredAiFollowUps: 0,
        operation,
      };
      const failed = transitionInterview(state, {
        type: failureType,
        token: operation,
        errorCode: "synthetic-ai-failure",
      } as never);

      expect(failed).toMatchObject({
        state: {
          phase,
          errorCode: "synthetic-ai-failure",
        },
      });
      expect(failed.state).not.toHaveProperty("operation");

      const retryToken = token("retry-ai", 2);
      expect(transitionInterview(failed.state, {
        type: "AI_RETRY_REQUESTED",
        token: retryToken,
      } as never)).toMatchObject({
        state: { phase, operation: retryToken, errorCode: undefined },
        effects: [{ kind: effectKind, token: retryToken, history: HISTORY }],
      });
    },
  );

  it("AI 실패 복구 상태에서는 홈 navigation을 허용한다", () => {
    const state = {
      phase: "waiting-for-question" as const,
      sessionId: "session-1",
      interview: { ...answeringState().interview, revision: 2 },
      history: HISTORY,
      answeredAiFollowUps: 0,
      errorCode: "synthetic-ai-failure",
    };

    expect(transitionInterview(state, {
      type: "NAVIGATION_REQUESTED",
      path: "/home",
    })).toEqual({
      state: { phase: "disposed", sessionId: "session-1" },
      effects: [{ kind: "navigate", path: "/home" }],
    });
  });

  it("safety action의 stale success와 failure를 모두 무시한다", () => {
    const operation = token("safety-current", 2);
    const requested = transitionInterview({
      phase: "safety-review",
      sessionId: "session-1",
      interview: { ...answeringState().interview, revision: 2 },
      history: HISTORY,
      reason: "breathing-difficulty",
      message: "지금은 문진보다 안전이 먼저예요.",
      actions: ["call-119", "show-to-bystander", "view-summary"],
    }, {
      type: "SAFETY_ACTION_REQUESTED",
      token: operation,
      action: "call-119",
    });
    const staleToken = { ...operation, requestId: "safety-stale" };

    expect(transitionInterview(requested.state, {
      type: "SAFETY_ACTION_SUCCEEDED",
      token: staleToken,
    })).toEqual({ state: requested.state, effects: [] });
    expect(transitionInterview(requested.state, {
      type: "SAFETY_ACTION_FAILED",
      token: staleToken,
      errorCode: "stale-safety-failure",
    })).toEqual({ state: requested.state, effects: [] });
  });

  it.each(["waiting-for-question", "waiting-for-summary", "safety-review"] as const)(
    "%s 중 navigation을 차단한다",
    (phase) => {
      const base = {
        sessionId: "session-1",
        interview: { ...answeringState().interview, revision: 2 },
        history: HISTORY,
      };
      const state = phase === "safety-review"
        ? {
            ...base,
            phase,
            reason: "breathing-difficulty" as const,
            message: "지금은 문진보다 안전이 먼저예요.",
            actions: ["call-119", "show-to-bystander", "view-summary"] as const,
          }
        : {
            ...base,
            phase,
            answeredAiFollowUps: 0,
            operation: token(`operation-${phase}`, 2),
          };

      expect(transitionInterview(state, {
        type: "NAVIGATION_REQUESTED",
        path: "/home",
      })).toEqual({
        state,
        effects: [{ kind: "announce", messageKey: "save-before-navigation" }],
      });
    },
  );

  it.each(["RESET_OBSERVED", "DISPOSED"] as const)(
    "%s 뒤 늦은 AI 성공과 실패를 모두 폐기한다",
    (type) => {
      const operation = token("ai-question-1", 2);
      const state = {
        phase: "waiting-for-question" as const,
        sessionId: "session-1",
        interview: { ...answeringState().interview, revision: 2 },
        history: HISTORY,
        answeredAiFollowUps: 0,
        operation,
      };
      const disposed = transitionInterview(state, { type });

      expect(disposed.state).toEqual({ phase: "disposed", sessionId: "session-1" });
      expect(transitionInterview(disposed.state, {
        type: "AI_QUESTION_SUCCEEDED",
        token: operation,
        snapshot: snapshotForQuestion(),
        continuationToken: token("next", 3),
      })).toEqual({ state: disposed.state, effects: [] });
      expect(transitionInterview(disposed.state, {
        type: "AI_QUESTION_FAILED",
        token: operation,
        errorCode: "late-failure",
      })).toEqual({ state: disposed.state, effects: [] });
    },
  );
  it("valid submit은 정확히 하나의 submit effect를 만든다", () => {
    const first = transitionInterview(answeringState(), {
      type: "SUBMIT_REQUESTED",
      token: token("submit-1"),
    });
    const second = transitionInterview(first.state, {
      type: "SUBMIT_REQUESTED",
      token: token("submit-2"),
    });

    expect(first.state.phase).toBe("submitting");
    expect(first.effects).toEqual([
      expect.objectContaining({ kind: "submit-answer", token: token("submit-1") }),
    ]);
    expect(second).toEqual({ state: first.state, effects: [] });
  });

  it("draft persist 중 submit은 queue되고 success 뒤 새 revision으로 한 번 실행된다", () => {
    const saving = answeringState({
      draftSync: "saving",
      operation: token("persist-1"),
    });
    const queued = transitionInterview(saving, {
      type: "SUBMIT_REQUESTED",
      token: token("submit-1"),
    });
    const flushed = transitionInterview(queued.state, {
      type: "DRAFT_PERSIST_SUCCEEDED",
      token: token("persist-1"),
      revision: 2,
    });

    expect(queued.effects).toEqual([]);
    expect(queued.state).toMatchObject({ submitQueued: true });
    expect(flushed.state.phase).toBe("submitting");
    expect(flushed.effects).toEqual([
      expect.objectContaining({
        kind: "submit-answer",
        token: expect.objectContaining({
          requestId: "submit-1",
          baseRevision: 2,
        }),
      }),
    ]);
  });

  it("persist 도중 새 편집이 있으면 이전 success가 최신 draft를 clean으로 만들지 않는다", () => {
    const saving = answeringState({
      draftSync: "saving",
      operation: token("persist-1"),
    });
    const nextDraft = structuredClone(saving.draft);
    nextDraft.values.text.value = "합성 최신 입력";
    const edited = transitionInterview(saving, {
      type: "DRAFT_EDITED",
      draft: nextDraft,
    });
    const persisted = transitionInterview(edited.state, {
      type: "DRAFT_PERSIST_SUCCEEDED",
      token: token("persist-1"),
      revision: 2,
    });

    expect(persisted.state).toMatchObject({
      phase: "answering",
      draftSync: "dirty",
      draft: { values: { text: { value: "합성 최신 입력" } } },
      interview: { revision: 2 },
    });
    expect(persisted.effects).toEqual([]);
  });

  it.each(["DRAFT_PERSIST_SUCCEEDED", "DRAFT_PERSIST_FAILED"] as const)(
    "stale %s는 state와 effect를 바꾸지 않는다",
    (type) => {
      const state = answeringState({
        draftSync: "saving",
        operation: token("current"),
      });
      const event =
        type === "DRAFT_PERSIST_SUCCEEDED"
          ? { type, token: token("stale"), revision: 2 }
          : { type, token: token("stale"), errorCode: "save-failed" };

      expect(transitionInterview(state, event)).toEqual({ state, effects: [] });
    },
  );

  it.each([
    ["sessionId", "stale-session"],
    ["requestId", "stale-request"],
    ["interviewId", "stale-interview"],
    ["baseRevision", 99],
    ["runtimeGeneration", 99],
  ] as const)(
    "submit result의 %s가 다르면 stale success와 failure를 모두 폐기한다",
    (field, value) => {
      const started = transitionInterview(answeringState(), {
        type: "SUBMIT_REQUESTED",
        token: token("submit-identity"),
      });
      if (started.state.phase !== "submitting") {
        throw new Error("expected-submitting");
      }
      const staleToken = { ...started.state.operation, [field]: value };

      expect(
        transitionInterview(started.state, {
          type: "SUBMIT_SUCCEEDED",
          token: staleToken,
          snapshot: {
            phase: "review",
            interview: {
              interviewId: "interview-1",
              revision: 2,
              runtimeGeneration: 0,
            },
            summary: { items: ["합성 stale 요약"] },
          },
        }),
      ).toEqual({ state: started.state, effects: [] });
      expect(
        transitionInterview(started.state, {
          type: "SUBMIT_FAILED",
          token: staleToken,
          errorCode: "stale-failure",
        }),
      ).toEqual({ state: started.state, effects: [] });
    },
  );

  it("submit failure는 질문과 모든 mode draft를 보존한다", () => {
    const started = transitionInterview(answeringState(), {
      type: "SUBMIT_REQUESTED",
      token: token("submit-1"),
    });
    const failed = transitionInterview(started.state, {
      type: "SUBMIT_FAILED",
      token: token("submit-1"),
      errorCode: "save-failed",
    });

    expect(failed.state).toMatchObject({
      phase: "answering",
      question: QUESTION,
      draft: answeringState().draft,
      errorCode: "save-failed",
    });
  });

  it("queued submit 앞의 draft 저장 실패는 입력을 보존하고 재시도를 연다", () => {
    const saving = answeringState({
      draftSync: "saving",
      operation: token("persist-1"),
      submitQueued: true,
      queuedSubmitToken: token("submit-1"),
    });

    const failed = transitionInterview(saving, {
      type: "DRAFT_PERSIST_FAILED",
      token: token("persist-1"),
      errorCode: "save-failed",
    });

    expect(failed.state).toMatchObject({
      phase: "answering",
      draft: saving.draft,
      draftSync: "error",
      submitQueued: false,
      errorCode: "save-failed",
    });
    expect(failed.state).toHaveProperty("queuedSubmitToken", undefined);
  });

  it.each(["dirty", "saving"] as const)(
    "%s draft 상태에서는 navigation을 차단한다",
    (draftSync) => {
      const state = answeringState({ draftSync });
      const result = transitionInterview(state, {
        type: "NAVIGATION_REQUESTED",
        path: "/home",
      });

      expect(result.state).toEqual(state);
      expect(result.effects).toEqual([
        { kind: "announce", messageKey: "save-before-navigation" },
      ]);
    },
  );

  it("clean navigation은 dispose 뒤 route effect를 만든다", () => {
    const result = transitionInterview(answeringState(), {
      type: "NAVIGATION_REQUESTED",
      path: "/home",
    });

    expect(result.state).toEqual({ phase: "disposed", sessionId: "session-1" });
    expect(result.effects).toEqual([{ kind: "navigate", path: "/home" }]);
  });

  it("completed 상태의 명시적 navigation은 홈 이동 effect를 만든다", () => {
    const state = {
      phase: "completed" as const,
      sessionId: "session-1",
      interviewId: "interview-1",
    };

    expect(
      transitionInterview(state, {
        type: "NAVIGATION_REQUESTED",
        path: "/home",
      }),
    ).toEqual({
      state: { phase: "disposed", sessionId: "session-1" },
      effects: [{ kind: "navigate", path: "/home" }],
    });
  });

  it("complete 성공은 exact token에서만 completed로 전이한다", () => {
    const started = transitionInterview(reviewState(), {
      type: "COMPLETE_REQUESTED",
      token: token("complete-1", 2),
    });
    if (started.state.phase !== "completing") {
      throw new Error("expected-completing");
    }

    const stale = transitionInterview(started.state, {
      type: "COMPLETE_SUCCEEDED",
      token: { ...started.state.operation, requestId: "stale-complete" },
    });
    const completed = transitionInterview(started.state, {
      type: "COMPLETE_SUCCEEDED",
      token: started.state.operation,
    });

    expect(started.effects).toEqual([
      {
        kind: "complete-interview",
        token: started.state.operation,
      },
    ]);
    expect(stale).toEqual({ state: started.state, effects: [] });
    expect(completed).toEqual({
      state: {
        phase: "completed",
        sessionId: "session-1",
        interviewId: "interview-1",
      },
      effects: [],
    });
  });

  it("complete 실패는 review snapshot을 보존하고 새 token 재시도를 허용한다", () => {
    const started = transitionInterview(reviewState(), {
      type: "COMPLETE_REQUESTED",
      token: token("complete-1", 2),
    });
    if (started.state.phase !== "completing") {
      throw new Error("expected-completing");
    }
    const failed = transitionInterview(started.state, {
      type: "COMPLETE_FAILED",
      token: started.state.operation,
      errorCode: "complete-failed",
    });
    const retried = transitionInterview(failed.state, {
      type: "COMPLETE_REQUESTED",
      token: token("complete-2", 2),
    });

    expect(failed.state).toEqual({
      ...reviewState(),
      errorCode: "complete-failed",
    });
    expect(retried.state).toMatchObject({
      phase: "completing",
      operation: { requestId: "complete-2", baseRevision: 2 },
    });
    expect(retried.effects).toHaveLength(1);
  });

  it("reset 이후 늦은 submit success와 failure를 모두 폐기한다", () => {
    const started = transitionInterview(answeringState(), {
      type: "SUBMIT_REQUESTED",
      token: token("submit-1"),
    });
    const reset = transitionInterview(started.state, { type: "RESET_OBSERVED" });

    expect(reset.state).toEqual({ phase: "disposed", sessionId: "session-1" });
    expect(
      transitionInterview(reset.state, {
        type: "SUBMIT_SUCCEEDED",
        token: token("submit-1"),
        snapshot: {
          phase: "review",
          interview: {
            interviewId: "interview-1",
            revision: 2,
            runtimeGeneration: 0,
          },
          summary: { items: ["합성 요약"] },
        },
      }),
    ).toEqual({ state: reset.state, effects: [] });
    expect(
      transitionInterview(reset.state, {
        type: "SUBMIT_FAILED",
        token: token("submit-1"),
        errorCode: "late-failure",
      }),
    ).toEqual({ state: reset.state, effects: [] });
  });
});
