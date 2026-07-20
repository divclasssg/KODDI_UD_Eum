import type {
  DemoPersonaId,
  InterviewQuestion,
  InterviewSlotId,
  InterviewSummary,
} from "@/features/interview/model/interview-domain.types";

export const AI_CONTRACT_VERSION = "1" as const;
export const AI_MAX_REQUEST_BYTES = 8_192;
export const AI_MAX_RECENT_TURNS = 10;

export type AiInterviewContextV1 = {
  version: typeof AI_CONTRACT_VERSION;
  interviewId: string;
  personaId: DemoPersonaId;
  currentSlot?: InterviewSlotId;
  filledSlots: Partial<Record<InterviewSlotId, string>>;
  recentTurns: { id: string; question: string; answer: string }[];
};

export type AiQuestionResponseV1 =
  | {
      version: typeof AI_CONTRACT_VERSION;
      kind: "question";
      question: InterviewQuestion;
    }
  | { version: typeof AI_CONTRACT_VERSION; kind: "complete" };

export type AiSummaryResponseV1 = {
  version: typeof AI_CONTRACT_VERSION;
  kind: "summary";
  summary: InterviewSummary;
};
