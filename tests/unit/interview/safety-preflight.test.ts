import { describe, expect, it } from "vitest";

import { runSafetyPreflight } from "@/features/interview/domain/safety-preflight";

describe("safety preflight", () => {
  it.each([
    ["지금 숨을 쉬기가 매우 힘들어요.", "breathing"],
    ["지금 숨을 쉬기가 매우 힘들어요. 무릎은 괜찮아요.", "breathing"],
    ["지금 숨을 쉬기가 매우 힘들고 무릎은 괜찮아요.", "breathing"],
    ["현재 가족이 의식을 잃고 반응이 없어요.", "unresponsive"],
    ["지금 의식 소실 상태예요.", "unresponsive"],
    ["지금 피가 심하게 나고 멈추지 않아요.", "bleeding"],
    ["지금 즉시 도움이 필요해요.", "explicit-help"],
  ] as const)("현재의 명시적 위험 신호를 urgent로 분류한다: %s", (text, reason) => {
    expect(runSafetyPreflight(text)).toEqual({ kind: "urgent", reason });
  });

  it.each([
    "지금 의식을 잃었어요.",
    "현재 가족이 의식을 잃었고 반응이 없어요.",
  ])("명시적 현재 표지가 있는 의식 완료형은 urgent다: %s", (text) => {
    expect(runSafetyPreflight(text)).toEqual({
      kind: "urgent",
      reason: "unresponsive",
    });
  });

  it.each([
    "지금 숨쉬기가 힘들지 않고 괜찮아요.",
    "지금 호흡 곤란은 없고 괜찮아요.",
    "의식을 잃은 건 아니고 반응도 있어요.",
    "현재 반응 없음은 아니에요.",
    "출혈은 심하지 않고 이미 멈췄어요.",
    "즉시 도움은 필요 없어요.",
  ])("같은 짧은 절의 부정 표현은 urgent로 분류하지 않는다: %s", (text) => {
    expect(runSafetyPreflight(text)).toEqual({ kind: "none" });
  });

  it.each([
    "어제는 숨을 쉬기가 매우 힘들었어요.",
    "예전에 의식을 잃은 적이 있어요.",
    "숨쉬기가 조금 힘든 것 같아요.",
    "출혈이 멈췄는지 잘 모르겠어요.",
  ])("과거 또는 모호한 위험 표현은 확인 필요로 남긴다: %s", (text) => {
    expect(runSafetyPreflight(text)).toEqual({ kind: "verification-needed" });
  });

  it("위험 표현이 없는 일반 답변은 none이다", () => {
    expect(runSafetyPreflight("오늘부터 무릎이 조금 불편해요.")).toEqual({
      kind: "none",
    });
  });

  it.each([
    "지금 숨을 쉬기가 매우 힘들어요, 무릎은 괜찮아요.",
    "지금 숨을 쉬기가 매우 힘들어요. 어제는 무릎이 아팠어요.",
  ])("다른 절의 부정·과거 표현이 현재 urgent 절을 상쇄하지 않는다: %s", (text) => {
    expect(runSafetyPreflight(text)).toEqual({
      kind: "urgent",
      reason: "breathing",
    });
  });

  it("다른 절의 현재 표지가 과거형 위험 절을 urgent로 올리지 않는다", () => {
    expect(
      runSafetyPreflight("숨을 쉬기가 매우 힘들었어요. 지금은 무릎이 아파요."),
    ).toEqual({ kind: "verification-needed" });
  });

  it.each([
    "지금 출혈이 멈추지 않아요.",
    "지금 출혈이 심해요.",
  ])("출혈은 심함과 지속이 모두 같은 절에 있어야 urgent다: %s", (text) => {
    expect(runSafetyPreflight(text)).toEqual({ kind: "verification-needed" });
  });

  it.each([
    [
      "지금 숨을 쉬기가 매우 힘들고 지금 무릎은 괜찮아요.",
      { kind: "urgent", reason: "breathing" },
    ],
    [
      "지금 숨을 쉬기가 매우 힘들고 괜찮은 무릎을 움직여요.",
      { kind: "urgent", reason: "breathing" },
    ],
    [
      "지금 피가 심하고 출혈이 멈추지 않아요.",
      { kind: "urgent", reason: "bleeding" },
    ],
    [
      "지금 숨쉬기가 힘들지 않고 호흡은 괜찮아요.",
      { kind: "none" },
    ],
    [
      "어제 숨을 쉬기가 매우 힘들었고 지금 무릎은 괜찮아요.",
      { kind: "verification-needed" },
    ],
    [
      "지금 피가 심해요. 출혈이 멈추지 않아요.",
      { kind: "verification-needed" },
    ],
  ] as const)("sentence 안의 category-local observation만 결합한다: %s", (text, expected) => {
    expect(runSafetyPreflight(text)).toEqual(expected);
  });
});
