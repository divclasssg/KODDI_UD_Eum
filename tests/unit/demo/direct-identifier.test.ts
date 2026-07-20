import { describe, expect, it } from "vitest";

import { findDirectIdentifier } from "@/lib/demo/direct-identifier";

describe("데모 입력의 직접 식별정보 표지 탐지", () => {
  it.each([
    ["010-1234-5678로 연락해 주세요", "phone"],
    ["메일은 demo.person@example.com입니다", "email"],
    ["주민번호는 900101-1234567입니다", "resident-id"],
    ["서울시 강남구 역삼동에 살아요", "named-place"],
    ["한국대학교병원에서 진료받았어요", "named-place"],
  ] as const)("%s의 직접 식별정보 종류만 반환한다", (text, expected) => {
    expect(findDirectIdentifier(text)).toBe(expected);
  });

  it.each([
    "오늘 아침부터 머리가 아파요",
    "어지럽고 속이 메스꺼워요",
    "복용 중인 약은 없어요",
  ])("일반적인 건강 서술을 직접 식별정보라고 단정하지 않는다", (text) => {
    expect(findDirectIdentifier(text)).toBeUndefined();
  });
});
