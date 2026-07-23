import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 393, height: 852 };
const CHIEF_COMPLAINT = "합성 무릎 통증 기록";

async function completeSyntheticOnboarding(page: Page) {
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
  await page.getByRole("button", { name: "AI 전송 없이 계속" }).click();
  await page.getByLabel("이름").fill("테스트 사용자");
  await page.getByLabel("답하지 않음").check();
  await page.getByRole("button", { name: "기본정보 확인" }).click();
  await page.getByRole("button", { name: "의료정보 준비하기" }).click();
  await page.getByRole("button", { name: "입력을 마치고 확인" }).click();
  await page.getByRole("button", { name: "저장하고 홈으로" }).click();
  await expect(
    page.getByRole("heading", { name: "테스트 사용자님, 안녕하세요" }),
  ).toBeVisible();
}

async function completeManualInterview(page: Page) {
  await page.getByRole("button", { name: "수동 문진 시작하기" }).click();
  await page.getByLabel("답변").fill(CHIEF_COMPLAINT);
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("며칠 전").check();
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("나아졌다가 다시 나타나요").check();
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("많이 불편해요").check();
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("답변").fill("계단을 오를 때 더 불편해요.");
  await page.getByRole("button", { name: "답변 저장" }).click();
  await expect(
    page.getByRole("heading", { name: "작성한 내용을 확인해 주세요" }),
  ).toBeVisible();
  await expect(page.getByText(CHIEF_COMPLAINT)).toBeVisible();
  await page.getByRole("button", { name: "문진 저장 완료" }).click();
  await expect(page.getByRole("status")).toHaveText("문진을 저장했어요.");
  await page.getByRole("button", { name: "홈으로" }).click();
}

async function readCompletedInterviewId(page: Page): Promise<string> {
  return page.evaluate(async ({ chiefComplaint }) => {
    const request = indexedDB.open("koddi-ud-eum", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ["interviews", "messages", "summaries"],
      "readonly",
    );
    const interviewRequest = transaction.objectStore("interviews").getAll();
    const messageRequest = transaction.objectStore("messages").getAll();
    const summaryRequest = transaction.objectStore("summaries").getAll();
    const result = await new Promise<string>((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        const firstAnswer = messageRequest.result.find(
          (message) =>
            message.role === "user" &&
            message.kind === "answer" &&
            message.text === chiefComplaint,
        );
        const interview = interviewRequest.result.find(
          (candidate) =>
            candidate.id === firstAnswer?.interviewId &&
            candidate.status === "completed",
        );
        const summary = summaryRequest.result.find(
          (candidate) =>
            candidate.interviewId === interview?.id &&
            candidate.status === "confirmed",
        );

        if (!interview || !summary) {
          reject(new Error("완료하고 확인한 수동 문진을 찾을 수 없습니다."));
          return;
        }
        resolve(interview.id);
      };
    });
    database.close();
    return result;
  }, { chiefComplaint: CHIEF_COMPLAINT });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

function originalAnswer(page: Page) {
  return page.getByRole("definition").filter({ hasText: CHIEF_COMPLAINT });
}

test.use({ viewport: MOBILE_VIEWPORT });

test("AI 전송 거부 사용자가 실제 완료 기록을 의료진용 화면까지 이어서 연다", async ({
  page,
}) => {
  let aiRequestCount = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/")) {
      aiRequestCount += 1;
    }
  });

  await completeSyntheticOnboarding(page);
  await completeManualInterview(page);
  const completedInterviewId = await readCompletedInterviewId(page);

  await page.getByRole("button", { name: "기록 보기" }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(
    page.getByRole("heading", { name: "나의 문진 기록" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole("link", {
      name: new RegExp(`오늘.*완료.*수동 문진.*${CHIEF_COMPLAINT}`),
    })
    .click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/records/${encodeURIComponent(completedInterviewId)}`);
  await expect(page.getByRole("heading", { name: "문진 기록" })).toBeVisible();
  await expect(originalAnswer(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "의료진에게 보여주기" }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/records/${encodeURIComponent(completedInterviewId)}/clinician`);
  await expect(
    page.getByRole("heading", { name: "의료진 참고용" }),
  ).toBeVisible();
  await page.getByText("원문 질문과 답변", { exact: true }).click();
  await expect(originalAnswer(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expect(aiRequestCount).toBe(0);
});
