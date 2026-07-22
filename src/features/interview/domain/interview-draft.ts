export type InputModeV2 = "text" | "choice" | "chip" | "measurement";

export type InputOptionV2 = { id: string; label: string };

export type TextInputContractV2 = {
  minLength: number;
  maxLength: number;
};

export type OptionInputContractV2 = {
  selection: "single" | "multiple";
  options: InputOptionV2[];
  unknownOptionId?: string;
};

export type ChipInputContractV2 = OptionInputContractV2 & {
  kind: "symptom" | "duration" | "severity";
};

export type MeasurementInputContractV2 = {
  allowUnknown: boolean;
  measuredAt: "required" | "optional" | "hidden";
  units: InputOptionV2[];
  min?: number;
  max?: number;
};

export type QuestionSnapshotV2 = {
  contractVersion: 2;
  id: string;
  slot: string;
  text: string;
  allowedModes: InputModeV2[];
  defaultMode: InputModeV2;
  contracts: {
    text?: TextInputContractV2;
    choice?: OptionInputContractV2;
    chip?: ChipInputContractV2;
    measurement?: MeasurementInputContractV2;
  };
};

export type QuestionSetSnapshotV2 = {
  contractVersion: 2;
  id: string;
  questions: QuestionSnapshotV2[];
};

export type CommonDraftV2 = {
  contractVersion: 2;
  questionId: string;
  allowedModes: InputModeV2[];
  activeMode: InputModeV2;
  values: {
    text: { value: string };
    choice: { selectedOptionIds: string[] };
    chip: { selectedOptionIds: string[] };
    measurement: {
      state: "empty" | "known" | "unknown";
      rawValue: string;
      unitId: string;
      measuredAtLocal: string;
    };
  };
};

export type ValidationIssueCode =
  | "required"
  | "unknown-not-allowed"
  | "option-not-allowed"
  | "selection-conflict"
  | "invalid-number"
  | "out-of-range"
  | "unit-required"
  | "measured-at-required"
  | "invalid-measured-at";

export type ValidationIssue = {
  code: ValidationIssueCode;
  path:
    | "text"
    | "choice"
    | "chip"
    | "measurement.value"
    | "measurement.unit"
    | "measurement.measuredAt";
};

export type ValidatedAnswerV2 =
  | { mode: "text"; value: string }
  | { mode: "choice"; value: { selectedOptionIds: string[] } }
  | { mode: "chip"; value: { selectedOptionIds: string[] } }
  | {
      mode: "measurement";
      value:
        | { state: "unknown" }
        | {
            state: "known";
            value: number;
            unitId: string;
            measuredAt: string | null;
          };
    };

export type DraftValidationResult =
  | { status: "valid"; answer: ValidatedAnswerV2 }
  | { status: "incomplete"; issues: ValidationIssue[] }
  | { status: "invalid"; issues: ValidationIssue[] };

export function createEmptyDraft(question: QuestionSnapshotV2): CommonDraftV2 {
  if (!question.allowedModes.includes(question.defaultMode)) {
    throw new Error("default-input-mode-not-allowed");
  }
  return {
    contractVersion: 2,
    questionId: question.id,
    allowedModes: [...question.allowedModes],
    activeMode: question.defaultMode,
    values: {
      text: { value: "" },
      choice: { selectedOptionIds: [] },
      chip: { selectedOptionIds: [] },
      measurement: {
        state: "empty",
        rawValue: "",
        unitId: "",
        measuredAtLocal: "",
      },
    },
  };
}

export function switchInputMode(
  draft: CommonDraftV2,
  mode: InputModeV2,
  allowedModes?: readonly InputModeV2[],
): CommonDraftV2 {
  const modes = allowedModes ?? inferAllowedModes(draft);
  if (!modes.includes(mode)) throw new Error("input-mode-not-allowed");
  return { ...structuredClone(draft), activeMode: mode };
}

function inferAllowedModes(draft: CommonDraftV2): InputModeV2[] {
  return draft.allowedModes;
}

export function switchQuestionInputMode(
  question: QuestionSnapshotV2,
  draft: CommonDraftV2,
  mode: InputModeV2,
): CommonDraftV2 {
  return switchInputMode(draft, mode, question.allowedModes);
}

export function updateMeasurementState(
  draft: CommonDraftV2,
  state: CommonDraftV2["values"]["measurement"]["state"],
): CommonDraftV2 {
  return {
    ...structuredClone(draft),
    values: {
      ...structuredClone(draft.values),
      measurement: { ...draft.values.measurement, state },
    },
  };
}

