import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AiInterviewPage from "@/app/interview/ai/page";
import { parsePublicAiMaximumFollowUps } from "@/features/interview/ai/public-ai-config";
import { AiInterviewScreen } from "@/features/interview/ai/ai-interview-screen";
import { PUBLIC_AI_SAFETY_MESSAGE } from "@/features/interview/ai/ai-interview-service";
import type { InterviewApplicationService } from "@/features/interview/application/interview-application-service";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import type {
  InterviewDomainState,
  OperationToken,
} from "@/features/interview/domain/interview-machine";
import { createDeterministicFirstAiQuestion } from "@/features/interview/manual/manual-question-set";

const QUESTION = createDeterministicFirstAiQuestion();
const IDENTITY = {
  interviewId: "public-ai-synthetic",
  revision: 2,
  runtimeGeneration: 0,
};
const TOKEN: OperationToken = {
  sessionId: "screen-session",
  requestId: "screen-request",
  interviewId: IDENTITY.interviewId,
  baseRevision: IDENTITY.revision,
  runtimeGeneration: IDENTITY.runtimeGeneration,
};
const HISTORY = [
  {
    id: "answer-message-1",
    questionMessageId: "question-message-1",
    answerMessageId: "answer-message-1",
    questionId: QUESTION.id,
    slot: QUESTION.slot,
    question: QUESTION.text,
    answer: "어제부터 가슴이 답답해요.",
  },
];

function createScreenService(state: InterviewDomainState) {
  const service: InterviewApplicationService = {
    start: vi.fn(),
    getState: () => state,
    subscribe: vi.fn(() => vi.fn()),
    editDraft: vi.fn(),
    submit: vi.fn(),
    retryAi: vi.fn(),
    complete: vi.fn(),
    acknowledgeSafety: vi.fn(),
    navigate: vi.fn(),
    dispose: vi.fn(),
    whenIdle: vi.fn().mockResolvedValue(undefined),
  };
  return service;
}

function createControllableScreenService(initialState: InterviewDomainState) {
  let state = initialState;
  const listeners = new Set<(next: InterviewDomainState) => void>();
  const service: InterviewApplicationService = {
    start: vi.fn(),
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    editDraft: vi.fn(),
    submit: vi.fn(),
    retryAi: vi.fn(),
    complete: vi.fn(),
    acknowledgeSafety: vi.fn(),
    navigate: vi.fn(),
    dispose: vi.fn(),
    whenIdle: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service,
    transition(nextState: InterviewDomainState) {
      state = nextState;
      listeners.forEach((listener) => listener(nextState));
    },
  };
}

