import {
  INTERVIEW_SLOT_IDS,
  type DemoPersonaId,
  type InterviewQuestion,
  type InterviewSlotId,
  type InterviewSummary,
  type InterviewSummaryItem,
} from "@/features/interview/model/interview-domain.types";

import {
  AI_CONTRACT_VERSION,
  AI_MAX_RECENT_TURNS,
  AI_MAX_REQUEST_BYTES,
  type AiInterviewContextV1,
  type AiQuestionResponseV1,
  type AiSummaryResponseV1,
} from "./contracts";

export type AiContractErrorCode =
  | "invalid-shape"
  | "unknown-field"
  | "invalid-value"
  | "limit-exceeded"
  | "request-too-large"
  | "unknown-evidence-turn";

export class AiContractError extends Error {
  constructor(readonly code: AiContractErrorCode) {
    super(`AI contract validation failed: ${code}`);
    this.name = "AiContractError";
  }
}

type PlainObject = Record<string, unknown>;

const PERSONA_IDS = new Set<DemoPersonaId>([
  "persona-kim",
  "persona-lee",
  "persona-park",
]);
const SLOT_IDS = new Set<string>(INTERVIEW_SLOT_IDS);

function fail(code: AiContractErrorCode): never {
  throw new AiContractError(code);
}

function readObject(value: unknown): PlainObject {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    fail("invalid-shape");
  }
  return value as PlainObject;
}

function allowOnly(object: PlainObject, keys: readonly string[]): void {
  const allowed = new Set(keys);
  if (Object.keys(object).some((key) => !allowed.has(key))) {
    fail("unknown-field");
  }
}

function readString(value: unknown, maximum: number): string {
  if (typeof value !== "string") fail("invalid-value");
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    fail("limit-exceeded");
  }
  return normalized;
}

function readStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): string[] {
  if (!Array.isArray(value)) fail("invalid-shape");
  if (value.length > maximumItems) fail("limit-exceeded");
  return value.map((item) => readString(item, maximumLength));
}

function assertSerializedSize(value: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    fail("invalid-shape");
  }
  if (
    typeof serialized !== "string" ||
    new TextEncoder().encode(serialized).byteLength > AI_MAX_REQUEST_BYTES
  ) {
    fail("request-too-large");
  }
}

function readSlot(value: unknown): InterviewSlotId {
  if (typeof value !== "string" || !SLOT_IDS.has(value)) {
    fail("invalid-value");
  }
  return value as InterviewSlotId;
}

function readPersona(value: unknown): DemoPersonaId {
  if (typeof value !== "string" || !PERSONA_IDS.has(value as DemoPersonaId)) {
    fail("invalid-value");
  }
  return value as DemoPersonaId;
}

function readTurn(value: unknown): AiInterviewContextV1["recentTurns"][number] {
  const object = readObject(value);
  allowOnly(object, ["id", "question", "answer"]);
  return {
    id: readString(object.id, 128),
    question: readString(object.question, 1_000),
    answer: readString(object.answer, 2_000),
  };
}

function readFilledSlots(value: unknown): AiInterviewContextV1["filledSlots"] {
  const object = readObject(value);
  allowOnly(object, INTERVIEW_SLOT_IDS);
  const result: AiInterviewContextV1["filledSlots"] = {};

  for (const [key, slotValue] of Object.entries(object)) {
    result[key as InterviewSlotId] = readString(slotValue, 2_000);
  }
  return result;
}

function readOption(value: unknown): InterviewQuestion["options"][number] {
  const object = readObject(value);
  allowOnly(object, ["id", "label"]);
  return {
    id: readString(object.id, 128),
    label: readString(object.label, 120),
  };
}

