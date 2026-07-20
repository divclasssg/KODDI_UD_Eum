import type {
  InterviewDraft,
  InterviewQuestion,
  InterviewTurn,
  InterviewUiState,
  InterviewViewModel,
} from "../model/interview-ui.types";
import type {
  FixtureAssertions,
  InterviewFixtureDefinition,
  InterviewFixtureId,
} from "./fixture.types";

const INTERVIEW_ID = "fixture-interview-001";
const PERSONA_ID = "persona-kim" as const;

const BASE_HISTORY: InterviewTurn[] = [
  {
    id: "turn-001",
    question: "어디가 불편하신가요?",
    answer: "두통이 있어요",
  },
  {
    id: "turn-002",
    question: "어떤 증상을 느끼시나요?",
    answer: "어지럽고 속이 메스꺼워요",
  },
];

const REVIEW_HISTORY: InterviewTurn[] = [
  ...BASE_HISTORY,
  {
    id: "turn-003",
    question: "통증도 있나요?",
    answer: "아니요",
  },
  {
    id: "turn-004",
    question: "어지럼증은 어느 정도인가요?",
    answer: "일상생활은 할 수 있어요",
  },
  {
    id: "turn-005",
    question: "증상이 심해지는 때가 있나요?",
    answer: "갑자기 일어나면 심해져요",
  },
];

const SAVED_HISTORY: InterviewTurn[] = [
  ...BASE_HISTORY,
  {
    id: "turn-003",
    question: "증상이 시작된 지 얼마나 지났나요?",
    answer: "며칠에 걸침",
  },
];

const CURRENT_QUESTION: InterviewQuestion = {
  id: "question-duration",
  slot: "duration",
  text: "증상이 시작된 지 얼마나 지났나요?",
  selection: "single",
  options: [
    { id: "today", label: "오늘" },
    { id: "days", label: "며칠에 걸침" },
    { id: "weeks", label: "수주에 걸침" },
    { id: "unknown", label: "잘 모르겠어요" },
  ],
};

const EMPTY_DRAFT: InterviewDraft = {
  selectedOptionIds: [],
  text: "",
  inputMode: "choice",
};

const SELECTED_DRAFT: InterviewDraft = {
  selectedOptionIds: ["days"],
  text: "",
  inputMode: "choice",
};

type InterviewModelOverrides = Partial<
  Omit<InterviewViewModel, "interviewId" | "state">
>;

function cloneHistory(history: InterviewTurn[]): InterviewTurn[] {
  return history.map((turn) => ({ ...turn }));
}

function cloneQuestion(): InterviewQuestion {
  return {
    ...CURRENT_QUESTION,
    options: CURRENT_QUESTION.options.map((option) => ({ ...option })),
  };
}

function createModel(
  state: InterviewUiState,
  options: InterviewModelOverrides = {},
): InterviewViewModel {
  return {
    interviewId: INTERVIEW_ID,
    personaId: PERSONA_ID,
    roleplayConfirmed: true,
    state,
    history: cloneHistory(BASE_HISTORY),
    question: cloneQuestion(),
    draft: { ...EMPTY_DRAFT, selectedOptionIds: [] },
    ...options,
  };
}

function defineFixture(
  id: InterviewFixtureId,
  model: InterviewViewModel,
  expected: FixtureAssertions,
): InterviewFixtureDefinition {
  return { id, model, expected };
}

export const INTERVIEW_FIXTURES = {
  "answering-default": defineFixture(
    "answering-default",
    createModel("answering"),
    {
      focus: "question",
      live: "off",
      busy: false,
      inputLocked: false,
      actions: ["submit"],
    },
  ),
  "history-review": defineFixture(
    "history-review",
    createModel("answering", { history: cloneHistory(REVIEW_HISTORY) }),
    {
      focus: "question",
      live: "off",
      busy: false,
      inputLocked: false,
      actions: ["submit", "jump-to-latest"],
    },
  ),
  "saving-delayed": defineFixture(
    "saving-delayed",
    createModel("saving", {
      draft: { ...SELECTED_DRAFT, selectedOptionIds: ["days"] },
      pending: { kind: "saving", title: "답변을 저장하고 있어요" },
    }),
    {
      focus: "status",
      role: "status",
      live: "polite",
      busy: true,
      inputLocked: true,
      actions: [],
    },
  ),
  "waiting-for-ai": defineFixture(
    "waiting-for-ai",
    createModel("waiting-for-ai", {
      history: cloneHistory(SAVED_HISTORY),
      question: undefined,
      pending: { kind: "ai", title: "다음 질문을 준비하고 있어요" },
    }),
    {
      focus: "status",
      role: "status",
      live: "polite",
      busy: true,
      inputLocked: true,
      actions: [],
    },
  ),
  "save-error": defineFixture(
    "save-error",
    createModel("save-error", {
      draft: { ...SELECTED_DRAFT, selectedOptionIds: ["days"] },
      error: {
        kind: "save",
        title: "답변을 저장하지 못했어요",
        description: "입력한 내용은 그대로 있어요. 다시 저장해 주세요.",
      },
    }),
    {
      focus: "error",
      role: "alert",
      live: "assertive",
      busy: false,
      inputLocked: false,
      actions: ["retry-save"],
    },
  ),
  "ai-error": defineFixture(
    "ai-error",
    createModel("ai-error", {
      history: cloneHistory(SAVED_HISTORY),
      question: undefined,
      error: {
        kind: "ai",
        title: "다음 질문을 불러오지 못했어요",
        description: "저장한 답변은 남아 있어요.",
      },
    }),
    {
      focus: "error",
      role: "alert",
      live: "assertive",
      busy: false,
      inputLocked: false,
      actions: ["retry-ai", "continue-manually"],
    },
  ),
  "safety-caution": defineFixture(
    "safety-caution",
    createModel("caution", {
      safety: {
        level: "caution",
        title: "주의가 필요한 답변이 있어요",
        description:
          "문진은 계속할 수 있지만, 상태가 달라지면 도움을 요청해 주세요.",
      },
    }),
    {
      focus: "safety",
      role: "status",
      live: "polite",
      busy: false,
      inputLocked: false,
      actions: ["continue-interview"],
    },
  ),
  "safety-urgent": defineFixture(
    "safety-urgent",
    createModel("urgent", {
      history: cloneHistory(SAVED_HISTORY),
      question: undefined,
      safety: {
        level: "urgent",
        title: "위험 신호가 있어요",
        description:
          "이 앱은 진단하지 않지만, 지금은 문진보다 도움 요청이 먼저일 수 있어요. 주변 사람에게 알리거나 119에 연락하세요.",
      },
    }),
    {
      focus: "safety",
      role: "alert",
      live: "assertive",
      busy: false,
      inputLocked: true,
      actions: ["call-119", "show-to-bystander", "view-summary"],
    },
  ),
  "summary-transition": defineFixture(
    "summary-transition",
    createModel("summary-transition", {
      history: cloneHistory(SAVED_HISTORY),
      question: undefined,
      summary: {
        title: "문진 내용을 정리하고 있어요",
        description: "잠시만 기다려 주세요.",
      },
    }),
    {
      focus: "status",
      role: "status",
      live: "polite",
      busy: true,
      inputLocked: true,
      actions: [],
    },
  ),
} satisfies Record<InterviewFixtureId, InterviewFixtureDefinition>;
