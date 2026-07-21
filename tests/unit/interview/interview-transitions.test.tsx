import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFixtureInterviewCommands } from "@/features/interview/fixture-interview-commands";
import {
  createDemoInterviewModel,
  INTERVIEW_FIXTURES,
} from "@/features/interview/fixtures/fixture-registry";
import {
  InterviewControllerScreen,
  InterviewRouteScreen,
} from "@/features/interview/interview-route-screen";
import type { InterviewCommandsPort } from "@/features/interview/interview-commands";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("문진 상태 전환", () => {
  it("fixture mode에서는 제출 뒤에도 네트워크를 호출하지 않는다", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <InterviewRouteScreen
        fixtureId="answering-default"
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
        mode="fixture"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("demo mode에서는 역할극 확인과 저장이 끝난 뒤 question을 한 번 호출한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        version: "1",
        kind: "question",
        question: {
          id: "question-onset",
          slot: "onset",
          text: "증상은 언제 시작되었나요?",
          selection: "single",
          options: [{ id: "today", label: "오늘" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <InterviewRouteScreen
        initialModel={createDemoInterviewModel("persona-kim")}
        mode="demo"
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "가상 인물로 체험하며 실제 정보를 입력하지 않겠습니다",
      }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "두통" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/question",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("역할극 확인 전에는 입력과 actual 요청을 잠근다", async () => {
    const requestNext = vi.fn<InterviewCommandsPort["requestNext"]>();
    const commands: InterviewCommandsPort = {
      dispose: vi.fn(),
      recordSafetyAction: vi.fn(),
      requestNext,
      requestSummary: vi.fn(),
      saveAnswer: vi.fn(async ({ draft, question }) => ({
        id: "turn-confirmed",
        question: question.text,
        answer: draft.text,
      })),
    };
    const model = {
      ...INTERVIEW_FIXTURES["answering-default"].model,
      roleplayConfirmed: false,
    };

    render(
      <InterviewControllerScreen commands={commands} initialModel={model} />,
    );

    expect(screen.getByRole("radio", { name: "며칠에 걸침" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    expect(requestNext).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "가상 인물로 체험하며 실제 정보를 입력하지 않겠습니다",
      }),
    );

    expect(screen.getByRole("radio", { name: "며칠에 걸침" })).toBeEnabled();
  });

  it("저장 1회가 끝난 뒤에만 AI를 호출한다", async () => {
    vi.useFakeTimers();
    const commands = createFixtureInterviewCommands("answering-default");

    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(commands.calls.save).toBe(1);
    expect(commands.calls.ai).toBe(0);
    expect(screen.queryByText("답변을 저장하고 있어요")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByRole("status")).toHaveTextContent("답변을 저장하고 있어요");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(commands.calls.ai).toBe(1);
    expect(screen.getByRole("status")).toHaveTextContent("다음 질문을 준비하고 있어요");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(
      screen.getByRole("heading", { name: "증상은 계속 이어지나요?" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it.each([
    ["answering-default", "증상이 시작된 지 얼마나 지났나요?", undefined],
    ["history-review", "증상이 시작된 지 얼마나 지났나요?", undefined],
    ["saving-delayed", "답변을 저장하고 있어요", "status"],
    ["waiting-for-ai", "다음 질문을 준비하고 있어요", "status"],
    ["save-error", "답변을 저장하지 못했어요", "alert"],
    ["ai-error", "다음 질문을 불러오지 못했어요", "alert"],
    ["safety-caution", "주의가 필요한 답변이 있어요", "status"],
    ["safety-urgent", "위험 신호가 있어요", "alert"],
    ["summary-transition", "문진 내용을 정리하고 있어요", "status"],
  ] as const)("%s 직접 상태의 화면 계약을 지킨다", (fixtureId, title, role) => {
    const fixture = INTERVIEW_FIXTURES[fixtureId];
    const commands = createFixtureInterviewCommands(fixtureId);
    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={fixture.model}
      />,
    );

    if (role) {
      const notice = screen.getByRole(role);
      expect(notice).toHaveTextContent(title);
      expect(notice).toHaveAttribute("aria-live", fixture.expected.live);
      if (fixture.expected.busy) {
        expect(notice).toHaveAttribute("aria-busy", "true");
      }
    } else {
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    }

    const radios = screen.queryAllByRole("radio");
    if (radios.length > 0) {
      for (const radio of radios) {
        if (fixture.expected.inputLocked) expect(radio).toBeDisabled();
        else expect(radio).toBeEnabled();
      }
    }

    const actionLabels = {
      submit: "다음",
      "jump-to-latest": "최신 질문으로 이동",
      "retry-save": "다시 저장하기",
      "retry-ai": "다시 질문 받기",
      "continue-manually": "수동 문진으로 계속",
      "continue-interview": "문진 계속하기",
      "call-119": "119에 전화하기",
      "show-to-bystander": "주변 사람에게 보여주기",
      "view-summary": "문진 내용 요약 보기",
    } as const;

    for (const action of fixture.expected.actions) {
      expect(
        screen.getByRole("button", { name: actionLabels[action] }),
      ).toBeInTheDocument();
    }
  });

  it("저장 오류 재시도에서 기존 초안을 유지하고 저장부터 다시 시작한다", async () => {
    vi.useFakeTimers();
    const commands = createFixtureInterviewCommands("save-error");
    const saveAnswer = vi.spyOn(commands, "saveAnswer");

    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["save-error"].model}
      />,
    );

    expect(screen.getByRole("radio", { name: "며칠에 걸침" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "다시 저장하기" }));

    expect(saveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ selectedOptionIds: ["days"] }),
      }),
    );
    expect(commands.calls.save).toBe(1);
    expect(commands.calls.ai).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(commands.calls.ai).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(
      screen.getByRole("heading", { name: "증상은 계속 이어지나요?" }),
    ).toBeVisible();
  });

  it("AI 오류 재시도에서는 저장하지 않고 질문 생성만 다시 호출한다", async () => {
    vi.useFakeTimers();
    const commands = createFixtureInterviewCommands("ai-error");

    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["ai-error"].model}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 질문 받기" }));

    expect(commands.calls.save).toBe(0);
    expect(commands.calls.ai).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(
      screen.getByRole("heading", { name: "증상은 계속 이어지나요?" }),
    ).toBeVisible();
  });

  it("긴급 도움 행동 후에는 문진 입력을 복구하지 않는다", () => {
    const commands = createFixtureInterviewCommands("safety-urgent");

    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["safety-urgent"].model}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "119에 전화하기" }));

    expect(commands.calls.safety).toBe(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "도움을 요청하는 행동을 확인했어요",
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다음" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "119에 전화하기" }),
    ).not.toBeInTheDocument();
  });

  it("저장 완료 뒤 질문 생성이 실패해도 history를 보존하고 수동 문진으로 전환한다", async () => {
    const commands: InterviewCommandsPort = {
      dispose: vi.fn(),
      recordSafetyAction: vi.fn(),
      requestNext: vi.fn().mockRejectedValue(new Error("provider raw error")),
      requestSummary: vi.fn(),
      saveAnswer: vi.fn(async ({ draft, question }) => ({
        id: "turn-new",
        question: question.text,
        answer: draft.selectedOptionIds.includes("days") ? "며칠에 걸침" : "",
      })),
    };

    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장한 답변은 남아 있어요",
    );
    expect(screen.queryByText("provider raw error")).not.toBeInTheDocument();
    expect(screen.getByText("며칠에 걸침")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "수동 문진으로 계속" }));

    expect(
      screen.getByRole("heading", { name: "증상이 지금도 계속되고 있나요?" }),
    ).toBeVisible();
    expect(screen.getByText("며칠에 걸침")).toBeVisible();
  });

  it("complete 뒤 요약을 한 번 요청하고 provider 실패 시 같은 history의 결정론적 요약을 표시한다", async () => {
    const requestSummary = vi
      .fn<InterviewCommandsPort["requestSummary"]>()
      .mockRejectedValue(new Error("provider raw error"));
    const commands: InterviewCommandsPort = {
      dispose: vi.fn(),
      recordSafetyAction: vi.fn(),
      requestNext: vi.fn().mockResolvedValue({ kind: "complete" }),
      requestSummary,
      saveAnswer: vi.fn(async ({ question }) => ({
        id: "turn-summary",
        question: question.text,
        answer: "며칠에 걸침",
      })),
    };

    render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => expect(requestSummary).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "주관적 정보" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "객관적 정보" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "확인이 필요한 정보" }),
    ).toBeVisible();
    expect(screen.getAllByText("며칠에 걸침")).toHaveLength(2);
    expect(screen.queryByText("provider raw error")).not.toBeInTheDocument();
  });

  it("화면이 사라질 때 진행 중 요청을 폐기한다", () => {
    const dispose = vi.fn();
    const commands: InterviewCommandsPort = {
      dispose,
      recordSafetyAction: vi.fn(),
      requestNext: vi.fn(),
      requestSummary: vi.fn(),
      saveAnswer: vi.fn(),
    };
    const rendered = render(
      <InterviewControllerScreen
        commands={commands}
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
      />,
    );

    rendered.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
