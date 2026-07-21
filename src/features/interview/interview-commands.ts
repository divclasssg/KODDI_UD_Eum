import type {
  InterviewDraft,
  InterviewTurn,
} from "./model/interview-ui.types";
import type {
  InterviewQuestion,
  InterviewSummary,
} from "./model/interview-domain.types";

export type SaveAnswerInput = {
  draft: InterviewDraft;
  interviewId: string;
  question: InterviewQuestion;
};

export type InterviewNextResult =
  | { kind: "question"; question: InterviewQuestion }
  | { kind: "complete" };

export type InterviewCommandsPort = {
  dispose?(): void;
  recordSafetyAction(action: string): void;
  requestNext(history: InterviewTurn[]): Promise<InterviewNextResult>;
  requestSummary(history: InterviewTurn[]): Promise<InterviewSummary>;
  reset?(): void;
  saveAnswer(input: SaveAnswerInput): Promise<InterviewTurn>;
};
