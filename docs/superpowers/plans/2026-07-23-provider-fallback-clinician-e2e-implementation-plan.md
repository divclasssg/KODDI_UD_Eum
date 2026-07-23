# Provider Fallback Clinician E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 질문·요약 provider가 실패해도 공개 AI 문진 사용자가 결정론적 복구를 거쳐 완료 기록과 의료진용 화면까지 도달함을 credential-free E2E로 증명한다.

**Architecture:** 제품 서비스와 IndexedDB 스키마는 변경하지 않는다. Playwright가 `/api/ai/question`과 `/api/ai/summary`에 HTTP 503을 반환하고, 기존 AI 서비스의 대체 질문·입력 기반 요약을 통해 같은 `mode: "ai"` 기록을 완료한다. 테스트가 실제 IndexedDB 완료 ID를 읽어 기록 목록, 상세, 의료진용 화면을 하나의 공개 사용자 여정으로 검증한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, IndexedDB, Playwright 1.61.1, npm 11.18.0

## Global Constraints

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 실제 개인정보 대신 합성 이름·생년월일·증상만 사용한다.
- 실제 외부 AI, Modal, GPU를 호출하지 않는다.
- 복구된 기록은 `AI 문진`, 결정론적 요약 출처는 `입력 내용 정리`로 표시한다.
- 제품 서비스와 IndexedDB schema version 1·기존 8개 store는 변경하지 않는다.
- 사용자 소유 `.gitignore` 변경은 stage하거나 commit하지 않는다.
- 관련 Chromium E2E를 먼저 실행하고 전체 E2E는 push 전 최종 통합 지점에서 한 번만 실행한다.
- `npm run test:e2e`가 production build를 포함하므로 같은 tree에서 `npm run build`를 별도로 실행하지 않는다.

---

## File Map

