import { toUtcTimestamp } from "@/lib/db/contracts";
import { createEmptyDraft } from "@/features/interview/domain/interview-draft";
import {
  MANUAL_QUESTIONS_V1,
  MANUAL_QUESTION_SET_V2,
} from "@/features/interview/manual/manual-question-set";
import type {
  CreateInterviewInputV2,
  CreateInterviewInputV1,
  GrantConsentInputV1,
  SaveProgressInputV1,
  SaveFinalProgressInputV1,
  SaveSummaryInputV1,
  SaveProfileBundleInputV1,
  SaveSafetyReviewInputV1,
} from "@/lib/db/contracts";
import type { QuestionSnapshotV2 } from "@/features/interview/domain/interview-draft";

export const SYNTHETIC_DECIDED_AT = toUtcTimestamp(
  "2026-07-22T01:00:00.000Z",
);

export const SYNTHETIC_DECLINED_AI_CONSENT_INPUT: GrantConsentInputV1 = {
  localStorage: {
    noticeVersion: "local-storage-v1",
    decidedAt: SYNTHETIC_DECIDED_AT,
  },
  sensitiveHealth: {
    noticeVersion: "sensitive-health-v1",
    decidedAt: SYNTHETIC_DECIDED_AT,
  },
  aiTransfer: {
    state: "declined",
    noticeVersion: "ai-transfer-v1",
    decidedAt: SYNTHETIC_DECIDED_AT,
  },
  updatedAt: SYNTHETIC_DECIDED_AT,
};

export const SYNTHETIC_PROFILE_BUNDLE_INPUT: SaveProfileBundleInputV1 = {
  profile: {
    displayName: "김테스트",
    birthDate: "1958-05-20",
    sex: "male",
    updatedAt: SYNTHETIC_DECIDED_AT,
  },
  medicalProfile: {
    conditions: { state: "known", values: ["합성 만성질환"] },
    medications: { state: "unknown" },
    allergies: { state: "known", values: [] },
    familyHistory: { state: "unknown" },
    medicalHistory: { state: "unknown" },
    surgicalHistory: { state: "unknown" },
    smoking: { state: "no" },
    alcohol: { state: "unknown" },
    heightCm: 170,
    weightKg: 65,
    updatedAt: SYNTHETIC_DECIDED_AT,
  },
};

export const SYNTHETIC_INTERVIEW_INPUT: CreateInterviewInputV1 = {
  id: "interview-synthetic-001",
  mode: "manual",
  createdAt: SYNTHETIC_DECIDED_AT,
  draft: {
    currentQuestion: {
      id: "question-synthetic-001",
      slot: "chief-complaint",
      text: "어디가 불편한지 합성 답변으로 알려 주세요.",
      selection: "single",
      options: [],
    },
    input: {
      mode: "text",
      text: "",
      selectedOptionIds: [],
    },
    updatedAt: SYNTHETIC_DECIDED_AT,
  },
};

export const SYNTHETIC_INTERVIEW_V2_INPUT: CreateInterviewInputV2 = {
  id: "interview-synthetic-v2-001",
  mode: "manual",
  createdAt: SYNTHETIC_DECIDED_AT,
  questionSetSnapshot: structuredClone(MANUAL_QUESTION_SET_V2),
  draft: {
    currentQuestion: structuredClone(MANUAL_QUESTIONS_V1[0]),
    input: {
      mode: "text",
      text: "",
      selectedOptionIds: [],
      commonDraft: createEmptyDraft(MANUAL_QUESTION_SET_V2.questions[0]),
    },
    updatedAt: SYNTHETIC_DECIDED_AT,
  },
};

const SYNTHETIC_AI_FIRST_QUESTION: QuestionSnapshotV2 = {
  contractVersion: 2,
  id: "ai-question-001",
  slot: "chief-complaint",
  text: "어디가 불편한지 합성 답변으로 알려 주세요.",
  allowedModes: ["text"],
  defaultMode: "text",
  contracts: { text: { minLength: 1, maxLength: 1_000 } },
};

export const SYNTHETIC_AI_INTERVIEW_V2_INPUT: CreateInterviewInputV2 = {
  id: "interview-synthetic-ai-v2-001",
  mode: "ai",
  createdAt: SYNTHETIC_DECIDED_AT,
  questionSetSnapshot: {
    contractVersion: 2,
    id: "public-ai-intake-v2",
    questions: [structuredClone(SYNTHETIC_AI_FIRST_QUESTION)],
  },
  draft: {
    currentQuestion: {
      id: SYNTHETIC_AI_FIRST_QUESTION.id,
      slot: SYNTHETIC_AI_FIRST_QUESTION.slot,
      text: SYNTHETIC_AI_FIRST_QUESTION.text,
      selection: "single",
      options: [],
    },
    input: {
      mode: "text",
      text: "",
      selectedOptionIds: [],
      commonDraft: createEmptyDraft(SYNTHETIC_AI_FIRST_QUESTION),
    },
    updatedAt: SYNTHETIC_DECIDED_AT,
  },
};

