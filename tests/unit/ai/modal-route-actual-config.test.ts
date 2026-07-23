import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import actualConfig from "../../../playwright.actual.config";

describe("브라우저 actual 서버 설정", () => {
  it("정적 페이지 빌드에도 후속 질문 1회 제한을 주입한다", () => {
    const packageJson = JSON.parse(
      readFileSync("package.json", "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["test:route-actual"]).toContain(
      "PUBLIC_AI_MAX_FOLLOW_UPS=1 next build --webpack",
    );
  });

  it("운영 기본값을 바꾸지 않고 브라우저 왕복에 provider 상한을 사용한다", () => {
    const webServer = actualConfig.webServer;
    expect(webServer).toBeDefined();
    expect(Array.isArray(webServer)).toBe(false);
    if (!webServer || Array.isArray(webServer)) return;

    expect(webServer.env).toMatchObject({
      MEDGEMMA_TIMEOUT_MS: "180000",
      PUBLIC_AI_MAX_FOLLOW_UPS: "1",
    });
  });

  it("credential과 요청 본문을 브라우저 artifact에 남기지 않는다", () => {
    expect(actualConfig.use).toMatchObject({
      screenshot: "off",
      trace: "off",
      video: "off",
    });
  });
});
