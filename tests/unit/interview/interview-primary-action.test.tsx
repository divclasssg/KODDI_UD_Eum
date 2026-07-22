import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createFixtureInterviewCommands } from "@/features/interview/fixture-interview-commands";
import {
  createDemoInterviewModel,
  INTERVIEW_FIXTURES,
} from "@/features/interview/fixtures/fixture-registry";
import { InterviewControllerScreen } from "@/features/interview/interview-route-screen";

afterEach(cleanup);

function renderFixture(id: keyof typeof INTERVIEW_FIXTURES) {
  return render(
    <InterviewControllerScreen
      commands={createFixtureInterviewCommands(id)}
      initialModel={INTERVIEW_FIXTURES[id].model}
    />,
  );
}

function primaryActions(container: HTMLElement) {
  return container.querySelectorAll('[data-action-emphasis="primary"]');
}

describe("문진 핵심 행동 강조", () => {
  for (const id of [
    "answering-default",
    "history-review",
    "save-error",
    "ai-error",
    "safety-caution",
    "safety-urgent",
  ] as const) {
    it(`${id}에는 primary CTA가 하나다`, () => {
      const { container } = renderFixture(id);

      expect(primaryActions(container)).toHaveLength(1);
    });
  }

  for (const id of [
    "saving-delayed",
    "waiting-for-ai",
    "summary-transition",
  ] as const) {
    it(`${id}에는 primary CTA가 없다`, () => {
      const { container } = renderFixture(id);

      expect(primaryActions(container)).toHaveLength(0);
    });
  }

  it("역할극 확인 전에도 비활성 다음만 primary CTA로 유지한다", () => {
    const { container } = render(
      <InterviewControllerScreen
        commands={createFixtureInterviewCommands("answering-default")}
        initialModel={createDemoInterviewModel("persona-kim")}
      />,
    );

    expect(primaryActions(container)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음" })).toHaveAttribute(
      "data-action-emphasis",
      "primary",
    );
  });

  it("AI 오류의 수동 전환은 secondary다", () => {
    renderFixture("ai-error");

    expect(
      screen.getByRole("button", { name: "다시 질문 받기" }),
    ).toHaveAttribute("data-action-emphasis", "primary");
    expect(
      screen.getByRole("button", { name: "수동 문진으로 계속" }),
    ).toHaveAttribute("data-action-emphasis", "secondary");
  });

  it("긴급 안내는 119만 primary이고 나머지는 secondary다", () => {
    renderFixture("safety-urgent");

    expect(screen.getByRole("button", { name: "119에 전화하기" })).toHaveAttribute(
      "data-action-emphasis",
      "primary",
    );
    expect(
      screen.getByRole("button", { name: "주변 사람에게 보여주기" }),
    ).toHaveAttribute("data-action-emphasis", "secondary");
    expect(
      screen.getByRole("button", { name: "문진 내용 요약 보기" }),
    ).toHaveAttribute("data-action-emphasis", "secondary");
  });

  it("음성 입력과 최신 질문 이동은 utility다", () => {
    renderFixture("history-review");

    expect(
      screen.getByRole("button", { name: "음성으로 답하기" }),
    ).toHaveAttribute("data-action-emphasis", "utility");
    expect(
      screen.getByRole("button", { name: "최신 질문으로 이동" }),
    ).toHaveAttribute("data-action-emphasis", "utility");
  });
});
