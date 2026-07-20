export const INTERVIEW_SLOT_IDS = [
  "chief-complaint",
  "onset",
  "duration",
  "severity",
  "pattern",
  "associated-symptoms",
  "medications",
  "allergies",
  "safety",
] as const;

export type InterviewSlotId = (typeof INTERVIEW_SLOT_IDS)[number];

export type DemoPersonaId =
  | "persona-kim"
  | "persona-lee"
  | "persona-park";

export type InterviewQuestion = {
  id: string;
  slot: InterviewSlotId;
  text: string;
  selection: "single" | "multiple";
  options: { id: string; label: string }[];
};

export type InterviewSummaryItem = {
  id: string;
  text: string;
  evidenceTurnIds: string[];
};

export type InterviewSummary = {
  subjective: InterviewSummaryItem[];
  objective: InterviewSummaryItem[];
  verificationNeeded: InterviewSummaryItem[];
};