describe("AiInterviewScreen", () => {
  it("초기 mount는 focus를 빼앗지 않고 이후 question과 주요 상태 제목에 focus한다", () => {
    const initialDraft = createEmptyDraft(QUESTION);
    const initialState: InterviewDomainState = {
      phase: "answering",
      sessionId: "screen-session",
      interview: IDENTITY,
      question: QUESTION,
      draft: initialDraft,
      draftSync: "clean",
      dirtySincePersist: false,
      submitQueued: false,
    };
    const controller = createControllableScreenService(initialState);
    render(<AiInterviewScreen service={controller.service} />);

    const initialHeading = screen.getByRole("heading", { name: QUESTION.text });
    expect(initialHeading).toHaveAttribute("tabindex", "-1");
    expect(initialHeading).not.toHaveFocus();

    const nextQuestion = {
      ...QUESTION,
      id: "public-ai-follow-up-focus",
      text: "불편함은 언제부터 이어졌나요?",
    };
    act(() => controller.transition({
      ...initialState,
      question: nextQuestion,
      draft: createEmptyDraft(nextQuestion),
    }));
    expect(
      screen.getByRole("heading", { name: nextQuestion.text }),
    ).toHaveFocus();

    act(() => controller.transition({
      phase: "waiting-for-question",
      sessionId: "screen-session",
      interview: IDENTITY,
      history: HISTORY,
      answeredAiFollowUps: 1,
      operation: TOKEN,
    }));
    expect(
      screen.getByRole("heading", { name: "다음 질문을 준비하고 있어요" }),
    ).toHaveFocus();

    act(() => controller.transition({
      phase: "waiting-for-question",
      sessionId: "screen-session",
      interview: IDENTITY,
      history: HISTORY,
      answeredAiFollowUps: 1,
      errorCode: "synthetic-ai-failure",
    }));
    expect(
      screen.getByRole("heading", { name: "AI 요청을 완료하지 못했어요" }),
    ).toHaveFocus();

    act(() => controller.transition({
      phase: "safety-review",
      sessionId: "screen-session",
      interview: IDENTITY,
      history: HISTORY,
      reason: "breathing",
      message: PUBLIC_AI_SAFETY_MESSAGE,
      actions: ["call-119", "show-to-bystander", "view-summary"],
    }));
    expect(
      screen.getByRole("heading", {
        name: "지금은 문진보다 안전이 먼저예요",
      }),
    ).toHaveFocus();

    act(() => controller.transition({
      phase: "review",
      sessionId: "screen-session",
      interview: IDENTITY,
      summary: { source: "ai", items: ["합성 AI 요약"] },
    }));
    expect(
      screen.getByRole("heading", { name: "문진 내용을 확인해 주세요" }),
    ).toHaveFocus();
  });

  it("answering에서는 질문과 입력, 하나의 primary 저장 행동을 제공한다", () => {
    const draft = createEmptyDraft(QUESTION);
    draft.values.text.value = "어제부터 가슴이 답답해요.";
    const service = createScreenService({
      phase: "answering",
      sessionId: "screen-session",
      interview: IDENTITY,
      question: QUESTION,
      draft,
      draftSync: "clean",
      dirtySincePersist: false,
      submitQueued: false,
    });

    render(<AiInterviewScreen service={service} />);

    expect(screen.getByRole("heading", { name: QUESTION.text })).toBeVisible();
    expect(screen.getByLabelText("답변")).toHaveValue(
      "어제부터 가슴이 답답해요.",
    );
    const submit = screen.getByRole("button", { name: "답변 저장" });
    expect(submit).toBeEnabled();
    expect(submit).toHaveAttribute("data-action-emphasis", "primary");
    fireEvent.click(submit);
    expect(service.submit).toHaveBeenCalledOnce();
    expect(document.body).not.toHaveTextContent(
      /persona|페르소나|fixture|역할극/i,
    );
  });

  it.each([
    ["waiting-for-question", "다음 질문을 준비하고 있어요"],
    ["waiting-for-summary", "문진 내용을 정리하고 있어요"],
  ] as const)("%s에서는 입력을 잠그고 busy 상태를 알린다", (phase, message) => {
    const service = createScreenService({
      phase,
      sessionId: "screen-session",
      interview: IDENTITY,
      history: HISTORY,
      answeredAiFollowUps: 1,
      operation: TOKEN,
    });

    render(<AiInterviewScreen service={service} />);

    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByLabelText("답변")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["waiting-for-question", "다시 질문 받기"],
    ["waiting-for-summary", "다시 요약하기"],
  ] as const)("%s 실패에서는 busy를 풀고 retry와 홈 복구를 제공한다", (phase, retryName) => {
    const service = createScreenService({
      phase,
      sessionId: "screen-session",
      interview: IDENTITY,
      history: HISTORY,
      answeredAiFollowUps: 1,
      errorCode: "synthetic-ai-failure",
    });

    render(<AiInterviewScreen service={service} />);

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "AI 요청을 완료하지 못했어요.",
    );
    const retry = screen.getByRole("button", { name: retryName });
    const home = screen.getByRole("button", { name: "홈으로" });
    expect(retry).toHaveAttribute("data-action-emphasis", "primary");
    fireEvent.click(retry);
    fireEvent.click(home);
    expect(service.retryAi).toHaveBeenCalledOnce();
    expect(service.navigate).toHaveBeenCalledWith("/home");
  });

  it("AI review에서는 출처와 요약을 표시하고 완료 저장을 primary로 둔다", () => {
    const service = createScreenService({
      phase: "review",
      sessionId: "screen-session",
      interview: IDENTITY,
      summary: {
        source: "ai",
        items: ["어제부터 가슴 답답함이 있어요."],
      },
    });

    render(<AiInterviewScreen service={service} />);

    expect(screen.getByText("AI가 답변을 정리했어요.")).toBeVisible();
    expect(screen.getByText("어제부터 가슴 답답함이 있어요.")).toBeVisible();
    const complete = screen.getByRole("button", { name: "문진 저장 완료" });
    expect(complete).toHaveAttribute("data-action-emphasis", "primary");
    fireEvent.click(complete);
    expect(service.complete).toHaveBeenCalledOnce();
  });

  it("fallback review에서는 입력 답변 기반의 결정론적 정리임을 알린다", () => {
    const service = createScreenService({
      phase: "review",
      sessionId: "screen-session",
      interview: IDENTITY,
      summary: {
        source: "manual",
        items: ["입력한 답변: 어제부터 가슴이 답답해요."],
      },
    });

    render(<AiInterviewScreen service={service} />);

    expect(
      screen.getByText(
        "AI 정리에 문제가 있어 입력한 답변을 기준으로 정리했어요.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/입력한 답변:/)).toBeVisible();
  });

  it("완료 저장 실패 뒤 요약과 같은 retry 행동을 유지한다", () => {
    const service = createScreenService({
      phase: "review",
      sessionId: "screen-session",
      interview: IDENTITY,
      summary: {
        source: "ai",
        items: ["저장 실패 뒤에도 남아야 하는 요약"],
      },
      errorCode: "synthetic-completion-failure",
    });

    render(<AiInterviewScreen service={service} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "문진을 완료하지 못했어요. 저장된 답변은 그대로 있어요.",
    );
    expect(screen.getByText("저장 실패 뒤에도 남아야 하는 요약")).toBeVisible();
    const retry = screen.getByRole("button", { name: "문진 저장 완료" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(service.complete).toHaveBeenCalledOnce();
  });

  it("safety review에서는 승인 문구와 허용된 세 행동만 제공한다", () => {
    const service = createScreenService({
      phase: "safety-review",
      sessionId: "screen-session",
      interview: IDENTITY,
      history: HISTORY,
      reason: "breathing",
      message: PUBLIC_AI_SAFETY_MESSAGE,
      actions: ["call-119", "show-to-bystander", "view-summary"],
    });

    render(<AiInterviewScreen service={service} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(PUBLIC_AI_SAFETY_MESSAGE);
    const buttons = within(alert).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "119에 전화하기",
      "주변 사람에게 보여주기",
      "문진 내용 요약 보기",
    ]);
    expect(buttons[0]).toHaveAttribute("data-action-emphasis", "primary");
    expect(buttons[1]).toHaveAttribute("data-action-emphasis", "secondary");
    expect(buttons[2]).toHaveAttribute("data-action-emphasis", "secondary");
    fireEvent.click(buttons[2]!);
    expect(service.acknowledgeSafety).toHaveBeenCalledWith("view-summary");
  });

  it.each([
    ["completed", "문진을 저장했어요."],
    ["safety-stopped", "안전 안내를 확인했어요."],
  ] as const)("%s terminal에서는 홈 이동만 제공한다", (phase, message) => {
    const service = createScreenService({
      phase,
      sessionId: "screen-session",
      interviewId: IDENTITY.interviewId,
    });

    render(<AiInterviewScreen service={service} />);

    expect(screen.getByRole("status")).toHaveTextContent(message);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("홈으로");
    fireEvent.click(buttons[0]!);
    expect(service.navigate).toHaveBeenCalledWith("/home");
  });
});

describe("public AI route configuration", () => {
  it.each([
    [undefined, 3],
    ["", 3],
    ["0", 3],
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["4", 3],
    ["2.5", 3],
    ["not-a-number", 3],
  ])("PUBLIC_AI_MAX_FOLLOW_UPS=%s를 %i로 전달한다", (value, expected) => {
    expect(parsePublicAiMaximumFollowUps(value)).toBe(expected);
  });

  it("server page가 파싱한 값을 client screen prop으로 전달한다", () => {
    const previous = process.env.PUBLIC_AI_MAX_FOLLOW_UPS;
    process.env.PUBLIC_AI_MAX_FOLLOW_UPS = "2";
    try {
      const element = AiInterviewPage();
      expect(element.props.maximumFollowUps).toBe(2);
    } finally {
      if (previous === undefined) delete process.env.PUBLIC_AI_MAX_FOLLOW_UPS;
      else process.env.PUBLIC_AI_MAX_FOLLOW_UPS = previous;
    }
  });
});