- Modify: `tests/e2e/public-ai-interview.spec.ts`
  - provider 질문·요약 503 복구부터 완료 기록·의료진용 화면까지의 공개 E2E와 완료 ID 조회 helper를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
  - 최상위 다음 작업에서 완료된 provider 복구 항목을 제거한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
  - 현재 상태 설명과 다음 작업을 최신 증거에 맞춘다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md`
  - U6/U7 후속 범위에서 완료된 provider 복구 경로를 제거한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
  - Task 1B provider 복구 항목과 실행 증거를 완료 처리한다.
- Modify: `docs/worklogs/2026-07-22.md`
  - 실제 실행 범위, 결과, 외부 호출 0건을 작업일지에 남긴다.

### Task 1: Provider 503 복구 공개 E2E

**Files:**
- Modify: `tests/e2e/public-ai-interview.spec.ts`
- Test: `tests/e2e/public-ai-interview.spec.ts`

**Interfaces:**
- Consumes: `completeSyntheticOnboarding(page: Page): Promise<void>`, 공개 `/interview/ai`, IndexedDB database `koddi-ud-eum` version 1
- Produces: `readCompletedInterviewId(page: Page, chiefComplaint: string): Promise<string>`와 provider 503 복구 E2E 1건

- [ ] **Step 1: 누락된 인수 시나리오를 RED로 확인**

Run:

```bash
npx playwright test tests/e2e/public-ai-interview.spec.ts --project=chromium --grep "provider 질문과 요약 실패"
```

Expected: FAIL 또는 `No tests found`로 종료한다. 아직 해당 이름과 범위의 공개 인수 테스트가 없다는 증거다. 기존 제품 동작이 이미 구현돼 있으므로 이후 새 테스트가 첫 실행부터 통과하면 제품 코드를 억지로 변경하지 않는다.

- [ ] **Step 2: 완료 기록 ID helper를 테스트 파일에 추가**

`countIndexedDbRecords` 아래에 다음 helper를 추가한다.

```ts
async function readCompletedInterviewId(
  page: Page,
  chiefComplaint: string,
): Promise<string> {
  return page.evaluate(async ({ expectedChiefComplaint }) => {
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
            message.text === expectedChiefComplaint,
        );
        const interview = interviewRequest.result.find(
          (candidate) =>
            candidate.id === firstAnswer?.interviewId &&
            candidate.mode === "ai" &&
            candidate.status === "completed",
        );
        const summary = summaryRequest.result.find(
          (candidate) =>
            candidate.interviewId === interview?.id &&
            candidate.source === "manual" &&
            candidate.status === "confirmed",
        );
        if (!interview || !summary) {
          reject(new Error("완료된 provider 복구 AI 문진을 찾을 수 없습니다."));
          return;
        }
        resolve(interview.id);
      };
    });
    database.close();
    return result;
  }, { expectedChiefComplaint: chiefComplaint });
}
```

- [ ] **Step 3: 질문·요약 503부터 의료진용 화면까지의 테스트를 추가**

`AI 동의 사용자가 V2 질문과 근거 요약을 복원하고 완료한다` 테스트 뒤에 다음 시나리오를 추가한다.

```ts
test("provider 질문과 요약 실패 뒤 입력 기반 기록을 의료진용 화면까지 연다", async ({
  page,
}) => {
  const chiefComplaint = "합성 provider 장애 무릎 통증";
  const fallbackAnswer = "며칠 전";
  let questionRequestCount = 0;
  let summaryRequestCount = 0;

  await page.route("**/api/ai/question", async (route) => {
    questionRequestCount += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "synthetic-provider-unavailable" }),
    });
  });
  await page.route("**/api/ai/summary", async (route) => {
    summaryRequestCount += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "synthetic-provider-unavailable" }),
    });
  });

  await completeSyntheticOnboarding(page);
  await page.getByRole("button", { name: "AI 문진 시작하기" }).click();
  await page.getByLabel("답변").fill(chiefComplaint);
  await page.getByRole("button", { name: "답변 저장" }).click();

  await expect(
    page.getByRole("heading", { name: "언제부터 불편했나요?" }),
  ).toBeVisible();
  await page.getByLabel(fallbackAnswer).check();
  await page.getByRole("button", { name: "답변 저장" }).click();

  await expect(
    page.getByRole("heading", { name: "문진 내용을 확인해 주세요" }),
  ).toBeVisible();
  await expect(
    page.getByText("AI 정리에 문제가 있어 입력한 답변을 기준으로 정리했어요."),
  ).toBeVisible();
  await expect(page.getByText(chiefComplaint)).toBeVisible();
  await expect(page.getByText(fallbackAnswer)).toBeVisible();
  expect(questionRequestCount).toBe(1);
  expect(summaryRequestCount).toBe(1);

  await page.getByRole("button", { name: "문진 저장 완료" }).click();
  await expect(page.getByRole("status")).toHaveText("문진을 저장했어요.");
  const completedInterviewId = await readCompletedInterviewId(
    page,
    chiefComplaint,
  );
  await page.getByRole("button", { name: "홈으로" }).click();
  await page.getByRole("button", { name: "기록 보기" }).click();

  await page
    .getByRole("link", {
      name: new RegExp(`오늘.*완료.*AI 문진.*${chiefComplaint}`),
    })
    .click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/records/${encodeURIComponent(completedInterviewId)}`);
  await expect(page.getByText("입력 내용 정리")).toBeVisible();
  await expect(page.getByRole("definition").filter({
    hasText: chiefComplaint,
  })).toBeVisible();
  await expect(page.getByRole("definition").filter({
    hasText: fallbackAnswer,
  })).toBeVisible();

  await page.getByRole("link", { name: "의료진에게 보여주기" }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/records/${encodeURIComponent(completedInterviewId)}/clinician`);
  await expect(
    page.getByRole("heading", { name: "의료진 참고용" }),
  ).toBeVisible();
  await expect(page.getByText(/AI 문진/)).toBeVisible();
  await expect(page.getByText("입력 내용 정리")).toBeVisible();
  await page.getByText("원문 질문과 답변", { exact: true }).click();
  await expect(page.getByRole("definition").filter({
    hasText: chiefComplaint,
  })).toBeVisible();
  await expect(page.getByRole("definition").filter({
    hasText: fallbackAnswer,
  })).toBeVisible();

  expect(questionRequestCount).toBe(1);
  expect(summaryRequestCount).toBe(1);
});
```

- [ ] **Step 4: 새 E2E를 GREEN으로 확인**

Run:

```bash
npx playwright test tests/e2e/public-ai-interview.spec.ts --project=chromium --grep "provider 질문과 요약 실패"
```

Expected: `1 passed`. 첫 실행에서 제품 코드 변경 없이 통과하면 기존 복구 동작의 누락된 통합 증거가 확보된 것이다. 실패하면 해당 locator 또는 제품 경계를 증거에 따라 최소 수정하고 같은 focused test만 재실행한다.

- [ ] **Step 5: 테스트 변경을 커밋**

```bash
git add tests/e2e/public-ai-interview.spec.ts
git commit -m "test(ai): verify provider fallback clinician journey"
```

Expected: `.gitignore`를 제외한 E2E 파일 1개만 커밋된다.

### Task 2: 체크리스트와 작업일지 동기화

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
- Modify: `docs/worklogs/2026-07-22.md`

**Interfaces:**
- Consumes: Task 1의 focused Chromium 명령과 실제 pass 개수
- Produces: provider 복구 완료 상태, 정확한 E2E 파일·테스트명·외부 호출 범위

- [ ] **Step 1: 상위 현황의 다음 작업을 갱신**

두 현재 상태 문서에서:

```md
- 다음 작업: **provider 실패 수동 문진·scroll 복원 계약과 후순위 U5 speech/U8 photo 결정**
```

을 다음으로 교체한다.

```md
- 다음 작업: **닫기·뒤로가기 뒤 동일 record/scroll 복원 계약과 후순위 U5 speech/U8 photo 결정**
```

`01-status-and-decisions.md`의 현재 앱 설명에는 다음 문장을 추가한다.

```md
질문·요약 provider가 실패하면 같은 AI 문진 안에서 결정론적 대체 질문과 입력 기반 요약으로 복구하며, 완료 기록은 목록·상세·의료진 참고용 화면까지 이어진다.
```

- [ ] **Step 2: Day 5·Day 7 증거를 완료 처리**

`06-day-5-u6-u7.md`의 마지막 문장을 다음으로 교체한다.

```md
남은 계약: 닫기·뒤로가기 뒤 동일 record/scroll 복원은 이번 공개 경로에 포함하지 않았다. provider 질문·요약 실패 복구는 2026-07-23 credential-free Chromium에서 완료 기록과 의료진 참고용 화면까지 검증했다.
```

`08-day-7-verification.md`의 미완료 항목을 다음으로 교체한다.

```md
- [x] Task 1B provider 실패 시 AI 문진 내 결정론적 대체 질문·입력 기반 요약·기록 확인
```

같은 섹션에 focused 명령의 단일 시나리오 결과를 추가한다.

```md
증거(2026-07-23 provider 복구): `public-ai-interview.spec.ts`의 `provider 질문과 요약 실패 뒤 입력 기반 기록을 의료진용 화면까지 연다`가 focused Chromium 1건으로 통과했다. 질문·요약 route는 각각 합성 HTTP 503 1회였고 외부 AI·Modal·GPU 호출 없이 결정론적 대체 질문, `source: "manual"` 요약, completed AI 기록, 동일 ID 상세·의료진 참고용 화면을 확인했다.
```

- [ ] **Step 3: 작업일지에 실행 사실을 추가**

`docs/worklogs/2026-07-22.md` 끝에 다음 섹션을 추가하되 테스트 개수는 실제 출력으로 기록한다.

```md
## U4 provider 장애 복구·의료진 공개 여정 · 2026-07-23

