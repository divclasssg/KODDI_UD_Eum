import { describe, expect, it, vi } from "vitest";

import {
  createInterviewApplicationService,
  type InterviewApplicationRepositoryPort,
} from "@/features/interview/application/interview-application-service";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import type { SessionSnapshot } from "@/features/interview/domain/interview-machine";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";

const QUESTION = MANUAL_QUESTION_SET_V2.questions[0];
type AnsweringSnapshot = Extract<SessionSnapshot, { phase: "answering" }>;

function snapshot(revision = 1): AnsweringSnapshot {
  const draft = createEmptyDraft(QUESTION);
  draft.values.text.value = "합성 두통";
  return {
    phase: "answering",
    interview: {
      interviewId: "interview-1",
      revision,
      runtimeGeneration: 0,
    },
    question: QUESTION,
    draft,
  };
}

function reviewSnapshot(revision = 2): Extract<SessionSnapshot, { phase: "review" }> {
  return {
    phase: "review",
    interview: {
      interviewId: "interview-1",
      revision,
      runtimeGeneration: 0,
    },
    summary: { items: ["합성 두통"] },
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createService(
  repositoryOverrides: Partial<InterviewApplicationRepositoryPort> = {},
  captureRuntimeGeneration: () => number = () => 0,
) {
  let id = 0;
  const repository: InterviewApplicationRepositoryPort = {
    loadOrCreateManual: vi.fn().mockResolvedValue(snapshot()),
    persistDraft: vi.fn().mockResolvedValue(snapshot(2)),
    submitAnswer: vi.fn().mockResolvedValue({
      phase: "review",
      interview: {
        interviewId: "interview-1",
        revision: 2,
        runtimeGeneration: 0,
      },
      summary: { items: ["합성 두통"] },
    }),
    complete: vi.fn().mockResolvedValue(undefined),
    ...repositoryOverrides,
  };
  const navigate = vi.fn();
  const service = createInterviewApplicationService({
    repository,
    navigate,
    captureRuntimeGeneration,
    randomId: () => `id-${++id}`,
  });
  return { navigate, repository, service };
}

describe("interview application service", () => {
  it("load effect를 실행해 answering snapshot을 machine에 전달한다", async () => {
    const { repository, service } = createService();

    service.start();
    await service.whenIdle();

    expect(repository.loadOrCreateManual).toHaveBeenCalledOnce();
    expect(service.getState()).toMatchObject({
      phase: "answering",
      interview: { interviewId: "interview-1", revision: 1 },
    });
  });

  it("submit은 최신 draft persist가 끝난 뒤 한 번만 repository에 전달된다", async () => {
    const pendingPersist = deferred<SessionSnapshot>();
    const submitAnswer = vi.fn().mockResolvedValue({
      phase: "review",
      interview: {
        interviewId: "interview-1",
        revision: 3,
        runtimeGeneration: 0,
      },
      summary: { items: ["합성 최신 입력"] },
    } satisfies SessionSnapshot);
    const { repository, service } = createService({
      persistDraft: vi.fn(() => pendingPersist.promise),
      submitAnswer,
    });
    service.start();
    await service.whenIdle();
    const state = service.getState();
    if (state.phase !== "answering") throw new Error("expected-answering");
    const draft = structuredClone(state.draft);
    draft.values.text.value = "합성 최신 입력";

    service.editDraft(draft);
    service.submit();

    expect(repository.persistDraft).toHaveBeenCalledOnce();
    expect(submitAnswer).not.toHaveBeenCalled();

    pendingPersist.resolve({ ...snapshot(2), draft });
    await service.whenIdle();

    expect(submitAnswer).toHaveBeenCalledOnce();
    expect(submitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({ baseRevision: 2 }),
      }),
    );
  });

  it("older persist failure는 newer session state에 alert를 만들지 않는다", async () => {
    const pendingPersist = deferred<SessionSnapshot>();
    const { service } = createService({
      persistDraft: vi.fn(() => pendingPersist.promise),
    });
    service.start();
    await service.whenIdle();
    const state = service.getState();
    if (state.phase !== "answering") throw new Error("expected-answering");
    const draft = structuredClone(state.draft);
    draft.values.text.value = "합성 폐기 대상";
    service.editDraft(draft);
    service.dispose();

    pendingPersist.reject(new Error("합성 늦은 실패"));
    await service.whenIdle();

    expect(service.getState()).toEqual({
      phase: "disposed",
      sessionId: "id-1",
    });
  });

  it("reset 뒤 늦은 persist 성공과 후속 저장을 폐기한다", async () => {
    let runtimeGeneration = 0;
    const pendingPersist = deferred<SessionSnapshot>();
    const persistDraft = vi.fn(() => pendingPersist.promise);
    const { service } = createService(
      { persistDraft },
      () => runtimeGeneration,
    );
    service.start();
    await service.whenIdle();
    const state = service.getState();
    if (state.phase !== "answering") throw new Error("expected-answering");
    const firstDraft = structuredClone(state.draft);
    firstDraft.values.text.value = "합성 첫 입력";
    service.editDraft(firstDraft);
    const secondDraft = structuredClone(firstDraft);
    secondDraft.values.text.value = "합성 후속 입력";
    service.editDraft(secondDraft);

    runtimeGeneration = 1;
    pendingPersist.resolve({ ...snapshot(2), draft: firstDraft });
    await service.whenIdle();

    expect(service.getState()).toEqual({ phase: "disposed", sessionId: "id-1" });
    expect(persistDraft).toHaveBeenCalledOnce();
  });

  it("reset 뒤 늦은 persist 실패를 화면 오류로 복구하지 않는다", async () => {
    let runtimeGeneration = 0;
    const pendingPersist = deferred<SessionSnapshot>();
    const { service } = createService(
      { persistDraft: vi.fn(() => pendingPersist.promise) },
      () => runtimeGeneration,
    );
    service.start();
    await service.whenIdle();
    const state = service.getState();
    if (state.phase !== "answering") throw new Error("expected-answering");
    const draft = structuredClone(state.draft);
    draft.values.text.value = "합성 폐기 입력";
    service.editDraft(draft);

    runtimeGeneration = 1;
    pendingPersist.reject(new Error("합성 늦은 실패"));
    await service.whenIdle();

    expect(service.getState()).toEqual({ phase: "disposed", sessionId: "id-1" });
  });

  it("draft 저장 실패 뒤 submit 재시도는 같은 입력을 다시 저장한다", async () => {
    const persistDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error("합성 첫 저장 실패"))
      .mockResolvedValueOnce(snapshot(2));
    const { service } = createService({ persistDraft });
    service.start();
    await service.whenIdle();
    const state = service.getState();
    if (state.phase !== "answering") throw new Error("expected-answering");
    const draft = structuredClone(state.draft);
    draft.values.text.value = "합성 재시도 입력";

    service.editDraft(draft);
    await service.whenIdle();
    service.submit();
    await service.whenIdle();

    expect(persistDraft).toHaveBeenCalledTimes(2);
    expect(persistDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ draft }),
    );
  });

  it("dirty state navigation은 막고 clean state navigation만 실행한다", async () => {
    const pendingPersist = deferred<SessionSnapshot>();
    const { navigate, service } = createService({
      persistDraft: vi.fn(() => pendingPersist.promise),
    });
    service.start();
    await service.whenIdle();
    const state = service.getState();
    if (state.phase !== "answering") throw new Error("expected-answering");
    const draft = structuredClone(state.draft);
    draft.values.text.value = "합성 저장 중";

    service.editDraft(draft);
    service.navigate("/home");
    expect(navigate).not.toHaveBeenCalled();

    pendingPersist.resolve({ ...snapshot(2), draft });
    await service.whenIdle();
    service.navigate("/home");

    expect(navigate).toHaveBeenCalledOnce();
  });

  it("complete 중 중복 요청을 한 번만 저장하고 완료한다", async () => {
    const pendingComplete = deferred<void>();
    const complete = vi.fn(() => pendingComplete.promise);
    const { service } = createService({
      loadOrCreateManual: vi.fn().mockResolvedValue(reviewSnapshot()),
      complete,
    });
    service.start();
    await service.whenIdle();

    service.complete();
    service.complete();
    expect(complete).toHaveBeenCalledOnce();

    pendingComplete.resolve();
    await service.whenIdle();

    expect(service.getState()).toEqual({
      phase: "completed",
      sessionId: "id-1",
      interviewId: "interview-1",
    });
  });

  it("complete 실패 뒤 저장된 review를 유지하고 새 요청으로 재시도한다", async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error("합성 완료 실패"))
      .mockResolvedValueOnce(undefined);
    const { service } = createService({
      loadOrCreateManual: vi.fn().mockResolvedValue(reviewSnapshot()),
      complete,
    });
    service.start();
    await service.whenIdle();

    service.complete();
    await service.whenIdle();
    expect(service.getState()).toMatchObject({
      phase: "review",
      summary: { items: ["합성 두통"] },
      errorCode: "Error",
    });

    service.complete();
    await service.whenIdle();

    expect(complete).toHaveBeenCalledTimes(2);
    expect(service.getState()).toMatchObject({ phase: "completed" });
  });
});
