import type {
  InterviewMessageRecordV1,
  InterviewQuestionSnapshotV1,
  SummaryContentV1,
} from "@/lib/db/contracts";
import type {
  QuestionSetSnapshotV2,
  QuestionSnapshotV2,
} from "../domain/interview-draft";

export const MANUAL_QUESTION_SET_ID = "manual-intake-v1";

export type ManualQuestionV1 = InterviewQuestionSnapshotV1 & {
  inputMode: "text" | "choice";
};

type ManualAnswerDraft = {
  text: string;
  selectedOptionIds: string[];
};

function option(id: string, label: string) {
  return { id, label };
}

function question(
  id: string,
  slot: string,
  text: string,
  inputMode: ManualQuestionV1["inputMode"],
  options: ManualQuestionV1["options"],
): ManualQuestionV1 {
  return {
    id: `${MANUAL_QUESTION_SET_ID}:${id}`,
    slot,
    text,
    inputMode,
    selection: "single",
    options,
  };
}

export const MANUAL_QUESTIONS_V1: readonly ManualQuestionV1[] = [
  question(
    "chief-complaint",
    "chief-complaint",
    "지금 가장 불편한 점을 적어 주세요.",
    "text",
    [],
  ),
  question("onset", "onset", "언제부터 불편했나요?", "choice", [
    option("today", "오늘"),
    option("days", "며칠 전"),
    option("weeks", "몇 주 전"),
    option("unknown", "잘 모르겠어요"),
  ]),
  question("pattern", "pattern", "불편함은 어떻게 나타나나요?", "choice", [
    option("continuous", "계속 이어져요"),
    option("intermittent", "나아졌다가 다시 나타나요"),
    option("unknown", "잘 모르겠어요"),
  ]),
  question(
    "severity",
    "severity",
    "지금 느끼는 불편함은 어느 정도인가요?",
    "choice",
    [
      option("mild", "조금 불편해요"),
      option("moderate", "많이 불편해요"),
      option("severe", "매우 불편해요"),
      option("unknown", "잘 모르겠어요"),
    ],
  ),
  question(
    "additional",
    "additional",
    "의료진에게 추가로 전하고 싶은 내용이 있나요?",
    "text",
    [option("none", "추가 내용 없음")],
  ),
];

function textContract(): QuestionSnapshotV2["contracts"]["text"] {
  return { minLength: 1, maxLength: 1_000 };
}

function optionContract(questionItem: ManualQuestionV1) {
  return {
    selection: questionItem.selection,
    options: questionItem.options.map((item) => ({ ...item })),
    ...(questionItem.options.some(({ id }) => id === "unknown")
      ? { unknownOptionId: "unknown" }
      : {}),
  };
}

function toV2Question(
  questionItem: ManualQuestionV1,
  index: number,
): QuestionSnapshotV2 {
  if (index === 0) {
    return {
      contractVersion: 2,
      id: questionItem.id,
      slot: questionItem.slot,
      text: questionItem.text,
      allowedModes: ["text"],
      defaultMode: "text",
      contracts: { text: textContract() },
    };
  }
  if (index === 1 || index === 3) {
    return {
      contractVersion: 2,
      id: questionItem.id,
      slot: questionItem.slot,
      text: questionItem.text,
      allowedModes: ["chip", "text"],
      defaultMode: "chip",
      contracts: {
        text: textContract(),
        chip: {
          ...optionContract(questionItem),
          kind: index === 1 ? "duration" : "severity",
        },
      },
    };
  }
  if (index === 2) {
    return {
      contractVersion: 2,
      id: questionItem.id,
      slot: questionItem.slot,
      text: questionItem.text,
      allowedModes: ["choice", "text"],
      defaultMode: "choice",
      contracts: {
        text: textContract(),
        choice: optionContract(questionItem),
      },
    };
  }
  return {
    contractVersion: 2,
    id: questionItem.id,
    slot: questionItem.slot,
    text: questionItem.text,
    allowedModes: ["text", "choice"],
    defaultMode: "text",
    contracts: {
      text: textContract(),
      choice: optionContract(questionItem),
    },
  };
}

export const MANUAL_QUESTION_SET_V2: QuestionSetSnapshotV2 = {
  contractVersion: 2,
  id: MANUAL_QUESTION_SET_ID,
  questions: MANUAL_QUESTIONS_V1.map(toV2Question),
};

export function getManualQuestion(index: number): ManualQuestionV1 | undefined {
  return MANUAL_QUESTIONS_V1[index];
}

export function getManualQuestionById(
  id: string,
): ManualQuestionV1 | undefined {
  return MANUAL_QUESTIONS_V1.find((questionItem) => questionItem.id === id);
}

export function toQuestionSnapshot(
  questionItem: ManualQuestionV1,
): InterviewQuestionSnapshotV1 {
  return structuredClone({
    id: questionItem.id,
    slot: questionItem.slot,
    text: questionItem.text,
    selection: questionItem.selection,
    options: questionItem.options,
  });
}

export function formatManualAnswer(
  questionSnapshot: ManualQuestionV1,
  draft: ManualAnswerDraft,
): string {
  const labels = questionSnapshot.options
    .filter(({ id }) => draft.selectedOptionIds.includes(id))
    .map(({ label }) => label);
  const text = draft.text.trim();
  return [...labels, ...(text ? [text] : [])].join(", ");
}

export function createManualSummary(
  messages: InterviewMessageRecordV1[],
): SummaryContentV1 {
  const subjective = messages
    .filter((message) => message.role === "user" && message.kind === "answer")
    .map((message) => ({
      id: `manual-summary:${message.id}`,
      text: message.text,
      evidenceMessageIds: [message.id],
    }));
  return {
    subjective,
    objective: [],
    verificationNeeded: [],
  };
}
