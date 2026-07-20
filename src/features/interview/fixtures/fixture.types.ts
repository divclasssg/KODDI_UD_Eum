import type { InterviewViewModel } from "../model/interview-ui.types";

export const INTERVIEW_FIXTURE_IDS = [
  "answering-default",
  "history-review",
  "saving-delayed",
  "waiting-for-ai",
  "save-error",
  "ai-error",
  "safety-caution",
  "safety-urgent",
  "summary-transition",
] as const;

export type InterviewFixtureId = (typeof INTERVIEW_FIXTURE_IDS)[number];

export type InterviewFixtureDefinition = {
  id: InterviewFixtureId;
  model: InterviewViewModel;
  expected: FixtureAssertions;
};

export type FixtureAssertions = {
  focus: "question" | "status" | "error" | "safety";
  role?: "status" | "alert";
  live: "off" | "polite" | "assertive";
  busy: boolean;
  inputLocked: boolean;
  actions: readonly FixtureAction[];
};

export type FixtureAction =
  | "submit"
  | "jump-to-latest"
  | "retry-save"
  | "retry-ai"
  | "continue-manually"
  | "continue-interview"
  | "call-119"
  | "show-to-bystander"
  | "view-summary";