function validateOptions(
  selectedOptionIds: string[],
  contract: OptionInputContractV2,
  path: "choice" | "chip",
): DraftValidationResult {
  if (selectedOptionIds.length === 0) {
    return { status: "incomplete", issues: [{ code: "required", path }] };
  }
  const allowed = new Set(contract.options.map(({ id }) => id));
  if (selectedOptionIds.some((id) => !allowed.has(id))) {
    return {
      status: "invalid",
      issues: [{ code: "option-not-allowed", path }],
    };
  }
  const unique = [...new Set(selectedOptionIds)];
  if (
    (contract.selection === "single" && unique.length > 1) ||
    (contract.unknownOptionId &&
      unique.includes(contract.unknownOptionId) &&
      unique.length > 1)
  ) {
    return {
      status: "invalid",
      issues: [{ code: "selection-conflict", path }],
    };
  }
  return {
    status: "valid",
    answer: { mode: path, value: { selectedOptionIds: unique } },
  };
}

function isLocalDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}:00`).getTime());
}

function validateMeasurement(
  draft: CommonDraftV2,
  contract: MeasurementInputContractV2,
): DraftValidationResult {
  const measurement = draft.values.measurement;
  if (measurement.state === "empty") {
    return {
      status: "incomplete",
      issues: [{ code: "required", path: "measurement.value" }],
    };
  }
  if (measurement.state === "unknown") {
    return contract.allowUnknown
      ? {
          status: "valid",
          answer: { mode: "measurement", value: { state: "unknown" } },
        }
      : {
          status: "invalid",
          issues: [
            { code: "unknown-not-allowed", path: "measurement.value" },
          ],
        };
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(measurement.rawValue)) {
    return {
      status: "invalid",
      issues: [{ code: "invalid-number", path: "measurement.value" }],
    };
  }
  const value = Number(measurement.rawValue);
  if (!Number.isFinite(value)) {
    return {
      status: "invalid",
      issues: [{ code: "invalid-number", path: "measurement.value" }],
    };
  }
  if (
    (contract.min !== undefined && value < contract.min) ||
    (contract.max !== undefined && value > contract.max)
  ) {
    return {
      status: "invalid",
      issues: [{ code: "out-of-range", path: "measurement.value" }],
    };
  }
  if (!measurement.unitId) {
    return {
      status: "incomplete",
      issues: [{ code: "unit-required", path: "measurement.unit" }],
    };
  }
  if (!contract.units.some(({ id }) => id === measurement.unitId)) {
    return {
      status: "invalid",
      issues: [{ code: "option-not-allowed", path: "measurement.unit" }],
    };
  }
  if (contract.measuredAt === "required" && !measurement.measuredAtLocal) {
    return {
      status: "incomplete",
      issues: [
        { code: "measured-at-required", path: "measurement.measuredAt" },
      ],
    };
  }
  if (
    measurement.measuredAtLocal &&
    !isLocalDateTime(measurement.measuredAtLocal)
  ) {
    return {
      status: "invalid",
      issues: [
        { code: "invalid-measured-at", path: "measurement.measuredAt" },
      ],
    };
  }
  return {
    status: "valid",
    answer: {
      mode: "measurement",
      value: {
        state: "known",
        value,
        unitId: measurement.unitId,
        measuredAt: measurement.measuredAtLocal
          ? new Date(`${measurement.measuredAtLocal}:00`).toISOString()
          : null,
      },
    },
  };
}

export function validateDraft(
  question: QuestionSnapshotV2,
  draft: CommonDraftV2,
): DraftValidationResult {
  if (question.id !== draft.questionId) {
    return {
      status: "invalid",
      issues: [{ code: "option-not-allowed", path: "text" }],
    };
  }
  if (!question.allowedModes.includes(draft.activeMode)) {
    return {
      status: "invalid",
      issues: [{ code: "option-not-allowed", path: "text" }],
    };
  }
  if (draft.activeMode === "text") {
    const contract = question.contracts.text;
    if (!contract) {
      return {
        status: "invalid",
        issues: [{ code: "option-not-allowed", path: "text" }],
      };
    }
    const value = draft.values.text.value.trim();
    if (value.length < contract.minLength) {
      return { status: "incomplete", issues: [{ code: "required", path: "text" }] };
    }
    if (value.length > contract.maxLength) {
      return { status: "invalid", issues: [{ code: "out-of-range", path: "text" }] };
    }
    return { status: "valid", answer: { mode: "text", value } };
  }
  if (draft.activeMode === "choice") {
    const contract = question.contracts.choice;
    return contract
      ? validateOptions(draft.values.choice.selectedOptionIds, contract, "choice")
      : {
          status: "invalid",
          issues: [{ code: "option-not-allowed", path: "choice" }],
        };
  }
  if (draft.activeMode === "chip") {
    const contract = question.contracts.chip;
    return contract
      ? validateOptions(draft.values.chip.selectedOptionIds, contract, "chip")
      : {
          status: "invalid",
          issues: [{ code: "option-not-allowed", path: "chip" }],
        };
  }
  const contract = question.contracts.measurement;
  return contract
    ? validateMeasurement(draft, contract)
    : {
        status: "invalid",
        issues: [{ code: "option-not-allowed", path: "measurement.value" }],
      };
}
