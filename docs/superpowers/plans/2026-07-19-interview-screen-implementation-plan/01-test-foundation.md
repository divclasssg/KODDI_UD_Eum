> [상위 계획](../2026-07-19-interview-screen-implementation-plan.md)

### Task 1: 테스트 기반과 실행 계약

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `tests/unit/interview/test-foundation.test.ts`

**Interfaces:**
- Consumes: Node 22.17.0, npm 11.18.0, Next.js 16.2.10
- Produces: `npm run test:unit`, `npm run test:e2e`, jsdom unit 환경, production Chromium E2E 환경

- [x] **Step 1: 테스트 의존성을 설치한다**

Run:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test
npx playwright install chromium
```

Expected: `package-lock.json`이 갱신되고 Chromium 설치가 종료 코드 0으로 끝난다. `postcss`·`autoprefixer` 직접 의존성은 생기지 않는다.

- [x] **Step 2: package script를 추가한다**

`package.json`의 `scripts`에 다음을 추가한다.

```json
"test:unit": "vitest run",
"test:e2e": "npm run build && playwright test"
```

- [x] **Step 3: Vitest 설정과 첫 계약 테스트를 작성한다**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

```ts
// tests/unit/interview/test-foundation.test.ts
import { describe, expect, it } from "vitest";

describe("문진 테스트 기반", () => {
  it("jsdom과 한국어 테스트 이름을 사용한다", () => {
    expect(document.documentElement).toBeInstanceOf(HTMLElement);
  });
});
```

- [x] **Step 4: Playwright를 production server 기준으로 설정한다**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "env INTERVIEW_FIXTURE_MODE=1 npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  },
});
```

- [x] **Step 5: 기반 테스트를 검증한다**

Run: `npm run test:unit -- tests/unit/interview/test-foundation.test.ts`

Expected: 1 test PASS.

Run: `npm run lint && npm run typecheck`

Expected: 두 명령 종료 코드 0.

- [x] **Step 6: 검토 지점을 기록한다**

`git diff -- package.json package-lock.json vitest.config.ts vitest.setup.ts playwright.config.ts tests/unit/interview/test-foundation.test.ts`로 범위를 확인한다. commit·push는 하지 않는다.