export const SYNTHETIC_GENERATED_QUESTION_V2: QuestionSnapshotV2 = {
  contractVersion: 2,
  id: "ai-question-002",
  slot: "duration",
  text: "불편함은 언제부터 이어졌나요?",
  allowedModes: ["choice", "text"],
  defaultMode: "choice",
  contracts: {
    text: { minLength: 1, maxLength: 1_000 },
    choice: {
      selection: "single",
      options: [
        { id: "today", label: "오늘부터" },
        { id: "unknown", label: "잘 모르겠어요" },
      ],
      unknownOptionId: "unknown",
    },
  },
};

export const SYNTHETIC_DEFAULT_TEXT_SWITCH_QUESTION_V2: QuestionSnapshotV2 = {
  contractVersion: 2,
  id: "ai-question-switch-001",
  slot: "severity",
  text: "불편함의 정도를 알려 주세요.",
  allowedModes: ["text", "chip"],
  defaultMode: "text",
  contracts: {
    text: { minLength: 1, maxLength: 1_000 },
    chip: {
      kind: "severity",
      selection: "single",
      options: [
        { id: "mild", label: "가벼워요" },
        { id: "severe", label: "심해요" },
      ],
    },
  },
};

export const SYNTHETIC_SAFETY_REVIEW_INPUT: SaveSafetyReviewInputV1 = {
  appendedMessages: [
    {
      id: "message-safety-question-001",
      sequence: 0,
      role: "assistant",
      kind: "question",
      text: SYNTHETIC_AI_FIRST_QUESTION.text,
      createdAt: SYNTHETIC_DECIDED_AT,
    },
    {
      id: "message-safety-answer-001",
      sequence: 1,
      role: "user",
      kind: "answer",
      text: "지금 숨쉬기가 매우 힘들어요.",
      createdAt: toUtcTimestamp("2026-07-22T01:00:30.000Z"),
    },
    {
      id: "message-safety-notice-001",
      sequence: 2,
      role: "system",
      kind: "safety",
      text: "지금은 문진보다 안전이 먼저예요. 즉시 119나 주변 사람에게 도움을 요청해 주세요.",
      createdAt: toUtcTimestamp("2026-07-22T01:00:31.000Z"),
    },
  ],
  updatedAt: toUtcTimestamp("2026-07-22T01:00:31.000Z"),
};

export const SYNTHETIC_PROGRESS_INPUT: SaveProgressInputV1 = {
  draft: {
    currentQuestion: {
      id: "question-synthetic-002",
      slot: "duration",
      text: "불편함이 얼마나 이어졌나요?",
      selection: "single",
      options: [
        { id: "today", label: "오늘부터" },
        { id: "unknown", label: "잘 모르겠어요" },
      ],
    },
    input: {
      mode: "choice",
      text: "",
      selectedOptionIds: ["unknown"],
    },
    updatedAt: toUtcTimestamp("2026-07-22T01:01:00.000Z"),
  },
  appendedMessages: [
    {
      id: "message-synthetic-001",
      sequence: 0,
      role: "assistant",
      kind: "question",
      text: "어디가 불편한지 합성 답변으로 알려 주세요.",
      createdAt: SYNTHETIC_DECIDED_AT,
    },
    {
      id: "message-synthetic-002",
      sequence: 1,
      role: "user",
      kind: "answer",
      text: "합성 두통 답변",
      createdAt: toUtcTimestamp("2026-07-22T01:00:30.000Z"),
    },
  ],
};

export const SYNTHETIC_SUMMARY_INPUT: SaveSummaryInputV1 = {
  source: "manual",
  content: {
    subjective: [
      {
        id: "summary-item-synthetic-001",
        text: "합성 두통 답변",
        evidenceMessageIds: ["message-synthetic-002"],
      },
    ],
    objective: [],
    verificationNeeded: [],
  },
  createdAt: toUtcTimestamp("2026-07-22T01:02:00.000Z"),
  updatedAt: toUtcTimestamp("2026-07-22T01:02:00.000Z"),
};

export const SYNTHETIC_FINAL_PROGRESS_INPUT: SaveFinalProgressInputV1 = {
  draft: {
    ...SYNTHETIC_INTERVIEW_INPUT.draft,
    input: {
      mode: "text",
      text: "",
      selectedOptionIds: [],
    },
    updatedAt: toUtcTimestamp("2026-07-22T01:02:00.000Z"),
  },
  appendedMessages: SYNTHETIC_PROGRESS_INPUT.appendedMessages,
  summary: SYNTHETIC_SUMMARY_INPUT,
};
