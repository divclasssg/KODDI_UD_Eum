import { expect, test } from "@playwright/test";

const FIXTURE_STATES = [
  ["answering-default", "증상이 시작된 지 얼마나 지났나요?", "heading"],
  ["history-review", "증상이 시작된 지 얼마나 지났나요?", "heading"],
  ["saving-delayed", "답변을 저장하고 있어요", "status"],
  ["waiting-for-ai", "다음 질문을 준비하고 있어요", "status"],
  ["save-error", "답변을 저장하지 못했어요", "alert"],
  ["ai-error", "다음 질문을 불러오지 못했어요", "alert"],
  ["safety-caution", "주의가 필요한 답변이 있어요", "status"],
  ["safety-urgent", "위험 신호가 있어요", "alert"],
  ["summary-transition", "문진 내용을 정리하고 있어요", "status"],
] as const;

test("393×852 앱 화면과 프레임을 유지한다", async ({ page }) => {
  await page.goto("/interview/new?fixture=answering-default");

  const viewport = page.getByTestId("app-viewport");
  await expect(viewport).toHaveJSProperty("clientWidth", 393);
  await expect(viewport).toHaveJSProperty("clientHeight", 852);
  await expect(
    page.getByRole("heading", {
      name: "증상이 시작된 지 얼마나 지났나요?",
    }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("interview-answering-default.png", {
    fullPage: true,
  });
});

for (const [fixtureId, title, role] of FIXTURE_STATES) {
  test(`${fixtureId} fixture를 직접 표시한다`, async ({ page }) => {
    await page.goto(`/interview/new?fixture=${fixtureId}`);

    const state = page.getByRole(role).filter({ hasText: title });
    await expect(state).toContainText(title);
    await expect(state).toBeVisible();
  });
}

test("긴 대화를 검토한 뒤 최신 질문으로 복귀한다", async ({ page }) => {
  await page.goto("/interview/new?fixture=history-review");

  const log = page.getByRole("log", { name: "문진 대화" });
  await log.evaluate((element) => element.scrollTo({ top: 0 }));
  await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(0);

  await page.getByRole("button", { name: "최신 질문으로 이동" }).click();

  await expect
    .poll(() => log.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("heading", {
      name: "증상이 시작된 지 얼마나 지났나요?",
    }),
  ).toBeFocused();
});

test("키보드만으로 답변을 선택하고 제출한다", async ({ page }) => {
  await page.goto("/interview/new?fixture=answering-default");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "오늘" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio", { name: "오늘" })).toBeChecked();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "직접 입력" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "음성으로 답하기" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "다음" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText(
    "답변을 저장하고 있어요",
  );
  await expect
    .poll(() =>
      page
        .getByTestId("app-viewport")
        .evaluate((viewport) => viewport.contains(document.activeElement)),
    )
    .toBe(true);
});

test("키보드만으로 AI 오류를 재시도한다", async ({ page }) => {
  await page.goto("/interview/new?fixture=ai-error");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "다시 질문 받기" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("status")).toContainText(
    "다음 질문을 준비하고 있어요",
  );
  await expect(
    page.getByRole("heading", { name: "증상은 계속 이어지나요?" }),
  ).toBeVisible();
});

test("대표 상태의 앱 viewport를 시각 비교한다", async ({ page }) => {
  for (const fixtureId of [
    "answering-default",
    "history-review",
    "safety-urgent",
  ]) {
    await page.goto(`/interview/new?fixture=${fixtureId}`);
    await expect(page.getByTestId("app-viewport")).toHaveScreenshot(
      `interview-${fixtureId}-viewport.png`,
    );
  }
});
