import type { InterviewFixtureId } from "./fixtures/fixture.types";
import type {
  InterviewDraft,
  InterviewQuestion,
  InterviewTurn,
} from "./model/interview-ui.types";

export type SaveAnswerInput = {
  draft: InterviewDraft;
  interviewId: string;
  question: InterviewQuestion;
};

export type InterviewNextResult =
  | { kind: "question"; question: InterviewQuestion }
  | { kind: "complete" };

export type FixtureCommandCounters = {
  ai: number;
  safety: number;
  save: number;
};

export type FixtureInterviewCommands = {
  calls: FixtureCommandCounters;
  recordSafetyAction(action: string): void;
  requestNext(history: InterviewTurn[]): Promise<InterviewNextResult>;
  saveAnswer(input: SaveAnswerInput): Promise<InterviewTurn>;
};

const NEXT_QUESTION: InterviewQuestion = {
  id: "question-continuity",
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
