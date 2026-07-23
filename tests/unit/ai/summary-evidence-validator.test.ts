import { describe, expect, it } from "vitest";

import type {
  InterviewSummary,
  InterviewSummaryItem,
} from "@/features/interview/model/interview-domain.types";
import {
  classifyItem,
  validateSummaryEvidence,
  type EvidenceSourceTurn,
} from "@/lib/ai/summary-evidence-validator";

function item(
  text: string,
  evidenceTurnIds = ["turn-001"],
  id = "item-001",
): InterviewSummaryItem {
  return { id, text, evidenceTurnIds };
}

function turns(answer: string): EvidenceSourceTurn[] {
  return [{ id: "turn-001", question: "증상을 알려 주세요.", answer }];
}

function summary(
  sections: Partial<InterviewSummary> = {},
): InterviewSummary {
  return {
    subjective: [],
    objective: [],
    verificationNeeded: [],
    ...sections,
  };
}

describe("summary evidence validator", () => {
  it.each([
    ["통증은 3점이에요", "통증은 8점", "reject"],
    ["체온은 37.2도예요", "체온 39도", "reject"],
    ["구토는 없어요", "구토가 있어요", "verification"],
    ["구토는 모르겠어요", "구토는 없어요", "verification"],
    ["구토는 모르겠어요", "구토가 있어요", "verification"],
    ["어제는 어지러웠어요", "지금 어지러워요", "verification"],
    ["아버지가 당뇨예요", "사용자가 당뇨예요", "verification"],
    ["아버지가 당뇨예요", "어머니가 당뇨예요", "verification"],
  ] as const)("명시적 불일치를 %s와 %s로 분류한다", (evidence, text, expected) => {
    expect(classifyItem(item(text), turns(evidence))).toBe(expected);
  });

  it("원문과 정확히 일치하는 수치, 날짜, 시간, 단위를 수용한다", () => {
    const result = validateSummaryEvidence(
      summary({
        objective: [
          item("체온은 37.2도이고 2026-07-22 09:30에 확인했어요"),
        ],
      }),
      turns("체온은 37.2도예요. 2026-07-22 09:30에 쟀어요."),
    );

    expect(result).toEqual({
      summary: summary({
        objective: [
          item("체온은 37.2도이고 2026-07-22 09:30에 확인했어요"),
        ],
      }),
      rejectedItemIds: [],
      usedFallback: false,
    });
  });

  it("없는 evidence ID와 중복 item ID를 거절하고 evidence ID는 중복 없이 보존한다", () => {
    const result = validateSummaryEvidence(
      summary({
        subjective: [
          item("두통이 있어요", ["turn-001", "turn-001"], "item-kept"),
          item("다른 내용", ["turn-missing"], "item-missing"),
        ],
        objective: [item("중복 ID", ["turn-001"], "item-kept")],
      }),
      turns("두통이 있어요"),
    );

    expect(result.summary.subjective).toEqual([
      item("두통이 있어요", ["turn-001"], "item-kept"),
    ]);
    expect(result.summary.objective).toEqual([]);
    expect(result.rejectedItemIds).toEqual(["item-missing", "item-kept"]);
  });

  it("원래 section의 valid item은 보존하고 모순 item만 verificationNeeded로 옮긴다", () => {
    const source = summary({
      subjective: [
        item("두통이 있어요", ["turn-001"], "item-valid"),
        item("구토가 있어요", ["turn-002"], "item-verify"),
      ],
      objective: [item("체온은 39도", ["turn-003"], "item-reject")],
    });
    const result = validateSummaryEvidence(source, [
      { id: "turn-001", question: "증상", answer: "두통이 있어요" },
      { id: "turn-002", question: "구토", answer: "구토는 없어요" },
      { id: "turn-003", question: "체온", answer: "체온은 37.2도예요" },
    ]);

    expect(result.summary).toEqual(
      summary({
        subjective: [item("두통이 있어요", ["turn-001"], "item-valid")],
        objective: [],
        verificationNeeded: [
          item("구토가 있어요", ["turn-002"], "item-verify"),
        ],
      }),
    );
    expect(result.rejectedItemIds).toEqual(["item-reject"]);
    expect(source.subjective).toHaveLength(2);
  });

  it("표시할 item이 전혀 없으면 fallback 신호를 준다", () => {
    const result = validateSummaryEvidence(
      summary({ subjective: [item("통증은 8점", ["turn-001"], "item-bad")] }),
      turns("통증은 3점이에요"),
    );

    expect(result.summary).toEqual(summary());
    expect(result.rejectedItemIds).toEqual(["item-bad"]);
    expect(result.usedFallback).toBe(true);
  });

  it("관련 없는 cited turn의 부정 표현으로 valid item을 verification으로 옮기지 않는다", () => {
    const result = validateSummaryEvidence(
      summary({
        subjective: [
          item("두통이 있어요", ["turn-headache", "turn-vomiting"], "item-headache"),
        ],
      }),
      [
        { id: "turn-headache", question: "증상", answer: "두통이 있어요" },
        { id: "turn-vomiting", question: "구토", answer: "구토는 없어요" },
      ],
    );

    expect(result.summary.subjective).toEqual([
      item("두통이 있어요", ["turn-headache", "turn-vomiting"], "item-headache"),
    ]);
    expect(result.summary.verificationNeeded).toEqual([]);
  });

  it("질문의 오늘·긍정 표현이 부정 답변의 사실 근거가 되지 않는다", () => {
    const source = summary({
      subjective: [
        item("오늘부터 통증이 있어요", ["turn-001"], "item-question-leak"),
      ],
    });

    const result = validateSummaryEvidence(source, [{
      id: "turn-001",
      question: "오늘부터 통증이 있나요?",
      answer: "아니요",
    }]);

    expect(result.summary.subjective).toEqual([]);
    expect(result.summary.verificationNeeded).toEqual([]);
    expect(result.rejectedItemIds).toEqual(["item-question-leak"]);
  });

  it("질문에만 있는 수치와 주체는 답변의 literal evidence로 인정하지 않는다", () => {
    const result = validateSummaryEvidence(
      summary({
        objective: [
          item("아버지의 통증은 3점이에요", ["turn-001"], "item-literal-leak"),
        ],
      }),
      [{
        id: "turn-001",
        question: "아버지의 통증은 3점인가요?",
        answer: "네",
      }],
    );

    expect(result.summary.objective).toEqual([]);
    expect(result.rejectedItemIds).toEqual(["item-literal-leak"]);
  });

  it("질문에만 있는 시간과 주체는 답변의 사실 근거가 되지 않는다", () => {
    const result = validateSummaryEvidence(
      summary({
        subjective: [
          item("오늘 아버지는 당뇨가 있어요", ["turn-001"], "item-semantic-leak"),
        ],
      }),
      [{
        id: "turn-001",
        question: "오늘 아버지의 당뇨 증상을 확인할까요?",
        answer: "당뇨가 있어요",
      }],
    );

    expect(result.summary.subjective).toEqual([]);
    expect(result.rejectedItemIds).toEqual(["item-semantic-leak"]);
  });
});
