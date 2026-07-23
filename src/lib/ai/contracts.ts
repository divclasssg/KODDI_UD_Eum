import type {
  DemoPersonaId,
  InterviewQuestion,
  InterviewSlotId,
  InterviewSummary,
} from "@/features/interview/model/interview-domain.types";

export const AI_CONTRACT_VERSION = "1" as const;
export const AI_PUBLIC_CONTRACT_VERSION = "2" as const;
export const AI_MAX_REQUEST_BYTES = 8_192;
export const AI_MAX_RECENT_TURNS = 10;

export type AiContractVersion =
  | typeof AI_CONTRACT_VERSION
  | typeof AI_PUBLIC_CONTRACT_VERSION;

export type AiInterviewContextV1 = {
  version: typeof AI_CONTRACT_VERSION;
  interviewId: string;
  personaId: DemoPersonaId;
  currentSlot?: InterviewSlotId;
  filledSlots: Partial<Record<InterviewSlotId, string>>;
  recentTurns: { id: string; question: string; answer: string }[];
};

export type AiInterviewContextV2 = {
  version: typeof AI_PUBLIC_CONTRACT_VERSION;
  interviewId: string;
  currentSlot?: InterviewSlotId;
  filledSlots: Partial<Record<InterviewSlotId, string>>;
  recentTurns: { id: string; question: string; answer: string }[];
};

export type AiInterviewContext = AiInterviewContextV1 | AiInterviewContextV2;

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

export type AiQuestionResponseV2 =
  | {
      version: typeof AI_PUBLIC_CONTRACT_VERSION;
      kind: "question";
      question: InterviewQuestion;
    }
  | { version: typeof AI_PUBLIC_CONTRACT_VERSION; kind: "complete" };

export type AiSummaryResponseV2 = {
  version: typeof AI_PUBLIC_CONTRACT_VERSION;
  kind: "summary";
  summary: InterviewSummary;
};

export type AiQuestionResponse = AiQuestionResponseV1 | AiQuestionResponseV2;
export type AiSummaryResponse = AiSummaryResponseV1 | AiSummaryResponseV2;

export type AiQuestionResponseForContext<
  TContext extends AiInterviewContext,
> = TContext extends AiInterviewContextV1
  ? AiQuestionResponseV1
  : AiQuestionResponseV2;

export type AiSummaryResponseForContext<
  TContext extends AiInterviewContext,
> = TContext extends AiInterviewContextV1
  ? AiSummaryResponseV1
  : AiSummaryResponseV2;
