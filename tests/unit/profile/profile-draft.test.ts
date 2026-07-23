import { describe, expect, it } from "vitest";

import {
  isProfileDraftDirty,
  profileBundleToDraft,
  validateProfileDraft,
} from "@/features/profile/profile-draft";
import {
  toUtcTimestamp,
  type ProfileBundleV1,
} from "@/lib/db/contracts";

const SYNTHETIC_PROFILE_BUNDLE: ProfileBundleV1 = {
  profile: {
    id: "default",
    schemaVersion: 1,
    displayName: "테스트 사용자",
    birthDate: "1960-05-20",
    sex: "unknown",
    updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
  medicalProfile: {
    id: "default",
    schemaVersion: 1,
    conditions: { state: "known", values: ["합성 만성질환"] },
    medications: { state: "unknown" },
    allergies: { state: "known", values: ["합성 알레르기"] },
    familyHistory: { state: "unknown" },
    medicalHistory: { state: "known", values: ["합성 병력"] },
    surgicalHistory: { state: "unknown" },
    smoking: { state: "no" },
    alcohol: { state: "yes", details: "합성 빈도" },
    heightCm: 170,
    weightKg: 65,
    updatedAt: toUtcTimestamp("2026-07-22T01:00:00.000Z"),
  },
};

describe("profile draft", () => {
  it("동일 draft는 clean이다", () => {
    const baseline = profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE);

    expect(isProfileDraftDirty(baseline, structuredClone(baseline))).toBe(
      false,
    );
  });

  it.each([
    ["displayName", "수정한 사용자"],
    ["conditions", "합성 변경 질환"],
    ["conditionsUnknown", true],
    ["smokingStatus", "yes"],
    ["heightCm", "171"],
  ] as const)("%s 변경을 dirty로 판정한다", (key, value) => {
    const baseline = profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE);

    expect(isProfileDraftDirty(baseline, { ...baseline, [key]: value })).toBe(
      true,
    );
  });

  it("저장 record를 손실 없이 편집 draft로 바꾼다", () => {
    const draft = profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE);

    expect(draft.displayName).toBe("테스트 사용자");
    expect(draft.conditions).toBe("합성 만성질환");
    expect(draft.medicationsUnknown).toBe(true);
    expect(draft.alcoholDetails).toBe("합성 빈도");
    expect(draft.heightCm).toBe("170");
  });

  it("프로필 수정에서 만 14세 미만을 저장 input으로 만들지 않는다", () => {
    const result = validateProfileDraft(
      {
        ...profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE),
        birthDate: "2012-07-23",
      },
      new Date("2026-07-22T03:00:00.000Z"),
      toUtcTimestamp("2026-07-22T03:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      errors: { birthDate: "만 14세 이상만 사용할 수 있어요." },
    });
  });

  it("두 profile record에 동일한 UTC timestamp를 사용한다", () => {
    const updatedAt = toUtcTimestamp("2026-07-22T03:00:00.000Z");
    const result = validateProfileDraft(
      profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE),
      new Date("2026-07-22T03:00:00.000Z"),
      updatedAt,
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        profile: { updatedAt },
        medicalProfile: { updatedAt },
      },
    });
  });
});
