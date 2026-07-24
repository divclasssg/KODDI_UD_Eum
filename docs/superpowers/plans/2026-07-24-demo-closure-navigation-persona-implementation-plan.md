# Demo Closure Navigation and Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기록 목록 복원, 요구사항 현황 정합성, 음성·사진 후순위 결정, credential-free Persona 7/9 검증으로 공개 데모의 남은 핵심 경계를 마감한다.

**Architecture:** 기록 복원은 브라우저 history scroll과 URL fragment 기반 record anchor를 사용하며 새 저장소를 만들지 않는다. R1~R20은 정확한 요구 문장과 현재 증거를 대조해 14/20 완료로 분류하고 U5·U8은 후순위로 고정한다. Persona 검증은 실제 공개 UI와 IndexedDB를 사용하되 수동 문진만 사용해 외부 AI·GPU·media·STT 요청을 0으로 유지한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, IndexedDB v1, Vitest 4.1.10, Testing Library, Playwright 1.61.1, SCSS Modules

## Global Constraints

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- record ID, profile, medical content를 `sessionStorage`, localStorage, cookie, 로그에 새로 저장하지 않는다.
- IndexedDB version 1과 기존 8개 store를 변경하지 않는다.
- 브라우저 Back·swipe를 가로채는 `popstate` sentinel을 추가하지 않는다.
- `/interview/new`는 개발 fixture·시각 회귀 전용 route로 유지하고 공개 경로로 승격하지 않는다.
- U5 모의 음성·TTS와 U8 사진은 구현하지 않고 후순위·conditional-disabled로 기록한다.
- Persona 결과는 `7/9 통과, 2/9 후순위`로만 표시한다.
- 합성 이름·생년월일·증상만 사용한다.
- 실제 AI·Modal·GPU·media·STT를 호출하지 않는다.
- 관련 unit·Chromium을 먼저 실행하고 전체 E2E는 push 전 최종 통합 지점에서 한 번만 실행한다.
- `npm run test:e2e`가 production build를 포함하므로 같은 tree에서 `npm run build`를 별도로 반복하지 않는다.

---

## File Map

- Create: `src/features/records/record-list-navigation.ts`
  - record anchor ID, 목록 href, fragment 해석의 순수 계약을 소유한다.
- Modify: `src/features/records/record-list.tsx`
  - ready 목록의 anchor 렌더링과 비동기 fragment scroll·focus 복원을 소유한다.
- Modify: `src/features/records/record-detail.tsx`
  - ready record의 anchor 포함 목록 복귀 링크를 제공한다.
- Create: `tests/unit/records/record-list-navigation.test.ts`
  - opaque·한글·reserved character ID와 손상 fragment 계약을 검증한다.
- Modify: `tests/unit/records/record-list.test.tsx`
  - ready 뒤 fragment 대상 scroll·focus와 invalid fragment 무시를 검증한다.
- Modify: `tests/unit/records/record-detail.test.tsx`
  - ready record의 목록 href에 canonical anchor가 포함되는지 검증한다.
- Modify: `tests/e2e/manual-profile-reset.spec.ts`
  - 복수 완료 기록에서 browser Back scroll과 앱 링크 focus 복원을 검증한다.
- Create: `tests/e2e/persona-accessibility.spec.ts`
  - 음성 비의존 Persona 7개 조합과 공통 접근성·외부 요청 0건을 검증한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
  - P0 14/20, unit 6/9, 다음 작업과 신규 설계·계획 링크를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
  - R1~R20 증거표와 현재 단계·차단·후순위 경계를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/05-day-4-u5-u6.md`
  - U5 후순위 결정과 재개 gate를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md`
  - 기록 복원·과거 기록·reset 회귀 증거를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md`
  - U8 conditional-disabled와 Persona 7/9·2/9 결과를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
  - 최종 접근성·E2E gate 수치를 소유한다.
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md`
  - 음성·사진 재개 조건과 작업일지 결과를 소유한다.