function readQuestion(value: unknown): InterviewQuestion {
  const object = readObject(value);
  allowOnly(object, ["id", "slot", "text", "selection", "options"]);
  if (object.selection !== "single" && object.selection !== "multiple") {
    fail("invalid-value");
  }
  if (!Array.isArray(object.options)) fail("invalid-shape");
  if (object.options.length === 0 || object.options.length > 8) {
    fail("limit-exceeded");
  }
  return {
    id: readString(object.id, 128),
    slot: readSlot(object.slot),
    text: readString(object.text, 1_000),
    selection: object.selection,
    options: object.options.map(readOption),
  };
}

function readSummaryItem(
  value: unknown,
  evidenceTurnIds?: ReadonlySet<string>,
): InterviewSummaryItem {
  const object = readObject(value);
  allowOnly(object, ["id", "text", "evidenceTurnIds"]);
  const evidence = readStringArray(object.evidenceTurnIds, 10, 128);
  if (evidence.length === 0) fail("invalid-value");
  if (evidenceTurnIds && evidence.some((id) => !evidenceTurnIds.has(id))) {
    fail("unknown-evidence-turn");
  }
  return {
    id: readString(object.id, 128),
    text: readString(object.text, 2_000),
    evidenceTurnIds: evidence,
  };
}

function readSummarySection(
  value: unknown,
  evidenceTurnIds?: ReadonlySet<string>,
): InterviewSummaryItem[] {
  if (!Array.isArray(value)) fail("invalid-shape");
  if (value.length > 20) fail("limit-exceeded");
  return value.map((item) => readSummaryItem(item, evidenceTurnIds));
}

export function parseAiInterviewContextV1(
  value: unknown,
): AiInterviewContextV1 {
  assertSerializedSize(value);
  const object = readObject(value);
  allowOnly(object, [
    "version",
    "interviewId",
    "personaId",
    "currentSlot",
    "filledSlots",
    "recentTurns",
  ]);
  if (object.version !== AI_CONTRACT_VERSION) fail("invalid-value");
  if (!Array.isArray(object.recentTurns)) fail("invalid-shape");
  if (object.recentTurns.length > AI_MAX_RECENT_TURNS) {
    fail("limit-exceeded");
  }

  return {
    version: AI_CONTRACT_VERSION,
    interviewId: readString(object.interviewId, 128),
    personaId: readPersona(object.personaId),
    ...(object.currentSlot === undefined
      ? {}
      : { currentSlot: readSlot(object.currentSlot) }),
    filledSlots: readFilledSlots(object.filledSlots),
    recentTurns: object.recentTurns.map(readTurn),
  };
}

export function parseAiQuestionResponseV1(
  value: unknown,
): AiQuestionResponseV1 {
  const object = readObject(value);
  if (object.version !== AI_CONTRACT_VERSION) fail("invalid-value");

  if (object.kind === "complete") {
    allowOnly(object, ["version", "kind"]);
    return { version: AI_CONTRACT_VERSION, kind: "complete" };
  }
  if (object.kind !== "question") fail("invalid-value");
  allowOnly(object, ["version", "kind", "question"]);
  return {
    version: AI_CONTRACT_VERSION,
    kind: "question",
    question: readQuestion(object.question),
  };
}

export function parseAiSummaryResponseV1(
  value: unknown,
  evidenceTurnIds?: ReadonlySet<string>,
): AiSummaryResponseV1 {
  const object = readObject(value);
  allowOnly(object, ["version", "kind", "summary"]);
  if (
    object.version !== AI_CONTRACT_VERSION ||
    object.kind !== "summary"
  ) {
    fail("invalid-value");
  }

  const summaryObject = readObject(object.summary);
  allowOnly(summaryObject, [
    "subjective",
    "objective",
    "verificationNeeded",
  ]);
  const summary: InterviewSummary = {
    subjective: readSummarySection(
      summaryObject.subjective,
      evidenceTurnIds,
    ),
    objective: readSummarySection(summaryObject.objective, evidenceTurnIds),
    verificationNeeded: readSummarySection(
      summaryObject.verificationNeeded,
      evidenceTurnIds,
    ),
  };

  return { version: AI_CONTRACT_VERSION, kind: "summary", summary };
}
