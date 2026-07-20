import { describe, expect, it } from "vitest";

import {
  AiContractError,
  parseAiInterviewContextV1,
  parseAiQuestionResponseV1,
  parseAiSummaryResponseV1,
} from "@/lib/ai/validators";

const VALID_CONTEXT = {
  version: "1",
  interviewId: "interview-demo-001",
  personaId: "persona-kim",
  currentSlot: "duration",
  filledSlots: { "chief-complaint": "두통", onset: "오늘 아침" },
  recentTurns: [
    {
      id: "turn-001",
      question: "어디가 불편하신가요?",
      answer: "두통이 있어요",
    },
  ],
} as const;

describe("AI 계약 validator", () => {
  it("유효한 문진 context의 문자열을 정리해 반환한다", () => {
    const parsed = parseAiInterviewContextV1({
      ...VALID_CONTEXT,
      interviewId: "  interview-demo-001  ",
    });

    expect(parsed.interviewId).toBe("interview-demo-001");
    expect(parsed.recentTurns).toHaveLength(1);
  });

  it.each([
    ["unknown field", { ...VALID_CONTEXT, extra: true }],
    ["wrong version", { ...VALID_CONTEXT, version: "2" }],
    ["wrong slot", { ...VALID_CONTEXT, currentSlot: "diagnosis" }],
    [
      "too many recent turns",
      {
        ...VALID_CONTEXT,
        recentTurns: Array.from({ length: 11 }, (_, index) => ({
          id: `turn-${index}`,
          question: "질문",
          answer: "답변",
        })),
      },
    ],
  ])("%s가 있는 context를 거절한다", (_, input) => {
    expect(() => parseAiInterviewContextV1(input)).toThrow(AiContractError);
  });

  it("직렬화 크기가 8,192 byte를 넘는 context를 거절한다", () => {
    expect(() =>
      parseAiInterviewContextV1({
        ...VALID_CONTEXT,
        filledSlots: { "chief-complaint": "가".repeat(3_000) },
      }),
    ).toThrowError(expect.objectContaining({ code: "request-too-large" }));
  });

  it("유효한 다음 질문 응답을 반환한다", () => {
    const parsed = parseAiQuestionResponseV1({
      version: "1",
      kind: "question",
      question: {
        id: "question-002",
        slot: "pattern",
        text: "증상은 계속 이어지나요?",
        selection: "single",
        options: [
          { id: "continuous", label: "계속 이어져요" },
          { id: "unknown", label: "잘 모르겠어요" },
        ],
      },
    });

    expect(parsed.kind).toBe("question");
  });

  it("질문 응답의 중첩 unknown field를 거절한다", () => {
    expect(() =>
      parseAiQuestionResponseV1({
        version: "1",
        kind: "question",
        question: {
          id: "question-002",
          slot: "pattern",
          text: "증상은 계속 이어지나요?",
          selection: "single",
          options: [{ id: "yes", label: "예", hidden: true }],
        },
      }),
    ).toThrow(AiContractError);
  });

  it("현재 대화에 존재하는 근거 ID를 사용한 summary를 반환한다", () => {
    const parsed = parseAiSummaryResponseV1(
      {
        version: "1",
        kind: "summary",
        summary: {
          subjective: [
            {
              id: "subjective-001",
              text: "오늘 아침부터 두통이 있음",
              evidenceTurnIds: ["turn-001"],
            },
          ],
          objective: [],
          verificationNeeded: [],
        },
      },
      new Set(["turn-001"]),
    );

    expect(parsed.summary.subjective[0]?.evidenceTurnIds).toEqual(["turn-001"]);
  });

  it("현재 대화에 없는 summary 근거 ID를 거절한다", () => {
    expect(() =>
      parseAiSummaryResponseV1(
        {
          version: "1",
          kind: "summary",
          summary: {
            subjective: [
              {
                id: "subjective-001",
                text: "확인되지 않은 내용",
                evidenceTurnIds: ["turn-missing"],
              },
            ],
            objective: [],
            verificationNeeded: [],
          },
        },
        new Set(["turn-001"]),
      ),
    ).toThrowError(expect.objectContaining({ code: "unknown-evidence-turn" }));
  });
});
