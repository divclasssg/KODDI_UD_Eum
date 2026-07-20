import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFixtureInterviewCommands } from "@/features/interview/fixture-interview-commands";
import { INTERVIEW_FIXTURES } from "@/features/interview/fixtures/fixture-registry";
import { InterviewControllerScreen } from "@/features/interview/interview-route-screen";

afterEach(() => {
  vi.useRealTimers();
});

describe("문진 상태 전환", () => {
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
});
