import {
  INTERVIEW_FIXTURE_IDS,
  type InterviewFixtureId,
} from "./fixture.types";

export function resolveFixtureId(
  raw: string | string[] | undefined,
  enabled: boolean,
) {
  if (!enabled || typeof raw !== "string") {
    return { ok: false } as const;
  }

  return INTERVIEW_FIXTURE_IDS.includes(raw as InterviewFixtureId)
    ? ({ ok: true, id: raw as InterviewFixtureId } as const)
    : ({ ok: false } as const);
}
