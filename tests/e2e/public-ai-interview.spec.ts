import { expect, test, type Page } from "@playwright/test";

type PublicAiContext = {
  version: "2";
  interviewId: string;
  currentSlot?: string;
  filledSlots: Record<string, string>;
  recentTurns: { id: string; question: string; answer: string }[];
};

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

function expectPublicAllowlist(payload: PublicAiContext) {
  expect(payload.version).toBe("2");
  expect(payload).toEqual({
    version: "2",
    interviewId: expect.any(String),
    currentSlot: expect.any(String),
    filledSlots: expect.any(Object),
    recentTurns: expect.any(Array),
  });
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(
    /"(?:personaId|profile|name|displayName|birthDate)"\s*:/i,
  );
  expect(serialized).not.toContain("합성 사용자");
  expect(serialized).not.toContain("1960-05-20");
}

async function countIndexedDbRecords(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("koddi-ud-eum", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = Array.from(database.objectStoreNames);
    const transaction = database.transaction(names, "readonly");
    const requests = names.map((name) => transaction.objectStore(name).count());
    const result = await new Promise<Record<string, number>>((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () =>
        resolve(
          Object.fromEntries(
            names.map((name, index) => [name, requests[index]?.result ?? -1]),
          ),
        );
    });
    database.close();
    return result;
  });
}

test("AI 동의 사용자가 V2 질문과 근거 요약을 복원하고 완료한다", async ({
  page,
}) => {
  const questionPayloads: PublicAiContext[] = [];
  const summaryPayloads: PublicAiContext[] = [];

  await page.route("**/api/ai/question", async (route) => {
    const payload = route.request().postDataJSON() as PublicAiContext;
    questionPayloads.push(payload);
    if (questionPayloads.length === 1) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          version: "2",
          kind: "question",
          question: {
            id: "generated-duration-001",
            slot: "duration",
            text: "무릎 불편함은 언제부터 이어졌나요?",
            selection: "single",
            options: [
              { id: "today", label: "오늘부터" },
              { id: "unknown", label: "잘 모르겠어요" },
            ],
          },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ version: "2", kind: "complete" }),
    });
  });
  await page.route("**/api/ai/summary", async (route) => {
    const payload = route.request().postDataJSON() as PublicAiContext;
    summaryPayloads.push(payload);
    const evidenceTurnIds = payload.recentTurns.map(({ id }) => id);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version: "2",
        kind: "summary",
        summary: {
          subjective: [
            {
              id: "summary-subjective-001",
              text: "무릎이 어제부터 아파요.",
              evidenceTurnIds: [evidenceTurnIds[0]],
            },
          ],
          objective: [],
          verificationNeeded: [],
        },
      }),
    });
  });

  await completeSyntheticOnboarding(page);
  await page.getByRole("button", { name: "AI 문진 시작하기" }).click();
  await page.getByLabel("답변").fill("무릎이 어제부터 아파요.");
  await page.getByRole("button", { name: "답변 저장" }).click();

  await expect(
    page.getByRole("heading", { name: "무릎 불편함은 언제부터 이어졌나요?" }),
  ).toBeVisible();
  expect(questionPayloads).toHaveLength(1);
  expectPublicAllowlist(questionPayloads[0]!);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "무릎 불편함은 언제부터 이어졌나요?" }),
  ).toBeVisible();
  await page.getByLabel("오늘부터").check();
  await page.getByRole("button", { name: "답변 저장" }).click();

  await expect(
    page.getByRole("heading", { name: "문진 내용을 확인해 주세요" }),
  ).toBeVisible();
  await expect(page.getByText("AI가 답변을 정리했어요.")).toBeVisible();
  await expect(page.getByText("무릎이 어제부터 아파요.")).toBeVisible();
  expect(questionPayloads).toHaveLength(2);
  expect(summaryPayloads).toHaveLength(1);
  expect(summaryPayloads[0]?.recentTurns).toHaveLength(2);
  await expect(
    page.getByRole("link", { name: /공유|의료진/i }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "문진 저장 완료" }).click();
  await expect(page.getByRole("status")).toHaveText("문진을 저장했어요.");
  await expect(
    page.getByRole("heading", { name: "의료진에게 보여줄 내용을 준비했어요" }),
  ).toBeVisible();
});

test("전체 삭제 뒤 늦은 AI 응답은 UI와 IndexedDB를 바꾸지 않는다", async ({
  context,
  page,
}) => {
  let releaseResponse!: () => void;
  const responseReleased = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let markRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  let markRouteFulfilled!: () => void;
  let markRouteFailed!: (reason: unknown) => void;
  const routeFulfilled = new Promise<void>((resolve, reject) => {
    markRouteFulfilled = resolve;
    markRouteFailed = reject;
  });

  await page.route("**/api/ai/question", async (route) => {
    markRequestStarted();
    await responseReleased;
    try {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          version: "2",
          kind: "question",
          question: {
            id: "late-question-001",
            slot: "duration",
            text: "늦게 도착한 질문이 보이나요?",
            selection: "single",
            options: [{ id: "unknown", label: "잘 모르겠어요" }],
          },
        }),
      });
      markRouteFulfilled();
    } catch (error) {
      markRouteFailed(error);
    }
  });

  await completeSyntheticOnboarding(page);
  await page.getByRole("button", { name: "AI 문진 시작하기" }).click();
  const aiDocumentMarker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    document.documentElement.dataset.aiDocumentMarker = marker;
    return marker;
  });
  await page.getByLabel("답변").fill("합성 무릎 불편");
  await page.getByRole("button", { name: "답변 저장" }).click();
  await requestStarted;

  const resetPage = await context.newPage();
  await resetPage.goto("/settings/data");
  await resetPage.getByRole("button", { name: "모든 정보 삭제" }).click();
  await resetPage.getByRole("button", { name: "삭제 확인" }).click();
  await expect(resetPage.getByRole("status")).toHaveText("삭제를 완료했어요.");
  const resetBaseline = await countIndexedDbRecords(resetPage);
  expect(resetBaseline).toEqual({
    attachments: 0,
    consents: 0,
    interviewDrafts: 0,
    interviews: 0,
    medicalProfiles: 0,
    messages: 0,
    profiles: 0,
    summaries: 0,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.aiDocumentMarker,
    ),
  ).toBe(aiDocumentMarker);

  const lateResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/ai/question" &&
      response.request().method() === "POST",
  );
  releaseResponse();
  await routeFulfilled;
  const response = await lateResponse;
  expect(response.status()).toBe(200);
  expect(await response.finished()).toBeNull();
  await expect(
    page.getByRole("heading", { name: "AI 요청을 완료하지 못했어요" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.aiDocumentMarker,
    ),
  ).toBe(aiDocumentMarker);

  await expect(resetPage.getByRole("status")).toHaveText("삭제를 완료했어요.");
  await expect(page.getByText("늦게 도착한 질문이 보이나요?")).toHaveCount(0);
  await expect(page.getByText("AI가 답변을 정리했어요.")).toHaveCount(0);
  await expect(resetPage.getByText("늦게 도착한 질문이 보이나요?")).toHaveCount(0);
  await expect(resetPage.getByText("AI가 답변을 정리했어요.")).toHaveCount(0);
  expect(await countIndexedDbRecords(resetPage)).toEqual(resetBaseline);
  expect(await countIndexedDbRecords(page)).toEqual(resetBaseline);
});
