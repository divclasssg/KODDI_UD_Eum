export type InterviewUiState =
  | "answering"
  | "saving"
  | "waiting-for-ai"
  | "save-error"
  | "ai-error"
  | "caution"
  | "urgent"
  | "summary-transition"
  | "safe-ended";

export type InterviewTurn = {
  id: string;
  question: string;
  answer: string;
};

export type InterviewQuestion = {
  id: string;
  text: string;
  selection: "single" | "multiple";
  options: { id: string; label: string }[];
};

export type InterviewDraft = {
  selectedOptionIds: string[];
  text: string;
  inputMode: "choice" | "text" | "voice";
};

export type InterviewPendingOperation = {
  kind: "saving" | "ai";
  title: string;
};

export type InterviewError = {
  kind: "save" | "ai";
  title: string;
  description: string;
};

export type InterviewSafetyNotice = {
  level: "caution" | "urgent";
  title: string;
  description: string;
};

export type InterviewSummaryTransition = {
  title: string;
  description: string;
};

export type InterviewViewModel = {
  interviewId: string;
  state: InterviewUiState;
  history: InterviewTurn[];
  question?: InterviewQuestion;
  draft: InterviewDraft;
  pending?: InterviewPendingOperation;
  error?: InterviewError;
  safety?: InterviewSafetyNotice;
  summary?: InterviewSummaryTransition;
};
