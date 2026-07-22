import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManualInterviewScreen } from "@/features/interview/manual/manual-interview-screen";
import { MANUAL_QUESTIONS_V1 } from "@/features/interview/manual/manual-question-set";
import type { ManualInterviewState } from "@/features/interview/manual/manual-interview-service";
import { toUtcTimestamp } from "@/lib/db/contracts";

const SYNTHETIC_STATE: ManualInterviewState = {
  phase: "answering",
  aggregate: {
    interview: {
      id: "manual-synthetic",
      schemaVersion: 1,
      revision: 1,
      status: "draft",
      mode: "manual",
      createdAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
      updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
    },
    draft: {
      interviewId: "manual-synthetic",
      schemaVersion: 1,
      revision: 1,
      currentQuestion: MANUAL_QUESTIONS_V1[0],
      input: { mode: "text", text: "", selectedOptionIds: [] },
      updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
    },
    messages: [],
  },
  question: MANUAL_QUESTIONS_V1[0],
  answer: { text: "", selectedOptionIds: [] },
};

function createService(overrides: Record<string, unknown> = {}) {
  return {
    loadOrCreate: vi.fn().mockResolvedValue(SYNTHETIC_STATE),
    saveAnswer: vi.fn().mockResolvedValue(SYNTHETIC_STATE),
    complete: vi.fn(),
    ...overrides,
  };
}

describe("ManualInterviewScreen", () => {
  it("저장 실패 시 현재 질문과 입력을 유지한다", async () => {
    const service = createService({
      saveAnswer: vi.fn().mockRejectedValue(new Error("합성 실패")),
    });
    render(<ManualInterviewScreen service={service} navigate={vi.fn()} />);

    const answer = await screen.findByLabelText("답변");
    fireEvent.change(answer, { target: { value: "합성 불편함" } });
    fireEvent.click(screen.getByRole("button", { name: "답변 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "저장하지 못했어요",
    );
    expect(answer).toHaveValue("합성 불편함");
  });

  it("저장 중 빠른 중복 제출을 한 번만 처리한다", async () => {
    let resolveSave: ((state: ManualInterviewState) => void) | undefined;
    const savePromise = new Promise<ManualInterviewState>((resolve) => {
      resolveSave = resolve;
    });
    const service = createService({
      saveAnswer: vi.fn().mockReturnValue(savePromise),
    });
    render(<ManualInterviewScreen service={service} navigate={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("답변"), {
      target: { value: "합성 불편함" },
    });
    const submit = screen.getByRole("button", { name: "답변 저장" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(service.saveAnswer).toHaveBeenCalledOnce();
    resolveSave?.(SYNTHETIC_STATE);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("Persona와 fixture, 질문 번호, 고정 진행률을 표시하지 않는다", async () => {
    render(
      <ManualInterviewScreen service={createService()} navigate={vi.fn()} />,
    );

    await screen.findByRole("heading", { name: FIRST_QUESTION_TEXT });
    expect(document.body).not.toHaveTextContent(/persona|페르소나|fixture/i);
    expect(document.body).not.toHaveTextContent(/1\/5|20%/);
  });
});

const FIRST_QUESTION_TEXT = "지금 가장 불편한 점을 적어 주세요.";
