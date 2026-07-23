import { describe, expect, it } from "vitest";
import {
  buildProfileEditHref,
  normalizeProfileReturnTo,
} from "@/features/profile/profile-navigation";

describe("profile navigation", () => {
  it.each([
    ["/records/completed-record", "/records/completed-record"],
    ["/records/record%2F한글", "/records/record%2F한글"],
  ])("허용된 기록 상세 %s를 유지한다", (value, expected) => {
    expect(normalizeProfileReturnTo(value)).toBe(expected);
  });

  it.each([
    undefined,
    ["/records/one", "/records/two"],
    "",
    "/records/",
    "/records/id/clinician",
    "/records/id?tab=profile",
    "//example.com/records/id",
    "https://example.com/records/id",
    String.raw`\records\id`,
    "/records/%E0%A4%A",
  ])("허용되지 않은 복귀 경로는 홈으로 보낸다", (value) => {
    expect(normalizeProfileReturnTo(value)).toBe("/home");
  });

  it("인코딩된 동일 기록 profile href를 만든다", () => {
    expect(buildProfileEditHref("record/한글")).toBe(
      "/profile?returnTo=%2Frecords%2Frecord%252F%25ED%2595%259C%25EA%25B8%2580",
    );
  });
});
