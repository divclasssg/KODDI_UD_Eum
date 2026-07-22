import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  createInterviewApplicationService,
  type InterviewApplicationRepositoryPort,
} from "@/features/interview/application/interview-application-service";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import type { SessionSnapshot } from "@/features/interview/domain/interview-machine";
import { ManualInterviewScreen } from "@/features/interview/manual/manual-interview-screen";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";

const QUESTION = MANUAL_QUESTION_SET_V2.questions[0];

function snapshot(revision = 1): Extract<SessionSnapshot, { phase: "answering" }> {
  return {
    phase: "answering",
    interview: {
      interviewId: "manual-synthetic",
      revision,
      runtimeGeneration: 0,
    },
    question: QUESTION,
    draft: createEmptyDraft(QUESTION),
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createService(
  overrides: Partial<InterviewApplicationRepositoryPort> = {},
) {
  let id = 0;
  const repository: InterviewApplicationRepositoryPort = {
    loadOrCreateManual: vi.fn().mockResolvedValue(snapshot()),
    persistDraft: vi.fn().mockResolvedValue(snapshot(2)),
    submitAnswer: vi.fn().mockResolvedValue({
      phase: "review",
      interview: {
        interviewId: "manual-synthetic",
        revision: 3,
        runtimeGeneration: 0,
      },
      summary: { items: ["합성 불편함"] },
    }),
    complete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return {
    repository,
    service: createInterviewApplicationService({
      repository,
      navigate: vi.fn(),
      captureRuntimeGeneration: () => 0,
      randomId: () => `screen-${++id}`,
    }),
  };
}

describe("ManualInterviewScreen", () => {
  it("Strict Mode의 재설정 뒤에도 문진을 다시 불러온다", async () => {
    const { repository, service } = createService();

    render(
      <StrictMode>
        <ManualInterviewScreen service={service} />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { name: FIRST_QUESTION_TEXT }),
    ).toBeInTheDocument();
    expect(repository.loadOrCreateManual).toHaveBeenCalledTimes(2);
  });

  it("저장 실패 시 현재 질문과 입력을 유지한다", async () => {
    const { service } = createService({
      persistDraft: vi.fn().mockRejectedValue(new Error("합성 실패")),
    });
    render(<ManualInterviewScreen service={service} />);

    const answer = await screen.findByLabelText("답변");
    fireEvent.change(answer, { target: { value: "합성 불편함" } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장하지 못했어요",
    );
    expect(answer).toHaveValue("합성 불편함");
  });

  it("저장 중 빠른 중복 제출을 한 번만 처리한다", async () => {
    const pendingPersist = deferred<SessionSnapshot>();
    const submitAnswer = vi.fn().mockResolvedValue({
      phase: "review",
      interview: {
        interviewId: "manual-synthetic",
        revision: 3,
        runtimeGeneration: 0,
      },
      summary: { items: ["합성 불편함"] },
    } satisfies SessionSnapshot);
    const { service } = createService({
      persistDraft: vi.fn(() => pendingPersist.promise),
      submitAnswer,
    });
    render(<ManualInterviewScreen service={service} />);

    fireEvent.change(await screen.findByLabelText("답변"), {
      target: { value: "합성 불편함" },
    });
    const submit = screen.getByRole("button", { name: "답변 저장" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(submitAnswer).not.toHaveBeenCalled();
    const currentState = service.getState();
    pendingPersist.resolve({
      ...snapshot(2),
      draft:
        currentState.phase === "answering"
          ? currentState.draft
          : createEmptyDraft(QUESTION),
    });
    await service.whenIdle();

    expect(submitAnswer).toHaveBeenCalledOnce();
  });

  it("Persona와 fixture, 질문 번호, 고정 진행률을 표시하지 않는다", async () => {
    const { service } = createService();
    render(<ManualInterviewScreen service={service} />);

    await screen.findByRole("heading", { name: FIRST_QUESTION_TEXT });
    expect(document.body).not.toHaveTextContent(/persona|페르소나|fixture/i);
    expect(document.body).not.toHaveTextContent(/1\/5|20%/);
  });
});

const FIRST_QUESTION_TEXT = "지금 가장 불편한 점을 적어 주세요.";
