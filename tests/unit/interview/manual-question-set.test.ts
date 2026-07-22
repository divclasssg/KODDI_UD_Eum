import { describe, expect, it } from "vitest";

import {
  createManualSummary,
  formatManualAnswer,
  MANUAL_QUESTIONS_V1,
  MANUAL_QUESTION_SET_ID,
  MANUAL_QUESTION_SET_V2,
} from "@/features/interview/manual/manual-question-set";
import {
  toUtcTimestamp,
  type InterviewMessageRecordV1,
} from "@/lib/db/contracts";

const SYNTHETIC_MESSAGES: InterviewMessageRecordV1[] = [
  {
    interviewId: "manual-synthetic",
    schemaVersion: 1,
    id: "question-message",
    sequence: 0,
    role: "assistant",
    kind: "question",
    text: "지금 가장 불편한 점을 적어 주세요.",
    createdAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
  {
    interviewId: "manual-synthetic",
    schemaVersion: 1,
    id: "answer-message",
    sequence: 1,
    role: "user",
    kind: "answer",
    text: "합성 두통",
    createdAt: toUtcTimestamp("2026-07-22T01:00:30.000Z"),
  },
];

describe("manual question set", () => {
  it("질문 번호 없이 최대 다섯 개 versioned 질문을 제공한다", () => {
    expect(MANUAL_QUESTION_SET_ID).toBe("manual-intake-v1");
    expect(MANUAL_QUESTIONS_V1).toHaveLength(5);
    expect(MANUAL_QUESTIONS_V1.map(({ id }) => id)).toEqual([
      "manual-intake-v1:chief-complaint",
      "manual-intake-v1:onset",
      "manual-intake-v1:pattern",
      "manual-intake-v1:severity",
      "manual-intake-v1:additional",
    ]);
    expect(MANUAL_QUESTIONS_V1.map(({ text }) => text).join(" ")).not.toMatch(
      /1\/5|2\/5|진단|치료|응급/,
    );
  });

  it("기간과 강도는 승인 문구를 유지한 chip 계약으로 snapshot한다", () => {
    expect(MANUAL_QUESTION_SET_V2).toMatchObject({
      contractVersion: 2,
      id: "manual-intake-v1",
    });
    expect(MANUAL_QUESTION_SET_V2.questions).toHaveLength(5);

    const onset = MANUAL_QUESTION_SET_V2.questions[1];
    const severity = MANUAL_QUESTION_SET_V2.questions[3];
    expect(onset.allowedModes).toEqual(["chip", "text"]);
    expect(onset.contracts.chip).toMatchObject({
      kind: "duration",
      selection: "single",
      unknownOptionId: "unknown",
    });
    expect(severity.allowedModes).toEqual(["chip", "text"]);
    expect(severity.contracts.chip).toMatchObject({
      kind: "severity",
      selection: "single",
      unknownOptionId: "unknown",
    });
  });

  it("공개 manual 질문에는 승인되지 않은 증상 preset과 measurement를 넣지 않는다", () => {
    expect(
      MANUAL_QUESTION_SET_V2.questions.flatMap(({ allowedModes }) =>
        allowedModes,
      ),
    ).not.toContain("measurement");
    expect(MANUAL_QUESTION_SET_V2.questions[0].allowedModes).toEqual(["text"]);
    expect(MANUAL_QUESTION_SET_V2.questions[0].contracts.chip).toBeUndefined();
  });

  it("선택 label과 직접 입력을 한 답변으로 정리한다", () => {
    expect(
      formatManualAnswer(MANUAL_QUESTIONS_V1[1], {
        text: "합성 메모",
        selectedOptionIds: ["days"],
      }),
    ).toBe("며칠 전, 합성 메모");
  });

  it("summary의 모든 항목이 저장된 user message를 근거로 한다", () => {
    const summary = createManualSummary(SYNTHETIC_MESSAGES);

    expect(
      summary.subjective.flatMap((item) => item.evidenceMessageIds),
    ).toEqual(["answer-message"]);
    expect(JSON.stringify(summary)).not.toMatch(/진단|치료|응급실|약을 드세요/);
  });
});
