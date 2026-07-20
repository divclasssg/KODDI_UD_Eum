import type { InterviewFixtureId } from "./fixtures/fixture.types";
import type { InterviewCommandsPort } from "./interview-commands";
import type {
  InterviewDraft,
  InterviewQuestion,
} from "./model/interview-ui.types";

export type FixtureCommandCounters = {
  ai: number;
  safety: number;
  save: number;
};

export type FixtureInterviewCommands = InterviewCommandsPort & {
  calls: FixtureCommandCounters;
};

const NEXT_QUESTION: InterviewQuestion = {
  id: "question-continuity",
  slot: "pattern",
  text: "증상은 계속 이어지나요?",
  selection: "single",
  options: [
    { id: "continuous", label: "계속 이어져요" },
    { id: "intermittent", label: "나아졌다가 다시 나타나요" },
    { id: "unknown", label: "잘 모르겠어요" },
  ],
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatAnswer(question: InterviewQuestion, draft: InterviewDraft) {
  const optionLabels = question.options
    .filter((option) => draft.selectedOptionIds.includes(option.id))
    .map((option) => option.label);
  const text = draft.text.trim();
  return [...optionLabels, ...(text ? [text] : [])].join(", ");
}

export function createFixtureInterviewCommands(
  fixtureId: InterviewFixtureId,
): FixtureInterviewCommands {
  const calls: FixtureCommandCounters = { ai: 0, safety: 0, save: 0 };

  return {
    calls,
    recordSafetyAction() {
      calls.safety += 1;
    },
    async requestNext() {
      calls.ai += 1;
      await wait(1_200);
      return {
        kind: "question",
        question: {
          ...NEXT_QUESTION,
          id: `${NEXT_QUESTION.id}-${fixtureId}`,
          options: NEXT_QUESTION.options.map((option) => ({ ...option })),
        },
      };
    },
    async requestSummary(history) {
      calls.ai += 1;
      await wait(1_200);
      return {
        subjective: history.map((turn) => ({
          id: `summary-${turn.id}`,
          text: turn.answer,
          evidenceTurnIds: [turn.id],
        })),
        objective: [],
        verificationNeeded: [],
      };
    },
    async saveAnswer({ draft, question }) {
      calls.save += 1;
      await wait(900);
      return {
        id: `turn-${calls.save + 2}`,
        question: question.text,
        answer: formatAnswer(question, draft),
      };
    },
  };
}
