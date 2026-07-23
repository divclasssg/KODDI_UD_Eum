import "server-only";

import {
  INTERVIEW_SLOT_IDS,
  type InterviewQuestion,
  type InterviewSlotId,
} from "@/features/interview/model/interview-domain.types";

import {
  AI_CONTRACT_VERSION,
  AI_PUBLIC_CONTRACT_VERSION,
  type AiInterviewContext,
  type AiQuestionResponseForContext,
  type AiSummaryResponseForContext,
} from "./contracts";
import type { MedGemmaProvider } from "./provider";

const QUESTION_TEXT: Record<InterviewSlotId, string> = {
  "chief-complaint": "어디가 불편하신가요?",
  onset: "증상은 언제 시작되었나요?",
  duration: "증상이 시작된 지 얼마나 지났나요?",
  severity: "증상은 어느 정도인가요?",
  pattern: "증상은 계속 이어지나요?",
  "associated-symptoms": "함께 나타나는 다른 증상이 있나요?",
  medications: "복용 중인 약이 있나요?",
  allergies: "알레르기가 있나요?",
  safety: "지금 즉시 도움이 필요한 위험 신호가 있나요?",
};

function createQuestion(slot: InterviewSlotId): InterviewQuestion {
  return {
    id: `question-${slot}`,
    slot,
    text: QUESTION_TEXT[slot],
    selection: "single",
    options: [
      { id: "yes", label: "예" },
      { id: "no", label: "아니요" },
      { id: "unknown", label: "잘 모르겠어요" },
    ],
  };
}

export function createMockMedGemmaAdapter(): MedGemmaProvider {
  return {
    async requestQuestion<TContext extends AiInterviewContext>(
      context: TContext,
    ): Promise<AiQuestionResponseForContext<TContext>> {
      const nextSlot = INTERVIEW_SLOT_IDS.find(
        (slot) => context.filledSlots[slot] === undefined,
      );
      if (!nextSlot) {
        return (context.version === AI_CONTRACT_VERSION
          ? { version: AI_CONTRACT_VERSION, kind: "complete" }
          : {
              version: AI_PUBLIC_CONTRACT_VERSION,
              kind: "complete",
            }) as unknown as AiQuestionResponseForContext<TContext>;
      }
      if (context.version === AI_PUBLIC_CONTRACT_VERSION) {
        return {
          version: AI_PUBLIC_CONTRACT_VERSION,
          kind: "question",
          question: createQuestion(nextSlot),
        } as unknown as AiQuestionResponseForContext<TContext>;
      }
      return {
        version: AI_CONTRACT_VERSION,
        kind: "question",
        question: createQuestion(nextSlot),
      } as unknown as AiQuestionResponseForContext<TContext>;
    },
    async requestSummary<TContext extends AiInterviewContext>(
      context: TContext,
    ): Promise<AiSummaryResponseForContext<TContext>> {
      const summary = {
        subjective: context.recentTurns.map((turn) => ({
          id: `subjective-${turn.id}`,
          text: turn.answer,
          evidenceTurnIds: [turn.id],
        })),
        objective: [],
        verificationNeeded: [],
      };
      if (context.version === AI_PUBLIC_CONTRACT_VERSION) {
        return {
          version: AI_PUBLIC_CONTRACT_VERSION,
          kind: "summary",
          summary,
        } as unknown as AiSummaryResponseForContext<TContext>;
      }
      return {
        version: AI_CONTRACT_VERSION,
        kind: "summary",
        summary,
      } as unknown as AiSummaryResponseForContext<TContext>;
    },
  };
}