- Modify: `docs/worklogs/2026-07-22.md`
  - 데모 마감 구현·검증 이력을 소유한다.

### Task 1: Record Anchor Pure Contract

**Files:**
- Create: `src/features/records/record-list-navigation.ts`
- Create: `tests/unit/records/record-list-navigation.test.ts`

**Interfaces:**
- Produces: `recordListAnchorId(interviewId: string): string`
- Produces: `recordListHref(interviewId: string): string`
- Produces: `recordIdFromListHash(hash: string): string | undefined`

- [ ] **Step 1: Write the failing pure contract tests**

```ts
import { describe, expect, it } from "vitest";

import {
  recordIdFromListHash,
  recordListAnchorId,
  recordListHref,
} from "@/features/records/record-list-navigation";

describe("record list navigation", () => {
  it("opaque record ID를 canonical anchor와 목록 href로 만든다", () => {
    expect(recordListAnchorId("record/한글 ?")).toBe(
      "record-record%2F%ED%95%9C%EA%B8%80%20%3F",
    );
    expect(recordListHref("record/한글 ?")).toBe(
      "/records#record-record%2F%ED%95%9C%EA%B8%80%20%3F",
    );
  });

  it("canonical record fragment만 원래 ID로 해석한다", () => {
    expect(
      recordIdFromListHash("#record-record%2F%ED%95%9C%EA%B8%80%20%3F"),
    ).toBe("record/한글 ?");
    expect(recordIdFromListHash("#other-record")).toBeUndefined();
    expect(recordIdFromListHash("#record-")).toBeUndefined();
    expect(recordIdFromListHash("#record-%E0%A4%A")).toBeUndefined();
    expect(recordIdFromListHash("#record-record%2fvalue")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm run test:unit -- tests/unit/records/record-list-navigation.test.ts
```

Expected: FAIL because `record-list-navigation` does not exist.

- [ ] **Step 3: Implement the minimal pure module**

```ts
const RECORD_LIST_ANCHOR_PREFIX = "record-";

export function recordListAnchorId(interviewId: string): string {
  return `${RECORD_LIST_ANCHOR_PREFIX}${encodeURIComponent(interviewId)}`;
}

export function recordListHref(interviewId: string): string {
  return `/records#${recordListAnchorId(interviewId)}`;
}

export function recordIdFromListHash(hash: string): string | undefined {
  const prefix = `#${RECORD_LIST_ANCHOR_PREFIX}`;
  if (!hash.startsWith(prefix)) return undefined;
  const encoded = hash.slice(prefix.length);
  if (!encoded) return undefined;
  try {
    const interviewId = decodeURIComponent(encoded);
    return recordListAnchorId(interviewId) === hash.slice(1)
      ? interviewId
      : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: Run GREEN and diff check**

```bash
npm run test:unit -- tests/unit/records/record-list-navigation.test.ts
git diff --check
```

Expected: 1 file and 2 tests pass; diff check exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/records/record-list-navigation.ts tests/unit/records/record-list-navigation.test.ts
git commit -m "feat(records): define stable list return anchors"
```

### Task 2: Record List Scroll and Focus Restoration

**Files:**
- Modify: `src/features/records/record-list.tsx`
- Modify: `src/features/records/record-detail.tsx`
- Modify: `tests/unit/records/record-list.test.tsx`
- Modify: `tests/unit/records/record-detail.test.tsx`

**Interfaces:**
- Consumes: Task 1 `recordListAnchorId()`, `recordListHref()`, `recordIdFromListHash()`
- Produces: ready record links with stable DOM IDs and ready detail list-return hrefs

- [ ] **Step 1: Add failing component tests**

Add `scrollIntoView` instrumentation to `record-list.test.tsx`:

```ts
const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  window.history.replaceState({}, "", "/records");
});
```

Add tests:

```ts
it("ready 뒤 fragment 대상 기록으로 스크롤하고 focus한다", async () => {
  window.history.replaceState(
    {},
    "",
    `/records#record-${encodeURIComponent(READY_RECORD.id)}`,
  );
  renderState({ status: "ready", records: [READY_RECORD] });

  const recordLink = await screen.findByRole("link", {
    name: /무릎이 불편해요/,
  });
  await waitFor(() => expect(recordLink).toHaveFocus());
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
});

