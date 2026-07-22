import { toUtcTimestamp } from "@/lib/db/contracts";
import type {
  CreateInterviewInputV1,
  GrantConsentInputV1,
  SaveProgressInputV1,
  SaveFinalProgressInputV1,
  SaveSummaryInputV1,
  SaveProfileBundleInputV1,
} from "@/lib/db/contracts";

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
