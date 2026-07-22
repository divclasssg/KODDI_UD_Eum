import { describe, expect, it } from "vitest";

import actualConfig from "../../../playwright.actual.config";

describe("브라우저 actual 서버 설정", () => {
  it("운영 기본값을 바꾸지 않고 브라우저 왕복에 provider 상한을 사용한다", () => {
    const webServer = actualConfig.webServer;
    expect(webServer).toBeDefined();
    expect(Array.isArray(webServer)).toBe(false);
    if (!webServer || Array.isArray(webServer)) return;

    expect(webServer.env).toMatchObject({
      MEDGEMMA_TIMEOUT_MS: "85000",
    });
  });
});