it("손상되거나 목록에 없는 fragment는 scroll과 focus를 바꾸지 않는다", async () => {
  window.history.replaceState({}, "", "/records#record-missing");
  renderState({ status: "ready", records: [READY_RECORD] });

  const recordLink = await screen.findByRole("link", {
    name: /무릎이 불편해요/,
  });
  expect(recordLink).not.toHaveFocus();
  expect(scrollIntoView).not.toHaveBeenCalled();
});
```

Change the ready detail assertion in `record-detail.test.tsx`:

```ts
expect(screen.getByRole("link", { name: "기록 목록으로" })).toHaveAttribute(
  "href",
  `/records#record-${encodeURIComponent(READY_RECORD.id)}`,
);
```

- [ ] **Step 2: Run RED**

```bash
npm run test:unit -- tests/unit/records/record-list.test.tsx tests/unit/records/record-detail.test.tsx
```

Expected: fragment focus and detail href assertions fail.

- [ ] **Step 3: Integrate anchor restoration in the list**

Add imports:

```ts
import {
  recordIdFromListHash,
  recordListAnchorId,
} from "./record-list-navigation";
```

Add this effect after the loader effect:

```ts
useEffect(() => {
  if (state.status !== "ready") return;
  const interviewId = recordIdFromListHash(window.location.hash);
  if (
    !interviewId ||
    !state.records.some((record) => record.id === interviewId)
  ) {
    return;
  }
  const target = document.getElementById(recordListAnchorId(interviewId));
  if (!(target instanceof HTMLAnchorElement)) return;
  target.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
}, [state]);
```

Give each ready record link its anchor:

```tsx
<Link
  className={styles.recordLink}
  href={`/records/${encodeURIComponent(record.id)}`}
  id={recordListAnchorId(record.id)}
>
```

- [ ] **Step 4: Use the anchor href from ready detail**

Import `recordListHref` and change only the ready record list link:

```tsx
<Link
  className={styles.secondaryLink}
  href={recordListHref(record.id)}
>
  기록 목록으로
</Link>
```

Keep not-found, corrupt, and error links as plain `/records`.

- [ ] **Step 5: Run GREEN**

```bash
npm run test:unit -- tests/unit/records/record-list-navigation.test.ts tests/unit/records/record-list.test.tsx tests/unit/records/record-detail.test.tsx
git diff --check
```

Expected: all three unit files pass and diff check exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/records/record-list.tsx src/features/records/record-detail.tsx tests/unit/records/record-list.test.tsx tests/unit/records/record-detail.test.tsx
git commit -m "feat(records): restore selected record on list return"
```

### Task 3: Browser Back and App-Link Chromium Evidence

**Files:**
- Modify: `tests/e2e/manual-profile-reset.spec.ts`

**Interfaces:**
- Consumes: Task 2 ready record anchor and detail return href
- Produces: mobile multi-record browser Back scroll and explicit-link focus evidence

- [ ] **Step 1: Add the focused E2E**

Append:

