import { expect, test, type Page } from "@playwright/test";

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

async function answerRemainingManualQuestions(page: Page, suffix: string) {
  await page.getByLabel("며칠 전").check();
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("나아졌다가 다시 나타나요").check();
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("많이 불편해요").check();
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByLabel("답변").fill(`합성 추가 내용 ${suffix}`);
  await page.getByRole("button", { name: "답변 저장" }).click();
  await expect(
    page.getByRole("heading", { name: "작성한 내용을 확인해 주세요" }),
  ).toBeVisible();
}

async function completeManualInterview(page: Page, suffix: string) {
  await page.getByRole("button", { name: "수동 문진 시작하기" }).click();
  await page.getByLabel("답변").fill(`합성 두통 ${suffix}`);
  await page.getByRole("button", { name: "답변 저장" }).click();
  await answerRemainingManualQuestions(page, suffix);
  await page.getByRole("button", { name: "문진 저장 완료" }).click();
  await page.getByRole("button", { name: "홈으로" }).click();
}

async function readFirstCompletedRecordId(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("koddi-ud-eum", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("interviews", "readonly");
    const records = transaction.objectStore("interviews").getAll();
    const result = await new Promise<string>((resolve, reject) => {
      transaction.oncomplete = () => {
        const completed = records.result.find(
          ({ status }) => status === "completed",
        );
        if (completed) {
          resolve(completed.id);
        } else {
          reject(new Error("completed record missing"));
        }
      };
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return result;
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

test("AI 거부 사용자가 수동 문진을 새로고침 복원하고 완료한다", async ({
  page,
}) => {
  const externalOperationRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:ai|media|stt)\//.test(request.url())) {
      externalOperationRequests.push(request.url());
    }
  });
  await completeSyntheticOnboarding(page);

  await page.getByRole("button", { name: "수동 문진 시작하기" }).click();
  await page.getByLabel("답변").fill("합성 두통 복원");
  await page.getByRole("button", { name: "답변 저장" }).click();
  await expect(page.getByRole("heading", { name: "언제부터 불편했나요?" })).toBeVisible();
  await page.getByRole("tab", { name: "직접 입력" }).click();
  await page.getByLabel("답변").fill("합성 기간 전환 메모");
  await page.getByRole("tab", { name: "기간 선택" }).click();
  await page.getByLabel("며칠 전").check();
  await expect(page.locator("section[aria-busy='true']")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "언제부터 불편했나요?" })).toBeVisible();
  await expect(page.getByLabel("며칠 전")).toBeChecked();
  await page.getByRole("tab", { name: "직접 입력" }).click();
  await expect(page.getByLabel("답변")).toHaveValue("합성 기간 전환 메모");
  await page.getByRole("tab", { name: "기간 선택" }).click();

  await answerRemainingManualQuestions(page, "복원");
  await expect(page.getByText("합성 두통 복원")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(
    /persona|페르소나|fixture|1\/5|20%/i,
  );
  await page.getByRole("button", { name: "문진 저장 완료" }).click();
  await expect(page.getByRole("status")).toHaveText("문진을 저장했어요.");
  expect(externalOperationRequests).toEqual([]);
});

test("프로필 수정은 과거 snapshot을 바꾸지 않고 새 완료 기록에만 반영한다", async ({
  page,
}) => {
  const externalOperationRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:ai|media|stt)\//.test(request.url())) {
      externalOperationRequests.push(request.url());
    }
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await completeSyntheticOnboarding(page);
  await completeManualInterview(page, "첫 기록");

  const firstRecordId = await readFirstCompletedRecordId(page);
  await page.getByRole("button", { name: "기록 보기" }).click();
  await page.getByRole("link", { name: /기록 열기/ }).first().click();
  await expect(page).toHaveURL(
    new RegExp(`/records/${encodeURIComponent(firstRecordId)}$`),
  );
  await page.getByRole("link", { name: "내 정보 수정" }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel("이름").fill("수정한 테스트 사용자");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/records/${encodeURIComponent(firstRecordId)}$`),
  );
  await expect(
    page.getByRole("heading", { name: "문진 기록" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/home");
  await completeManualInterview(page, "둘째 기록");

  const names = await page.evaluate(async () => {
    const request = indexedDB.open("koddi-ud-eum", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["profiles", "interviews"], "readonly");
    const profileRequest = transaction.objectStore("profiles").get("default");
    const interviewRequest = transaction.objectStore("interviews").getAll();
    const result = await new Promise<{ current: string; snapshots: string[] }>((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve({
        current: profileRequest.result.displayName,
        snapshots: interviewRequest.result
          .filter(({ status }) => status === "completed")
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
          .map(({ profileSnapshot }) => profileSnapshot.profile.displayName),
      });
    });
    database.close();
    return result;
  });

  expect(names).toEqual({
    current: "수정한 테스트 사용자",
    snapshots: ["테스트 사용자", "수정한 테스트 사용자"],
  });
  expect(externalOperationRequests).toEqual([]);
});

test("전체 삭제는 8개 store를 비운 뒤 온보딩으로 돌아간다", async ({ page }) => {
  await completeSyntheticOnboarding(page);
  await page.getByRole("button", { name: "수동 문진 시작하기" }).click();
  await page.getByLabel("답변").fill("합성 삭제 전 답변");
  await page.getByRole("button", { name: "답변 저장" }).click();
  await page.getByRole("button", { name: "나중에 계속하기" }).click();
  await page.getByRole("button", { name: "저장된 정보 모두 삭제" }).click();
  await page.getByRole("button", { name: "모든 정보 삭제" }).click();
  await page.getByRole("button", { name: "삭제 확인" }).click();
  await expect(page.getByRole("status")).toHaveText("삭제를 완료했어요.");

  const counts = await page.evaluate(async () => {
    const request = indexedDB.open("koddi-ud-eum", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = Array.from(database.objectStoreNames);
    const transaction = database.transaction(names, "readonly");
    const requests = names.map((name) => transaction.objectStore(name).count());
    const result = await new Promise<number[]>((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(requests.map(({ result: count }) => count));
    });
    database.close();
    return result;
  });
  expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

  await page.getByRole("button", { name: "처음부터 시작하기" }).click();
  await expect(page.getByRole("heading", { name: "병원 문진, 더 쉽고 편하게." })).toBeVisible();
});
