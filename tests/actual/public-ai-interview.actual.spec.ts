import { expect, test, type Page } from "@playwright/test";

import {
  annotateKillSwitchRecovery,
  MODAL_ROUTE_ACTUAL_ENABLED,
  MODAL_ROUTE_ACTUAL_SKIP_REASON,
} from "./modal-route-actual-safety";

test.skip(!MODAL_ROUTE_ACTUAL_ENABLED, MODAL_ROUTE_ACTUAL_SKIP_REASON);

async function completeSyntheticAiOnboarding(page: Page) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "계속" }).click();
  await page.getByLabel("생년월일").fill("1960-05-20");
  await page.getByRole("button", { name: "확인하고 계속" }).click();
  await page.getByRole("button", { name: "동의하고 계속" }).click();
  await page
    .getByRole("button", { name: "민감정보 처리에 동의하고 계속" })
    .click();
  await page
    .getByRole("button", { name: "AI 전송에 동의하고 계속" })
    .click();
  await page.getByLabel("이름").fill("합성 사용자");
  await page.getByLabel("답하지 않음").check();
  await page.getByRole("button", { name: "기본정보 확인" }).click();
  await page.getByRole("button", { name: "의료정보 준비하기" }).click();
  await page.getByRole("button", { name: "입력을 마치고 확인" }).click();
  await page.getByRole("button", { name: "저장하고 홈으로" }).click();
  await expect(
    page.getByRole("heading", { name: "합성 사용자님, 안녕하세요" }),
  ).toBeVisible();
}

test("공개 UI가 실제 질문 1회와 실제 근거 요약 1회를 표시한다", async ({
  page,
}, testInfo) => {
  annotateKillSwitchRecovery(testInfo);
  test.setTimeout(420_000);
  let questionRequests = 0;
  let summaryRequests = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/ai/question") questionRequests += 1;
    if (pathname === "/api/ai/summary") summaryRequests += 1;
  });

  await completeSyntheticAiOnboarding(page);
  await page.getByRole("button", { name: "AI 문진 시작하기" }).click();
  const firstQuestion = page.getByRole("heading", {
    name: "지금 가장 불편한 점을 적어 주세요.",
  });
  await expect(firstQuestion).toBeVisible();
  await page.getByLabel("답변").fill("합성 상황에서 무릎이 불편해요.");

  const questionResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/ai/question" &&
      response.request().method() === "POST",
    { timeout: 185_000 },
  );
  await page.getByRole("button", { name: "답변 저장" }).click();
  expect((await questionResponse).status()).toBe(200);
  await expect(firstQuestion).not.toBeVisible({ timeout: 185_000 });
  await expect(page.locator("main h1")).toBeVisible();
  const actualQuestion = (await page.locator("main h1").innerText()).trim();

  const generatedQuestionId = await page.evaluate(async () => {
    const request = indexedDB.open("koddi-ud-eum", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("interviews", "readonly");
    const records = transaction.objectStore("interviews").getAll();
    const result = await new Promise<string>((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        const interview = records.result.find(({ mode }) => mode === "ai");
        const questions = interview?.questionSetSnapshot.questions ?? [];
        resolve(questions.at(-1)?.id ?? "missing-generated-question");
      };
    });
    database.close();
    return result;
  });
  expect(generatedQuestionId).not.toContain("fallback");
  expect(questionRequests).toBe(1);

  const generatedOption = page.getByRole("radio").first();
  await expect(generatedOption).toBeVisible();
  await generatedOption.check();
  const summaryResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/ai/summary" &&
      response.request().method() === "POST",
    { timeout: 185_000 },
  );
  await page.getByRole("button", { name: "답변 저장" }).click();
  expect((await summaryResponse).status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "문진 내용을 확인해 주세요" }),
  ).toBeVisible({ timeout: 185_000 });
  await expect(page.getByText("AI가 답변을 정리했어요.")).toBeVisible();
  await expect(page.locator("ul li").first()).toBeVisible();
  const actualSummaryItems = (await page.locator("main ul li").allInnerTexts()).map(
    (item) => item.trim(),
  );
  process.stdout.write(
    `[public-actual-ui-response] ${JSON.stringify({
      question: actualQuestion,
      summaryItems: actualSummaryItems,
    })}\n`,
  );
  expect(questionRequests).toBe(1);
  expect(summaryRequests).toBe(1);
});