```ts
test("기록 상세에서 목록 위치와 선택한 기록으로 돌아간다", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const externalOperationRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:ai|media|stt)\//.test(request.url())) {
      externalOperationRequests.push(request.url());
    }
  });

  await completeSyntheticOnboarding(page);
  for (let index = 0; index < 6; index += 1) {
    await completeManualInterview(page, `복귀 ${index}`);
  }
  await page.getByRole("button", { name: "기록 보기" }).click();

  const target = page.getByRole("link", { name: /합성 두통 복귀 0/ });
  await target.scrollIntoViewIfNeeded();
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
  expect(scrollBeforeOpen).toBeGreaterThan(0);
  await target.click();
  await expect(page.getByRole("heading", { name: "문진 기록" })).toBeVisible();

  await page.goBack();
  await expect(target).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(
    Math.abs(
      (await page.evaluate(() => window.scrollY)) - scrollBeforeOpen,
    ),
  ).toBeLessThanOrEqual(160);

  await target.click();
  await page.getByRole("link", { name: "기록 목록으로" }).click();
  await expect(target).toBeVisible();
  await expect(target).toBeFocused();

  await target.click();
  await page.getByRole("link", { name: "의료진에게 보여주기" }).click();
  await page.getByRole("link", { name: "기록 상세로 돌아가기" }).click();
  await page.getByRole("link", { name: "기록 목록으로" }).click();
  await expect(target).toBeFocused();
  expect(externalOperationRequests).toEqual([]);
});
```

- [ ] **Step 2: Run RED before Tasks 1–2 if executing independently**

On an implementation sequence where Tasks 1–2 are not present, the focused test must fail on the explicit-link focus assertion. In the required sequential execution, use the Task 2 RED component evidence as the behavior RED and run this E2E immediately after Task 2.

Run:

```bash
npx playwright test tests/e2e/manual-profile-reset.spec.ts --project=chromium --grep "목록 위치와 선택한 기록"
```

Expected after Task 2: 1 passed. If browser Back scroll is outside the 160px tolerance, inspect the actual history behavior and adjust only the assertion strategy; do not add browser-history interception or persistent storage.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/manual-profile-reset.spec.ts
git commit -m "test(records): verify list return restoration"
```

### Task 4: R1–R20 and Unit Status Evidence Audit

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md`

**Interfaces:**
- Consumes: Task 3 record restoration evidence and existing repository tests/docs
- Produces: P0 `14/20 완료`, unit `6/9 완료`, exact requirement evidence table

- [ ] **Step 1: Add the exact R1–R20 status table**

Add this table to `01-status-and-decisions.md`:

