import { InvalidUtcTimestampError } from "./errors";

export type UtcTimestamp = string & {
  readonly __utcTimestamp: unique symbol;
};

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function toUtcTimestamp(value: string): UtcTimestamp {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    throw new InvalidUtcTimestampError();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new InvalidUtcTimestampError();
  }
  return value as UtcTimestamp;
}

export type ConsentDecisionV1 = {
  localStorage: "granted" | "declined";
  sensitiveHealth: "granted" | "declined";
  aiTransfer: "granted" | "declined";
};

export type ConsentRecordV1 = {
  id: "current";
  schemaVersion: 1;
  localStorage: {
    state: "granted";
    noticeVersion: string;
    decidedAt: UtcTimestamp;
  };
  sensitiveHealth: {
    state: "granted";
    noticeVersion: string;
    decidedAt: UtcTimestamp;
  };
  aiTransfer: {
    state: "granted" | "declined";
    noticeVersion: string;
    decidedAt: UtcTimestamp;
  };
  updatedAt: UtcTimestamp;
};

export type GrantConsentInputV1 = {
  localStorage: Omit<ConsentRecordV1["localStorage"], "state">;
  sensitiveHealth: Omit<ConsentRecordV1["sensitiveHealth"], "state">;
  aiTransfer: ConsentRecordV1["aiTransfer"];
  updatedAt: UtcTimestamp;
};

export type KnownTextListV1 =
  | { state: "known"; values: string[] }
  | { state: "unknown" };

export type LifestyleAnswerV1 =
  | { state: "yes"; details?: string }
  | { state: "no" }
  | { state: "unknown" };

export type BirthDateV1 = `${number}-${number}-${number}`;

export type ProfileRecordV1 = {
  id: "default";
  schemaVersion: 1;
  displayName: string;
  birthDate: BirthDateV1;
  sex: "female" | "male" | "other" | "unknown";
  updatedAt: UtcTimestamp;
};

export type MedicalProfileRecordV1 = {
  id: "default";
  schemaVersion: 1;
  conditions: KnownTextListV1;
  medications: KnownTextListV1;
  allergies: KnownTextListV1;
  familyHistory: KnownTextListV1;
  medicalHistory: KnownTextListV1;
  surgicalHistory: KnownTextListV1;
  smoking: LifestyleAnswerV1;
  alcohol: LifestyleAnswerV1;
  heightCm?: number;
  weightKg?: number;
  updatedAt: UtcTimestamp;
};

export type SaveProfileBundleInputV1 = {
  profile: Omit<ProfileRecordV1, "id" | "schemaVersion">;
  medicalProfile: Omit<MedicalProfileRecordV1, "id" | "schemaVersion">;
};

export type ProfileBundleV1 = {
  profile: ProfileRecordV1;
  medicalProfile: MedicalProfileRecordV1;
};

export type CompleteOnboardingInputV1 = {
  consent: GrantConsentInputV1;
  profileBundle: SaveProfileBundleInputV1;
};

export type InterviewStatusV1 =
  | "draft"
  | "review"
  | "completed"
  | "safety-stopped";

export type InterviewQuestionSnapshotV1 = {
  id: string;
  slot: string;
  text: string;
  selection: "single" | "multiple";
  options: { id: string; label: string }[];
};

export type CompletedProfileSnapshotV1 = {
  schemaVersion: 1;
  capturedAt: UtcTimestamp;
  profile: Omit<ProfileRecordV1, "id" | "updatedAt">;
  medicalProfile: Omit<MedicalProfileRecordV1, "id" | "updatedAt">;
};

export type InterviewRecordV1 = {
  id: string;
  schemaVersion: 1;
  revision: number;
  status: InterviewStatusV1;
  mode: "ai" | "manual";
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  completedAt?: UtcTimestamp;
  profileSnapshot?: CompletedProfileSnapshotV1;
};

export type InterviewDraftInputV1 = {
  currentQuestion: InterviewQuestionSnapshotV1;
  input: {
    mode: "text" | "choice" | "measurement" | "simulated-voice";
    text: string;
    selectedOptionIds: string[];
    measurement?: { value: number; unit: string };
  };
  updatedAt: UtcTimestamp;
};

export type InterviewDraftRecordV1 = InterviewDraftInputV1 & {
  interviewId: string;
  schemaVersion: 1;
  revision: number;
};

export type InterviewMessageInputV1 = {
  id: string;
  sequence: number;
  role: "assistant" | "user" | "system";
  kind: "question" | "answer" | "safety";
  text: string;
  createdAt: UtcTimestamp;
};

export type InterviewMessageRecordV1 = InterviewMessageInputV1 & {
  interviewId: string;
  schemaVersion: 1;
};

export type SummaryItemV1 = {
  id: string;
  text: string;
  evidenceMessageIds: string[];
};

export type SummaryContentV1 = {
  subjective: SummaryItemV1[];
  objective: SummaryItemV1[];
  verificationNeeded: SummaryItemV1[];
};

export type SummaryRecordV1 = {
  interviewId: string;
  schemaVersion: 1;
  revision: number;
  status: "draft" | "review" | "confirmed";
  source: "ai" | "manual";
  content: SummaryContentV1;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  confirmedAt?: UtcTimestamp;
};

export type InterviewAggregateV1 = {
  interview: InterviewRecordV1;
  draft?: InterviewDraftRecordV1;
  messages: InterviewMessageRecordV1[];
  summary?: SummaryRecordV1;
};

export type CreateInterviewInputV1 = {
  id: string;
  mode: "ai" | "manual";
  createdAt: UtcTimestamp;
  draft: InterviewDraftInputV1;
};

export type RevisionToken = {
  interviewId: string;
  expectedRevision: number;
  runtimeGeneration: number;
};

export type SaveProgressInputV1 = {
  draft: InterviewDraftInputV1;
  appendedMessages: InterviewMessageInputV1[];
};

export type SaveSummaryInputV1 = {
  source: "ai" | "manual";
  content: SummaryContentV1;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
};

export type SaveFinalProgressInputV1 = {
  draft: InterviewDraftInputV1;
  appendedMessages: InterviewMessageInputV1[];
  summary: SaveSummaryInputV1;
};
