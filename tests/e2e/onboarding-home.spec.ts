import { expect, test, type Page } from "@playwright/test";

async function reachEligibility(page: Page) {
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "계속" }).click();
}

async function reachLocalConsent(page: Page) {
  await reachEligibility(page);
  await page.getByLabel("생년월일").fill("1960-05-20");
  await page.getByRole("button", { name: "확인하고 계속" }).click();
}

test("합성 의료정보를 저장하고 새로고침 뒤 홈을 복원한다", async ({
  page,
}) => {
  const aiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/")) aiRequests.push(request.url());
  });

  await page.goto("/");
  await reachLocalConsent(page);
  await page.getByRole("button", { name: "동의하고 계속" }).click();
  await page
    .getByRole("button", { name: "민감정보 처리에 동의하고 계속" })
    .click();
  await page.getByRole("button", { name: "AI 전송 없이 계속" }).click();
  await page.getByLabel("이름").fill("테스트 사용자");
  await page.getByLabel("답하지 않음").check();
  await page.getByRole("button", { name: "기본정보 확인" }).click();
  await page.getByRole("button", { name: "의료정보 준비하기" }).click();
  await page.getByRole("button", { name: "복용 중인 약" }).click();
  await expect(
    page.getByRole("button", { name: "음성 입력, 준비 중" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "사진 추가, 준비 중" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "이전" }).click();
  await page.getByRole("button", { name: "입력을 마치고 확인" }).click();
  await page.getByRole("button", { name: "저장하고 홈으로" }).click();

  await expect(
    page.getByRole("heading", { name: "테스트 사용자님, 안녕하세요" }),
  ).toBeVisible();
  await expect(page.getByText("외부 AI로 정보를 보내지 않아요.")).toBeVisible();
  expect(aiRequests).toEqual([]);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "테스트 사용자님, 안녕하세요" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /persona|페르소나|fixture/i,
  );
});

test("로컬 저장을 거부하면 database를 만들지 않는다", async ({ page }) => {
  await page.goto("/onboarding");
  await reachLocalConsent(page);
  await page.getByRole("button", { name: "저장하지 않기" }).click();

  await expect(
    page.getByRole("heading", { name: "필수 동의가 필요해요" }),
  ).toBeVisible();
  const databases = await page.evaluate(async () => indexedDB.databases());
  expect(databases.some(({ name }) => name === "koddi-ud-eum")).toBe(false);
});

test("민감정보 처리를 거부하면 database를 만들지 않는다", async ({ page }) => {
  await page.goto("/onboarding");
  await reachLocalConsent(page);
  await page.getByRole("button", { name: "동의하고 계속" }).click();
  await page.getByRole("button", { name: "민감정보 저장하지 않기" }).click();

  const databases = await page.evaluate(async () => indexedDB.databases());
  expect(databases.some(({ name }) => name === "koddi-ud-eum")).toBe(false);
});

test("만 14세 미만은 database를 만들지 않는다", async ({ page }) => {
  await page.goto("/onboarding");
  await reachEligibility(page);
  const underFourteenBirthDate = await page.evaluate(() => {
    const today = new Date();
    const year = today.getFullYear() - 10;
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  await page.getByLabel("생년월일").fill(underFourteenBirthDate);
  await page.getByRole("button", { name: "확인하고 계속" }).click();

  await expect(
    page.getByRole("heading", { name: "만 14세 이상만 이용할 수 있어요" }),
  ).toBeVisible();
  const databases = await page.evaluate(async () => indexedDB.databases());
  expect(databases.some(({ name }) => name === "koddi-ud-eum")).toBe(false);
});
