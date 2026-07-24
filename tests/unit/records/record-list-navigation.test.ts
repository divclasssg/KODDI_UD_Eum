import { describe, expect, it } from "vitest";

import {
  recordIdFromListHash,
  recordListAnchorId,
  recordListHref,
} from "@/features/records/record-list-navigation";

describe("record list navigation", () => {
  it("opaque record ID를 canonical anchor와 목록 href로 만든다", () => {
    expect(recordListAnchorId("record/한글 ?")).toBe(
      "record-record%2F%ED%95%9C%EA%B8%80%20%3F",
    );
    expect(recordListHref("record/한글 ?")).toBe(
      "/records#record-record%2F%ED%95%9C%EA%B8%80%20%3F",
    );
  });

  it("canonical record fragment만 원래 ID로 해석한다", () => {
    expect(
      recordIdFromListHash("#record-record%2F%ED%95%9C%EA%B8%80%20%3F"),
    ).toBe("record/한글 ?");
    expect(recordIdFromListHash("#other-record")).toBeUndefined();
    expect(recordIdFromListHash("#record-")).toBeUndefined();
    expect(recordIdFromListHash("#record-%E0%A4%A")).toBeUndefined();
    expect(recordIdFromListHash("#record-record%2fvalue")).toBeUndefined();
  });
});
