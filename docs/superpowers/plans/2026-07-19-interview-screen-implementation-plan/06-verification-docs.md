> [상위 계획](../2026-07-19-interview-screen-implementation-plan.md)

### Task 6: 시각·접근성 E2E와 문서

**Files:**
- Create: `tests/e2e/interview-layout.spec.ts`
- Create: `tests/e2e/interview-layout.spec.ts-snapshots/*`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/02-day-1-u1.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md`
- Modify: `docs/worklogs/2026-07-19.md`

**Interfaces:**
- Consumes: production `/interview/new`, 9 fixture URLs, Figma `173:2872`, `173:2916`, `173:3122`
- Produces: 393×852 visual·keyboard·scroll evidence와 완료 기록

- [x] **Step 1: 실패하는 E2E를 작성한다**

```ts
import { expect, test } from "@playwright/test";

test("393×852 앱 화면과 프레임을 유지한다", async ({ page }) => {
  await page.goto("/interview/new?fixture=answering-default");
  await expect(page.getByTestId("app-viewport")).toHaveJSProperty("clientWidth", 393);
  await expect(page.getByTestId("app-viewport")).toHaveJSProperty("clientHeight", 852);
  await expect(page.getByRole("heading", { name: "증상이 시작된 지 얼마나 지났나요?" })).toBeVisible();
  await expect(page).toHaveScreenshot("interview-answering-default.png", { fullPage: true });
});
```

- [x] **Step 2: E2E가 red인지 확인한다**

Run: `npm run test:e2e -- tests/e2e/interview-layout.spec.ts`

Expected: locator 또는 snapshot 부재로 FAIL.

- [x] **Step 3: 상태·keyboard·scroll E2E를 추가한다**

9개 fixture를 순회해 승인 제목과 role을 확인한다. `history-review`에서 scroll 위치 유지와 `최신 질문으로 이동`을 확인한다. Tab·Space·Enter만으로 선택·입력·`다음`·재시도를 수행하고 focus가 프레임 뒤로 빠지지 않는지 확인한다.

- [x] **Step 4: Figma와 프레임을 시각 비교한다**

앱 viewport만 캡처해 Figma `Chat_01_Entry`, `Chat_04`, `Chat_06`과 질문·말풍선·응답 위치를 비교한다. 전체 device 캡처에서는 PNG 개구부, Dynamic Island, 상태바 좌우 여백, 잘림을 확인한다. 차이는 SCSS token과 inset만 조정하고 Figma 오탈자·42dot Sans는 복제하지 않는다.

- [x] **Step 5: snapshot을 승인하고 재실행한다**

Run: `npm run test:e2e -- tests/e2e/interview-layout.spec.ts --update-snapshots`

Expected: snapshot 생성 후 PASS.

Run: `npm run test:e2e -- tests/e2e/interview-layout.spec.ts`

Expected: 재실행 PASS.

- [x] **Step 6: 실제 브라우저 200% 확대를 수동 검증한다**

Chromium 브라우저 메뉴의 페이지 확대를 200%로 설정한다. CSS `zoom`이나 CDP page scale을 대리 증거로 사용하지 않는다. 바깥 문서 scroll과 내부 대화 scroll로 헤더·현재 질문·모든 입력·주요 행동에 접근하고 keyboard focus가 보이는지 캡처한다.

2026-07-19 확인: 자동 키 입력은 macOS 권한으로 실행하지 못했으며 CSS·CDP 확대는 대리 증거로 사용하지 않았다. 사용자가 실제 Chrome 200% 확대에서 바깥·내부 scroll, 입력·주요 행동 접근과 visible focus를 수동 확인했다.

- [x] **Step 7: 전체 gate를 실행한다**

Run:

```bash
npm run test:tokens
npm run test:icons
npm run test:unit
npm run lint
npm run typecheck
npm run test:e2e
npm run build
```

Expected: 모든 명령 종료 코드 0.

- [x] **Step 8: 문서와 체크리스트를 사실만으로 갱신한다**

통과한 항목만 `[x]`로 바꾸고 명령 결과, Figma node, 393×852, 실제 200% 확대 증거를 작업일지에 기록한다. fixture 성공과 실제 IndexedDB·MedGemma 성공을 분리한다.

- [x] **Step 9: 최종 diff를 검토하고 멈춘다**

Run: `git diff --check && git status --short`

Expected: whitespace 오류 없음. 사용자 요청 전 commit·push하지 않는다.
