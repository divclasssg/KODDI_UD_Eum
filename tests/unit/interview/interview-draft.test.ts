import { describe, expect, it } from "vitest";

import {
  createEmptyDraft,
  switchInputMode,
  updateMeasurementState,
  validateDraft,
  type QuestionSnapshotV2,
} from "@/features/interview/domain/interview-draft";

const SWITCHING_QUESTION: QuestionSnapshotV2 = {
  contractVersion: 2,
  id: "synthetic-duration",
  slot: "duration",
  text: "합성 기간 질문",
  allowedModes: ["text", "chip"],
  defaultMode: "text",
  contracts: {
    text: { maxLength: 200, minLength: 1 },
    chip: {
      kind: "duration",
      selection: "single",
      options: [
        { id: "duration-days", label: "며칠 전" },
        { id: "unknown", label: "잘 모르겠어요" },
      ],
      unknownOptionId: "unknown",
    },
  },
};

const MEASUREMENT_QUESTION: QuestionSnapshotV2 = {
  contractVersion: 2,
  id: "synthetic-temperature",
  slot: "synthetic-measurement",
  text: "합성 측정값 질문",
  allowedModes: ["measurement"],
  defaultMode: "measurement",
  contracts: {
    measurement: {
      allowUnknown: true,
      measuredAt: "required",
      units: [{ id: "celsius", label: "℃" }],
    },
  },
};

describe("interview common draft", () => {
  it("mode 전환은 다른 mode의 draft를 지우지 않는다", () => {
    const empty = createEmptyDraft(SWITCHING_QUESTION);
    const draft = {
      ...empty,
      values: {
        ...empty.values,
        text: { value: "합성 두통" },
        chip: { selectedOptionIds: ["duration-days"] },
      },
    };

    const chip = switchInputMode(draft, "chip");
    const text = switchInputMode(chip, "text");

    expect(text).toEqual(draft);
    expect(chip.values.text.value).toBe("합성 두통");
    expect(chip.values.chip.selectedOptionIds).toEqual(["duration-days"]);
  });

  it("허용되지 않은 mode로 전환하지 않는다", () => {
    const draft = createEmptyDraft(SWITCHING_QUESTION);

    expect(() => switchInputMode(draft, "measurement")).toThrow(
      "input-mode-not-allowed",
    );
  });

  it("measurement unknown 전환 뒤에도 known 입력을 복구한다", () => {
    const empty = createEmptyDraft(MEASUREMENT_QUESTION);
    const known = {
      ...empty,
      values: {
        ...empty.values,
        measurement: {
          state: "known" as const,
          rawValue: "37.2",
          unitId: "celsius",
          measuredAtLocal: "2026-07-22T10:30",
        },
      },
    };

    const unknown = updateMeasurementState(known, "unknown");
    const restored = updateMeasurementState(unknown, "known");

    expect(restored.values.measurement).toEqual(known.values.measurement);
  });

  it("유효한 measurement를 canonical answer로 변환한다", () => {
    const empty = createEmptyDraft(MEASUREMENT_QUESTION);
    const draft = {
      ...empty,
      values: {
        ...empty.values,
        measurement: {
          state: "known" as const,
          rawValue: "37.2",
          unitId: "celsius",
          measuredAtLocal: "2026-07-22T10:30",
        },
      },
    };
    const expectedUtc = new Date("2026-07-22T10:30:00").toISOString();

    expect(validateDraft(MEASUREMENT_QUESTION, draft)).toEqual({
      status: "valid",
      answer: {
        mode: "measurement",
        value: {
          state: "known",
          value: 37.2,
          unitId: "celsius",
          measuredAt: expectedUtc,
        },
      },
    });
  });

  it("쉼표 decimal과 허용되지 않은 단위를 거부한다", () => {
    const empty = createEmptyDraft(MEASUREMENT_QUESTION);
    const invalidNumber = {
      ...empty,
      values: {
        ...empty.values,
        measurement: {
          state: "known" as const,
          rawValue: "37,2",
          unitId: "celsius",
          measuredAtLocal: "2026-07-22T10:30",
        },
      },
    };
    const invalidUnit = {
      ...invalidNumber,
      values: {
        ...invalidNumber.values,
        measurement: {
          ...invalidNumber.values.measurement,
          rawValue: "37.2",
          unitId: "fahrenheit",
        },
      },
    };

    expect(validateDraft(MEASUREMENT_QUESTION, invalidNumber)).toMatchObject({
      status: "invalid",
      issues: [{ code: "invalid-number", path: "measurement.value" }],
    });
    expect(validateDraft(MEASUREMENT_QUESTION, invalidUnit)).toMatchObject({
      status: "invalid",
      issues: [{ code: "option-not-allowed", path: "measurement.unit" }],
    });
  });

  it("measurement unknown을 명시적인 유효 답변으로 만든다", () => {
    const draft = updateMeasurementState(
      createEmptyDraft(MEASUREMENT_QUESTION),
      "unknown",
    );

    expect(validateDraft(MEASUREMENT_QUESTION, draft)).toEqual({
      status: "valid",
      answer: { mode: "measurement", value: { state: "unknown" } },
    });
  });

  it("single chip에서 unknown과 다른 항목을 함께 선택하지 못한다", () => {
    const empty = createEmptyDraft(SWITCHING_QUESTION);
    const draft = {
      ...switchInputMode(empty, "chip"),
      values: {
        ...empty.values,
        chip: { selectedOptionIds: ["duration-days", "unknown"] },
      },
    };

    expect(validateDraft(SWITCHING_QUESTION, draft)).toMatchObject({
      status: "invalid",
      issues: [{ code: "selection-conflict", path: "chip" }],
    });
  });
});
