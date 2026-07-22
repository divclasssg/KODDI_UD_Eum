import { describe, expect, it } from "vitest";

import {
  initialOnboardingState,
  normalizeMedicalProfile,
  onboardingReducer,
  validateBasicProfile,
  validateEligibility,
} from "@/features/onboarding/onboarding-machine";

describe("onboarding machine", () => {
  it("스플래시와 두 소개 뒤 자격 확인으로 이동한다", () => {
    let state = onboardingReducer(initialOnboardingState, { type: "next" });
    state = onboardingReducer(state, { type: "next" });
    state = onboardingReducer(state, { type: "next" });

    expect(state.step).toBe("eligibility");
  });

  it("만 14세 미만은 자격 차단 상태로 이동한다", () => {
    const state = onboardingReducer(
      { ...initialOnboardingState, step: "eligibility" },
      { type: "reject-eligibility" },
    );

    expect(state.step).toBe("age-blocked");
  });

  it("로컬 저장 거부는 차단 상태로만 이동한다", () => {
    const state = onboardingReducer(
      { ...initialOnboardingState, step: "local-consent" },
      { type: "decide-local-storage", decision: "declined" },
    );

    expect(state.step).toBe("consent-blocked");
  });

  it("AI 전송 거부도 기본정보 입력으로 진행한다", () => {
    const state = onboardingReducer(
      { ...initialOnboardingState, step: "ai-consent" },
      { type: "decide-ai-transfer", decision: "declined" },
    );

    expect(state.step).toBe("basic-profile");
    expect(state.draft.aiTransfer).toBe("declined");
  });

  it("민감정보 처리 거부는 해당 동의 재검토 대상으로 차단한다", () => {
    const state = onboardingReducer(
      { ...initialOnboardingState, step: "sensitive-consent" },
      { type: "decide-sensitive-health", decision: "declined" },
    );
    const reviewed = onboardingReducer(state, { type: "review-consent" });

    expect(state.step).toBe("consent-blocked");
    expect(reviewed.step).toBe("sensitive-consent");
  });

  it("의료정보 항목을 마치면 draft를 보존하고 메뉴로 돌아간다", () => {
    const selected = onboardingReducer(
      { ...initialOnboardingState, step: "medical-menu" },
      { type: "select-medical-category", category: "medications" },
    );
    const edited = onboardingReducer(selected, {
      type: "update-draft",
      value: { medications: "합성 복용약" },
    });
    const finished = onboardingReducer(edited, {
      type: "finish-medical-category",
    });

    expect(finished.step).toBe("medical-menu");
    expect(finished.draft.medications).toBe("합성 복용약");
  });

  it("이전 화면으로 돌아가도 입력을 보존한다", () => {
    const state = onboardingReducer(
      {
        ...initialOnboardingState,
        step: "profile-review",
        draft: {
          ...initialOnboardingState.draft,
          displayName: "테스트 사용자",
        },
      },
      { type: "back" },
    );

    expect(state.step).toBe("basic-profile");
    expect(state.draft.displayName).toBe("테스트 사용자");
  });

  it("정확히 만 14세가 되는 생년월일은 허용한다", () => {
    const now = new Date("2026-07-22T03:00:00.000Z");

    expect(validateEligibility("2012-07-22", now)).toEqual({
      eligible: true,
    });
  });

  it("만 14세 생일 전날에는 차단한다", () => {
    const now = new Date("2026-07-22T03:00:00.000Z");

    expect(validateEligibility("2012-07-23", now)).toEqual({
      eligible: false,
      reason: "under-14",
    });
  });

  it.each(["2011-02-29", "2027-01-01"])(
    "유효하지 않거나 미래인 생년월일 %s를 거부한다",
    (birthDate) => {
      expect(
        validateEligibility(
          birthDate,
          new Date("2026-07-22T03:00:00.000Z"),
        ),
      ).toEqual({ eligible: false, reason: "invalid" });
    },
  );

  it("만 130세를 초과한 생년월일을 거부한다", () => {
    expect(
      validateEligibility(
        "1895-07-22",
        new Date("2026-07-22T03:00:00.000Z"),
      ),
    ).toEqual({ eligible: false, reason: "over-130" });
  });

  it("기본정보에서 생년월일 자격 오류를 표시한다", () => {
    expect(
      validateBasicProfile({
        displayName: "테스트 사용자",
        birthDate: "2012-07-23",
        sex: "unknown",
      }, new Date("2026-07-22T03:00:00.000Z")),
    ).toEqual({
      birthDate: "만 14세 이상만 사용할 수 있어요.",
    });
  });

  it("의료정보 목록의 공백과 중복을 정리한다", () => {
    expect(
      normalizeMedicalProfile({
        conditions: " 합성 질환\n합성 질환\n ",
        conditionsUnknown: false,
        medications: "",
        medicationsUnknown: true,
        allergies: "합성 알레르기",
        allergiesUnknown: false,
        familyHistory: "합성 가족력",
        familyHistoryUnknown: false,
        medicalHistory: "",
        medicalHistoryUnknown: true,
        surgicalHistory: "",
        surgicalHistoryUnknown: true,
        smokingStatus: "no",
        smokingDetails: "",
        alcoholStatus: "yes",
        alcoholDetails: "합성 빈도",
        heightCm: "170",
        weightKg: "65",
      }),
    ).toEqual({
      ok: true,
      value: {
        conditions: { state: "known", values: ["합성 질환"] },
        medications: { state: "unknown" },
        allergies: { state: "known", values: ["합성 알레르기"] },
        familyHistory: { state: "known", values: ["합성 가족력"] },
        medicalHistory: { state: "unknown" },
        surgicalHistory: { state: "unknown" },
        smoking: { state: "no" },
        alcohol: { state: "yes", details: "합성 빈도" },
        heightCm: 170,
        weightKg: 65,
      },
    });
  });
});
