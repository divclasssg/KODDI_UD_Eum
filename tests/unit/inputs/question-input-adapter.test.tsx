import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuestionInputAdapter } from "@/features/inputs/question-input-adapter";
import {
  createEmptyDraft,
  type QuestionSnapshotV2,
} from "@/features/interview/domain/interview-draft";
import { MANUAL_QUESTION_SET_V2 } from "@/features/interview/manual/manual-question-set";

function Harness({ question }: { question: QuestionSnapshotV2 }) {
  const [draft, setDraft] = useState(() => createEmptyDraft(question));
  return (
    <>
      <QuestionInputAdapter
        disabled={false}
        draft={draft}
        onDraftChange={setDraft}
        question={question}
      />
      <output data-testid="draft">{JSON.stringify(draft)}</output>
    </>
  );
}

const MEASUREMENT_QUESTION: QuestionSnapshotV2 = {
  contractVersion: 2,
  id: "synthetic-measurement",
  slot: "synthetic-measurement",
  text: "합성 측정값",
  allowedModes: ["measurement", "text"],
  defaultMode: "measurement",
  contracts: {
    text: { minLength: 1, maxLength: 100 },
    measurement: {
      allowUnknown: true,
      measuredAt: "required",
      units: [{ id: "celsius", label: "℃" }],
    },
  },
};

function multipleUnknownQuestion(
  mode: "choice" | "chip",
): QuestionSnapshotV2 {
  const contract = {
    selection: "multiple" as const,
    unknownOptionId: "unknown",
    options: [
      { id: "known", label: "합성 알려진 답변" },
      { id: "unknown", label: "잘 모르겠어요" },
    ],
  };
  return {
    contractVersion: 2,
    id: `synthetic-${mode}-unknown`,
    slot: `synthetic-${mode}-unknown`,
    text: "합성 복수 선택",
    allowedModes: [mode],
    defaultMode: mode,
    contracts:
      mode === "chip"
        ? { chip: { ...contract, kind: "symptom" } }
        : { choice: contract },
  };
}

describe("QuestionInputAdapter", () => {
  it("text와 chip을 왕복해도 각 draft를 보존한다", async () => {
    const user = userEvent.setup();
    render(<Harness question={MANUAL_QUESTION_SET_V2.questions[1]} />);

    await user.click(screen.getByRole("tab", { name: "직접 입력" }));
    await user.type(screen.getByLabelText("답변"), "합성 기간 메모");
    await user.click(screen.getByRole("tab", { name: "기간 선택" }));
    await user.click(screen.getByRole("radio", { name: "며칠 전" }));
    await user.click(screen.getByRole("tab", { name: "직접 입력" }));

    expect(screen.getByLabelText("답변")).toHaveValue("합성 기간 메모");
    const draft = JSON.parse(screen.getByTestId("draft").textContent ?? "{}");
    expect(draft.values.chip.selectedOptionIds).toEqual(["days"]);
  });

  it("measurement unknown 왕복과 mode 전환 뒤 값·단위·시각을 보존한다", async () => {
    const user = userEvent.setup();
    render(<Harness question={MEASUREMENT_QUESTION} />);

    await user.type(screen.getByLabelText("측정값"), "37.2");
    await user.selectOptions(screen.getByLabelText("단위"), "celsius");
    await user.type(screen.getByLabelText("측정 시각"), "2026-07-22T10:30");
    await user.click(screen.getByLabelText("잘 모르겠어요"));
    await user.click(screen.getByLabelText("잘 모르겠어요"));
    await user.click(screen.getByRole("tab", { name: "직접 입력" }));
    await user.click(screen.getByRole("tab", { name: "측정값 입력" }));

    expect(screen.getByLabelText("측정값")).toHaveValue(37.2);
    expect(screen.getByLabelText("단위")).toHaveValue("celsius");
    expect(screen.getByLabelText("측정 시각")).toHaveValue(
      "2026-07-22T10:30",
    );
  });

  it("single chip은 unknown과 다른 선택을 동시에 유지하지 않는다", async () => {
    const user = userEvent.setup();
    render(<Harness question={MANUAL_QUESTION_SET_V2.questions[3]} />);

    await user.click(screen.getByRole("radio", { name: "많이 불편해요" }));
    await user.click(screen.getByRole("radio", { name: "잘 모르겠어요" }));

    const draft = JSON.parse(screen.getByTestId("draft").textContent ?? "{}");
    expect(draft.values.chip.selectedOptionIds).toEqual(["unknown"]);
  });

  it.each(["choice", "chip"] as const)(
    "multiple %s에서 unknown과 known은 마지막 선택 기준으로 상호 배제된다",
    async (mode) => {
      const user = userEvent.setup();
      render(<Harness question={multipleUnknownQuestion(mode)} />);

      await user.click(screen.getByLabelText("합성 알려진 답변"));
      await user.click(screen.getByLabelText("잘 모르겠어요"));
      let draft = JSON.parse(
        screen.getByTestId("draft").textContent ?? "{}",
      );
      expect(draft.values[mode].selectedOptionIds).toEqual(["unknown"]);

      await user.click(screen.getByLabelText("합성 알려진 답변"));
      draft = JSON.parse(screen.getByTestId("draft").textContent ?? "{}");
      expect(draft.values[mode].selectedOptionIds).toEqual(["known"]);
    },
  );

  it("disabled 상태에서는 모든 입력과 mode 전환을 잠근다", () => {
    const question = MANUAL_QUESTION_SET_V2.questions[1];
    render(
      <QuestionInputAdapter
        disabled
        draft={createEmptyDraft(question)}
        onDraftChange={vi.fn()}
        question={question}
      />,
    );

    expect(screen.getByRole("tab", { name: "기간 선택" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "직접 입력" })).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
