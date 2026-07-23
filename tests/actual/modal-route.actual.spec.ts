import { expect, test } from "@playwright/test";

import {
  annotateKillSwitchRecovery,
  MODAL_ROUTE_ACTUAL_ENABLED,
  MODAL_ROUTE_ACTUAL_SKIP_REASON,
} from "./modal-route-actual-safety";

test.skip(!MODAL_ROUTE_ACTUAL_ENABLED, MODAL_ROUTE_ACTUAL_SKIP_REASON);

test("합성 답변이 인증된 Node Route를 거쳐 다음 질문을 표시한다", async ({
  page,
}, testInfo) => {
  annotateKillSwitchRecovery(testInfo);
  test.setTimeout(120_000);
  await page.goto("/interview/new?persona=kim");

  await page
    .getByRole("checkbox", {
      name: "가상 인물로 체험하며 실제 정보를 입력하지 않겠습니다",
    })
    .check();
  await page.getByRole("radio", { name: "두통" }).check();

  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/ai/question" &&
      response.request().method() === "POST",
    { timeout: 90_000 },
  );
  await page.getByRole("button", { name: "다음" }).click();

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "어디가 불편하신가요?" }),
  ).not.toBeVisible({ timeout: 90_000 });
  await expect(page.locator('[id^="interview-question-"]')).toBeVisible();
});
