> [상위 계획](../2026-07-21-u1-completion-gates-implementation-plan.md)

### Task 2: 브라우저→Node Route actual gate

**Files:**
- Create: `playwright.actual.config.ts`
- Create: `tests/actual/modal-route.actual.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `/interview/new?persona=kim`, `/api/ai/question`, server-only MedGemma 환경 계약
- Produces: `npm run test:route-actual`, opt-in Playwright 질문 1회 gate

- [x] **Step 1: Next.js 16 런타임 문서를 다시 읽는다**

Read completely:

```text
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
node_modules/next/dist/docs/01-app/02-guides/data-security.md
node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
```

확인할 계약은 Route Handler의 비캐시 POST, server-only credential, request-time env와 cookie 변경 위치다. Route Handler 제품 코드는 변경하지 않는다.

- [x] **Step 2: opt-in actual Playwright test를 작성한다**

`tests/actual/modal-route.actual.spec.ts`는 본문을 읽거나 출력하지 않고 status와 화면 전환만 확인한다.

```ts
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
```

- [x] **Step 3: actual 전용 config와 script를 추가한다**

`playwright.actual.config.ts`는 `tests/actual/*.actual.spec.ts`만 수집하고 민감한 네트워크 artifact를 남기지 않는다.

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/actual",
  testMatch: "**/*.actual.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3101",
    reuseExistingServer: false,
    url: "http://127.0.0.1:3101",
  },
});
```

`package.json`에 다음 script를 추가한다. dependency가 바뀌지 않으므로 lockfile은 수정하지 않는다.

```json
"test:route-actual": "next build --webpack && playwright test --config playwright.actual.config.ts"
```

- [x] **Step 4: credential 없는 opt-out gate를 확인한다**

Run: `npm run test:route-actual`

Expected: build PASS, Playwright 1건 명시적 SKIP, Modal 호출 0건.

- [x] **Step 5: 일반 E2E와 정적 검증 회귀를 확인한다**

Run: `npm run lint && npm run typecheck && npm run test:e2e`

Expected: lint·typecheck PASS, 기존 Chromium E2E 14건과 primary 계약 추가분 PASS.

- [ ] **Step 6: 사용자 요청이 있을 때만 커밋한다**

```text
git add package.json playwright.actual.config.ts tests/actual/modal-route.actual.spec.ts
git commit -m "test(ai): add browser route actual gate"
```
