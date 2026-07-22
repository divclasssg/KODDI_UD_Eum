import { expect, test } from "@playwright/test";

const ACTUAL_ENABLED = process.env.RUN_MEDGEMMA_ROUTE_ACTUAL === "1";

test.skip(!ACTUAL_ENABLED, "브라우저 actual gate는 명시적으로 활성화한다");

test("합성 답변이 인증된 Node Route를 거쳐 다음 질문을 표시한다", async ({
  page,
}) => {
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