- AI 전송 동의 합성 온보딩에서 질문·요약 route가 각각 HTTP 503을 반환하도록 한 credential-free Chromium을 실행했다.
- 같은 AI 문진에서 `언제부터 불편했나요?` 결정론적 대체 질문으로 계속하고, 입력 답변 기반 `source: "manual"` 요약을 검토·확정해 completed 기록을 저장했다.
- 홈의 기록 목록에서 `AI 문진` 완료 항목을 열고 같은 IndexedDB ID의 상세·의료진 참고용 화면에서 `입력 내용 정리`와 두 원문 답변을 확인했다.
- focused Chromium 1건이 통과했다. 실제 외부 AI·Modal·GPU 호출은 0건이었다.
```

- [ ] **Step 4: 문서 정합성을 검증**

Run:

```bash
rg -n "provider 실패 수동 문진|Task 1B provider 실패|provider 장애 복구" \
  docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md \
  docs/plans/2026-07-16-003-medical-interview-implementation-checklist \
  docs/worklogs/2026-07-22.md
git diff --check
```

Expected: provider 복구를 다음 작업 또는 미완료로 남긴 문구가 없고 `git diff --check`가 exit 0이다. 과거 시점의 사실을 기록한 U7 작업일지 문장은 변경하지 않는다.

- [ ] **Step 5: 문서 변경을 커밋**

```bash
git add \
  docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md \
  docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md \
  docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md \
  docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md \
  docs/worklogs/2026-07-22.md
git commit -m "docs(ai): close provider fallback evidence gap"
```

Expected: `.gitignore`를 제외한 문서 5개만 커밋된다.

### Task 3: 최종 통합 검증과 원격 반영

**Files:**
- Verify only: current branch tree

**Interfaces:**
- Consumes: Task 1 E2E commit, Task 2 문서 commit
- Produces: 현재 tree에 유효한 전체 gate 결과와 원격 `codex/provider-fallback-e2e`

- [ ] **Step 1: 독립적인 비브라우저 gate를 병렬 실행**

Run in parallel:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
```

Expected: 모든 명령 exit 0. 실패하면 전체 gate를 반복하지 않고 실패 파일 또는 관련 test name으로 좁혀 수정한 뒤 이 milestone에서만 다시 전체 결과를 확인한다.

- [ ] **Step 2: 전체 production build·Chromium E2E를 한 번 실행**

Run:

```bash
npm run test:e2e
```

Expected: production build 성공과 모든 Chromium E2E 통과. localhost bind가 sandbox `EPERM`으로만 실패하면 같은 build tree에서 승인된 credential-free Playwright를 재실행한다. 실제 외부 AI·Modal·GPU는 호출하지 않는다.

- [ ] **Step 3: 최종 diff와 커밋 범위를 확인**

Run:

```bash
git diff --check
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: 작업 브랜치에는 설계, 구현 계획, E2E, 증거 문서 커밋만 있고 `.gitignore`는 unstaged 사용자 변경으로 남는다.

- [ ] **Step 4: 현재 브랜치를 push**

```bash
git push -u origin codex/provider-fallback-e2e
```

Expected: 원격 브랜치가 생성 또는 갱신되고 push가 exit 0이다. PR은 사용자가 별도로 요청하지 않으면 만들지 않는다.