```md
## R1~R20 P0 증거 현황

| ID | 상태 | 직접 증거 또는 남은 차이 |
|---|---|---|
| R1 | 완료 | Next.js 16.2.10·TypeScript·ESLint·React Compiler·`src`·App Router·`@/*` 구성과 build gate |
| R2 | 부분 | SCSS token 계층은 구현됐으나 CSS Module consumer 이름은 camelCase를 포함해 원문의 하이픈 규칙 전체와 불일치 |
| R3 | 완료 | 393×852 onboarding→문진→기록→clinician→profile 공개 Chromium |
| R4 | 완료 | 18px·48px token 계약, visible focus, non-color label, status·alert와 keyboard E2E |
| R5 | 완료 | 쉬운 한국어, AI 질문 한 개, 상태별 primary CTA 계약 |
| R6 | 완료 | 로컬 저장·민감정보·AI 전송 동의와 AI 비동의 manual 외부 요청 0건 |
| R7 | 완료 | 기본·의료정보 입력, 현재 profile 수정, 과거 snapshot 불변 |
| R8 | 부분 | text·choice·chip 계약은 공개 문진에 연결됐지만 measurement 질문은 공개 question set에 없음 |
| R9 | 후순위 | 모의 음성 입력 미구현 |
| R10 | 완료 | 질문별 draft·입력 mode 전환·reload 복원 |
| R11 | 부분 | 실제 MedGemma 공개 성공은 있으나 현재 follow-up 상한 3이 원문 4~5개와 불일치 |
| R12 | 완료 | schema·금지 표현·중복·질문형·쉬운 문장 validator |
| R13 | 완료 | AI 호출 전 urgent preflight와 안전 종료 기록 |
| R14 | 부분 | 근거 summary 검토·확정은 구현됐지만 사용자 summary item 수정은 미구현 |
| R15 | 완료 | provider 질문·요약 실패 뒤 입력 보존·결정론적 완주·clinician 기록 |
| R16 | 후순위 | 사용자 실행형 TTS 미구현 |
| R17 | 완료 | Asia/Seoul 오늘·시간·상태·주요 증상·완료 우선 최신순 |
| R18 | 완료 | record detail·원문·completed-only clinician view |
| R19 | 완료 | 과거 record 상세→현재 profile 수정→같은 record 복귀 |
| R20 | 완료 | 8개 store 원자 reset과 stale AI·timer 쓰기 폐기 |
```

Set both dashboards to:

```md
- 구현 진행률: **6/9 units**
- P0 요구사항: **14/20 검증 완료**
```

- [ ] **Step 2: Close verified U6/U7 checklist items**

In `06-day-5-u6-u7.md`, set these to complete with evidence:

```md
- [x] 닫기·뒤로가기 뒤 동일 record/scroll 복귀
- [x] 과거 기록 날짜·주요 증상 식별
...
- [x] reset·stale response 회귀 통과
```

Add Task 3 test name and focused command as record-return evidence.

- [ ] **Step 3: Link the new spec and plan and update current stage**

Add the 2026-07-24 design and implementation plan links to the root dashboard. Set current stage to:

```md
- 현재 단계: **데모 마감 진행 — 기록 복원 완료, 현황·후순위·Persona gate 정리**
```

Do not mark U5, U8, or U9 complete.

- [ ] **Step 4: Validate documentation**

```bash
rg -n "14/20|6/9|R1~R20|record/scroll" docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist
git diff --check
```

Expected: both dashboards report 14/20 and 6/9; all 20 requirement rows exist; diff check exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md
git commit -m "docs(status): reconcile P0 and record restoration evidence"
```

### Task 5: Freeze Speech and Photo as Deferred

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/05-day-4-u5-u6.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md`

**Interfaces:**
- Consumes: Task 4 R9·R16 deferred and U5/U8 incomplete statuses
- Produces: explicit resume gates and no false completion

- [ ] **Step 1: Replace ambiguous U5 wording**

Use:

```md
U5 모의 음성·TTS는 2026-07-24 데모 범위에서 후순위로 확정했다. 실제 마이크·녹음·STT뿐 아니라 합성 transcript UI와 사용자 실행형 TTS도 구현하지 않는다. R9·R16, 김영수 Task 1 TTS, 박성훈 Task 1 음성 입력은 완료로 세지 않는다.

재개 gate: speech interaction 계약 승인, local `ko-KR` voice 지원 범위, 입력·TTS 상호배타, timer·unmount·navigation·reset 취소, keyboard·screen reader·hidden content 검증 계획이 모두 있어야 한다.
```

- [ ] **Step 2: Mark U8 conditional-disabled without checking implementation boxes**

Add:

```md
U8 사진은 conditional-disabled다. capability flag는 활성화하지 않고 공개 UI를 숨긴다. MIME·magic byte·크기·dimension, EXIF 제거·재인코딩, object URL revoke, attachment·reset lifecycle, multimodal validator와 actual gate가 모두 계획·구현·승인되기 전에는 노출하지 않는다.
```

Keep all implementation checkboxes unchecked and explicitly labeled `후순위`.

- [ ] **Step 3: Add deferred log rows**

Add rows to `09-deferred-and-logs.md`:

```md
| 2026-07-24 | U5 모의 음성·TTS | 후순위 | speech interaction·취소·접근성 계약 미승인, R9·R16 미완료 | 별도 speech milestone 승인 시 |
| 2026-07-24 | U8 사진·multimodal | conditional-disabled | 전체 보안·파일 lifecycle·actual gate 전 UI 숨김 | 별도 photo milestone 승인 시 |
```

- [ ] **Step 4: Validate and commit**

```bash
rg -n "후순위|conditional-disabled|R9|R16|김영수 Task 1|박성훈 Task 1" docs/plans/2026-07-16-003-medical-interview-implementation-checklist/05-day-4-u5-u6.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md
git diff --check
git add docs/plans/2026-07-16-003-medical-interview-implementation-checklist/05-day-4-u5-u6.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md
git commit -m "docs(scope): defer speech and photo milestones"
```

### Task 6: Credential-Free Persona 7/9 Accessibility Matrix

**Files:**
- Create: `tests/e2e/persona-accessibility.spec.ts`

**Interfaces:**
- Produces: seven independently reported Task combinations and external operation request count 0
- Consumes: public onboarding, manual interview, records, clinician, profile, Task 2 record anchor restoration

- [ ] **Step 1: Define synthetic-only Persona cases and common assertions**

Create the file with these contracts:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";

type PersonaCase = {
  id: "youngsu" | "minjeong" | "seonghun";
  publicName: string;
  complaint: string;
};

const PERSONAS: readonly PersonaCase[] = [
  { id: "youngsu", publicName: "합성 사용자 가", complaint: "합성 허리 불편" },
  { id: "minjeong", publicName: "합성 사용자 나", complaint: "합성 무릎 불편" },
  { id: "seonghun", publicName: "합성 사용자 다", complaint: "합성 손목 불편" },
];

const PRIVATE_TEST_LABELS = /김영수|이민정|박성훈|persona|fixture|페르소나/i;

function trackExternalOperations(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:ai|media|stt)\//.test(request.url())) {
      requests.push(request.url());
    }
  });
  return requests;
}

async function expectPublicOnly(page: Page) {
  expect(await page.locator("body").innerText()).not.toMatch(PRIVATE_TEST_LABELS);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(48);
}

async function tabTo(page: Page, target: Locator, maximumTabs = 120) {
  for (let count = 0; count < maximumTabs; count += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`키보드 Tab으로 ${maximumTabs}회 안에 대상에 도달하지 못했습니다.`);
}
```

- [ ] **Step 2: Add explicit public journey helpers**

Add these helpers below the common assertions:

```ts
async function activate(
  page: Page,
  target: Locator,
  keyboard: boolean,
  key: "Enter" | "Space" = "Enter",
) {
  if (!keyboard) {
    await target.click();
    return;
  }
  await tabTo(page, target);
  await expect(target).toBeFocused();
  await page.keyboard.press(key);
}

async function completeOnboarding(page: Page, persona: PersonaCase) {
  await page.setViewportSize({ width: 393, height: 852 });
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
  await page.getByLabel("이름").fill(persona.publicName);
  await page.getByLabel("답하지 않음").check();
  await page.getByRole("button", { name: "기본정보 확인" }).click();
  await page.getByRole("button", { name: "의료정보 준비하기" }).click();
  await page.getByRole("button", { name: "입력을 마치고 확인" }).click();
  await page.getByRole("button", { name: "저장하고 홈으로" }).click();
  await expect(
    page.getByRole("heading", {
      name: `${persona.publicName}님, 안녕하세요`,
    }),
  ).toBeVisible();
}

async function completeManualInterview(
  page: Page,
  complaint: string,
  suffix: string,
  keyboard: boolean,
) {
  await activate(
    page,
    page.getByRole("button", { name: "수동 문진 시작하기" }),
    keyboard,
  );

  const firstAnswer = page.getByLabel("답변");
  if (keyboard) {
    await tabTo(page, firstAnswer);
    await page.keyboard.type(`${complaint} ${suffix}`);
  } else {
    await firstAnswer.fill(`${complaint} ${suffix}`);
  }
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );

  await activate(page, page.getByLabel("며칠 전"), keyboard, "Space");
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );
  await activate(
    page,
    page.getByLabel("나아졌다가 다시 나타나요"),
    keyboard,
    "Space",
  );
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );
  await activate(page, page.getByLabel("많이 불편해요"), keyboard, "Space");
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );

  const finalAnswer = page.getByLabel("답변");
  if (keyboard) {
    await tabTo(page, finalAnswer);
    await page.keyboard.type(`합성 추가 내용 ${suffix}`);
  } else {
    await finalAnswer.fill(`합성 추가 내용 ${suffix}`);
  }
  await activate(
    page,
    page.getByRole("button", { name: "답변 저장" }),
    keyboard,
  );
  await expect(
    page.getByRole("heading", { name: "작성한 내용을 확인해 주세요" }),
  ).toBeVisible();
  await activate(
    page,
    page.getByRole("button", { name: "문진 저장 완료" }),
    keyboard,
  );
  await expect(
    page.getByRole("status").filter({ hasText: "문진을 저장했어요." }),
  ).toBeVisible();
}

async function returnHome(page: Page) {
  await page.getByRole("button", { name: "홈으로" }).click();
}

async function editCurrentProfile(
  page: Page,
  nextName: string,
  keyboard: boolean,
) {
  const editLink = page.getByRole("link", { name: "내 정보 수정" });
  await activate(page, editLink, keyboard);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/profile");

  const name = page.getByLabel("이름");
  if (keyboard) {
    await tabTo(page, name);
    await expect(name).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(nextName);
  } else {
    await name.fill(nextName);
  }

  await activate(
    page,
    page.getByRole("button", { name: "변경사항 저장" }),
    keyboard,
  );
  await expect(
    page.getByRole("heading", { name: "문진 기록" }),
  ).toBeVisible();
}
```

The helper intentionally leaves a completed interview on its confirmation screen. Each test calls `returnHome()` when it needs the public home route.

- [ ] **Step 3: Add the single Task 1 case**

```ts
test("이민정 기준 Task 1 공개 온보딩과 문진을 keyboard로 완료한다", async ({
  page,
}) => {
  const persona = PERSONAS[1]!;
  const requests = trackExternalOperations(page);
  await completeOnboarding(page, persona);
  await completeManualInterview(page, persona.complaint, "Task 1", true);
  await expect(
    page.getByRole("status").filter({ hasText: "문진을 저장했어요." }),
  ).toBeVisible();
  await expectPublicOnly(page);
  expect(requests).toEqual([]);
});
```

The final boolean requires the interview controls and submit actions to use `tabTo()` and keyboard activation.

- [ ] **Step 4: Add three Task 2 cases**

```ts
for (const persona of PERSONAS) {
  test(`${persona.id} 기준 Task 2 오늘 기록을 의료진용 화면까지 연다`, async ({
    page,
  }) => {
    const requests = trackExternalOperations(page);
    await completeOnboarding(page, persona);
    await completeManualInterview(page, persona.complaint, "Task 2", false);
    await returnHome(page);
    await page.getByRole("button", { name: "기록 보기" }).click();
    const record = page.getByRole("link", { name: new RegExp(persona.complaint) });
    await expect(record).toContainText("완료");
    await expect(record).toContainText("수동 문진");
    await expectTouchTarget(record);
    await record.click();
    const clinician = page.getByRole("link", { name: "의료진에게 보여주기" });
    await expectTouchTarget(clinician);
    await clinician.click();
    await expect(page.getByRole("heading", { name: "의료진 참고용" })).toBeVisible();
    await expectPublicOnly(page);
    expect(requests).toEqual([]);
  });
}
```

- [ ] **Step 5: Add three Task 3 cases**

```ts
for (const persona of PERSONAS) {
  test(`${persona.id} 기준 Task 3 과거 기록에서 현재 정보를 수정한다`, async ({
    page,
  }) => {
    const requests = trackExternalOperations(page);
    await completeOnboarding(page, persona);
    await completeManualInterview(page, persona.complaint, "과거", false);
    await returnHome(page);
    await completeManualInterview(page, persona.complaint, "최신", false);
    await returnHome(page);
    await page.getByRole("button", { name: "기록 보기" }).click();
    const past = page.getByRole("link", {
      name: new RegExp(`${persona.complaint} 과거`),
    });
    await past.click();
    await editCurrentProfile(
      page,
      `${persona.publicName} 수정`,
      persona.id === "seonghun",
    );
    await expect(page.getByRole("heading", { name: "문진 기록" })).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "변경사항을 저장했어요." }),
    ).toBeVisible();
    await expectPublicOnly(page);
    expect(requests).toEqual([]);
  });
}
```

- [ ] **Step 6: Run the matrix**

```bash
npx playwright test tests/e2e/persona-accessibility.spec.ts --project=chromium
```

Expected: exactly 7 passed. If a selector or helper fails, narrow to the failing test name and preserve the public route and zero-external-request constraints.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/persona-accessibility.spec.ts
git commit -m "test(persona): verify seven credential-free public tasks"
```

### Task 7: Final Persona Evidence, Gates, and Push

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md`
- Modify: `docs/worklogs/2026-07-22.md`

**Interfaces:**
- Consumes: Task 6 exact 7-test output and Tasks 1–5 commits
- Produces: final `7/9 통과, 2/9 후순위`, current gate counts, pushed branch

- [ ] **Step 1: Record the exact Persona matrix**

In `07-day-6-u8-u9.md`, set only these seven rows/combinations complete:

```md
- [x] 김영수 Task 2·3 assertion 통과
- [x] 이민정 Task 1·2·3 assertion 통과
- [x] 박성훈 Task 2·3 assertion 통과
- [ ] **후순위** 김영수 Task 1 사용자 실행형 TTS
- [ ] **후순위** 박성훈 Task 1 모의 음성 입력
- [x] credential-free Persona matrix 7/9 통과
- [ ] **후순위** 음성 의존 2/9
```

Do not retain the old unchecked claims that imply all three Personas or all 9 combinations are still undifferentiated.

- [ ] **Step 2: Record accessibility and operation boundaries**

Add the actual focused command and result. Record:

- seven Chromium cases
- 393×852 horizontal overflow 0
- representative keyboard Task 1 and Task 3
- explicit labels and touch targets
- Persona·fixture public body exposure 0
- AI·Modal·GPU·media·STT calls 0
- 200% Chrome evidence reused, not synthetically rerun

- [ ] **Step 3: Update root status and worklog**

Set next work to the explicit deferred choices:

```md
- 다음 작업: **별도 승인 시 U5 speech/TTS 또는 U8 photo milestone 재개; 현재 데모 핵심 경로 마감**
```

Append a 2026-07-24 worklog section covering record restoration, R1~R20 `14/20`, U5/U8 decisions, Persona 7/9, and 2/9 deferred.

- [ ] **Step 4: Commit documentation**

```bash
git diff --check
git add docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md docs/worklogs/2026-07-22.md
git commit -m "docs(demo): record final persona and accessibility evidence"
```

- [ ] **Step 5: Run independent non-browser milestone gates in parallel**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
```

Expected: all exit 0. Record exact file/test counts from output.

- [ ] **Step 6: Run the full production build and Chromium suite once**

```bash
npm run test:e2e
```

Expected: production webpack build and all Chromium tests pass. If sandbox localhost bind alone fails after a successful build, rerun credential-free Playwright against the same build with approved local-port access.

- [ ] **Step 7: Verify scope and push**

```bash
git diff --check
git status --short --branch
git log --oneline origin/main..HEAD
git push -u origin codex/demo-closure
```

Expected: only the approved design, plan, record navigation/tests, status docs, and Persona E2E are present. Push exits 0. Do not create a PR or merge to main without a later user choice.
