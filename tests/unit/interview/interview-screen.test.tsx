import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { INTERVIEW_FIXTURES } from "@/features/interview/fixtures/fixture-registry";
import { InterviewScreen } from "@/features/interview/interview-screen";

describe("대표 문진 화면", () => {
  it("전체 기록과 현재 질문을 표시하고 명시적으로 제출한다", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();

    render(
      <InterviewScreen
        commands={{ submit }}
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
      />,
    );

    expect(screen.getByRole("log", { name: "문진 대화" })).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "증상이 시작된 지 얼마나 지났나요?",
      }),
    ).toBeVisible();
    expect(screen.getByText("두통이 있어요")).toBeVisible();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
    await user.click(screen.getByRole("button", { name: "다음" }));

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("선택과 수정한 자유 입력을 보존하고 중복 제출을 막는다", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();

    render(
      <InterviewScreen
        commands={{ submit }}
        initialModel={INTERVIEW_FIXTURES["answering-default"].model}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
    const textInput = screen.getByRole("textbox", { name: "직접 입력" });
    await user.type(textInput, "이틀 정도 됐어요");
    await user.clear(textInput);
    await user.type(textInput, "사흘 정도 된 것 같아요");

    expect(screen.getByRole("button", { name: "음성으로 답하기" })).toBeVisible();
    const nextButton = screen.getByRole("button", { name: "다음" });
    await user.dblClick(nextButton);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      selectedOptionIds: ["days"],
      text: "사흘 정도 된 것 같아요",
      inputMode: "text",
    });
    expect(nextButton).toBeDisabled();
  });
});
