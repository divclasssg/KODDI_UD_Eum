import "server-only";

import {
  INTERVIEW_SLOT_IDS,
  type InterviewQuestion,
  type InterviewSlotId,
} from "@/features/interview/model/interview-domain.types";

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
    async requestQuestion(context) {
      const nextSlot = INTERVIEW_SLOT_IDS.find(
        (slot) => context.filledSlots[slot] === undefined,
      );
      if (!nextSlot) return { version: "1", kind: "complete" };
      return {
        version: "1",
        kind: "question",
        question: createQuestion(nextSlot),
      };
    },
    async requestSummary(context) {
      return {
        version: "1",
        kind: "summary",
        summary: {
          subjective: context.recentTurns.map((turn) => ({
            id: `subjective-${turn.id}`,
            text: turn.answer,
            evidenceTurnIds: [turn.id],
          })),
          objective: [],
          verificationNeeded: [],
        },
      };
    },
  };
}
