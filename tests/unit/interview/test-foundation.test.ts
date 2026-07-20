import { describe, expect, it } from "vitest";

describe("문진 테스트 기반", () => {
  it("jsdom과 한국어 테스트 이름을 사용한다", () => {
    expect(document.documentElement).toBeInstanceOf(HTMLElement);
  });
});
