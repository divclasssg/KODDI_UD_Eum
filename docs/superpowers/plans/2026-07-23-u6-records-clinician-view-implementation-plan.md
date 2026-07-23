# U6 Records and Clinician View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 IndexedDB 문진을 홈에서 기록 목록·상세·의료진용 화면까지 다시 열 수 있는 공개 사용자 여정을 구현한다.

**Architecture:** 새 records read repository가 consent와 저장 record를 readonly transaction으로 읽고, React·IndexedDB 비의존 pure mapper가 목록·상세·의료진 view model을 만든다. Next.js page는 Server Component를 유지하며 browser database가 필요한 Client Screen만 렌더링한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19, TypeScript 5, IndexedDB v1, SCSS Modules, Vitest, React Testing Library, fake-indexeddb, Playwright Chromium

## Global Constraints

- 승인 설계: `docs/superpowers/specs/2026-07-23-u6-records-clinician-view-design.md`
- U5 모의 음성·TTS는 보류하고 U6 기록·상세·의료진 화면을 먼저 구현한다.
- database version은 `1`, store는 기존 8개를 유지하며 migration을 추가하지 않는다.
- 외부 AI·Modal·GPU·마이크·STT·TTS·공유·PDF를 실행하지 않는다.
- clinician view는 `completed` interview와 `confirmed` summary만 허용한다.
- 날짜와 오늘 판정은 `Asia/Seoul`을 사용한다.
- raw record·message·summary·profile snapshot을 console 또는 server log에 남기지 않는다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 작성한다.
- 사용자가 명시적으로 요청하기 전에는 stage·commit·push하지 않는다.
- RED/GREEN은 focused test만 실행하고 milestone 끝에서 영향받은 전체 test와 Chromium E2E를 한 번 실행한다.
- Next.js 16 동적 page는 `params: Promise<{ id: string }>`를 `await`하고 목록 navigation은 `next/link`를 우선한다.

---

### Task 1: Records Read Repository

**Files:**
- Create: `src/lib/db/records-repository.ts`
- Create: `tests/integration/db/records-repository.test.ts`
- Reuse: `src/lib/db/contracts.ts`
- Reuse: `src/lib/db/database.ts`
- Reuse: `tests/integration/db/fixtures.ts`

**Interfaces:**
- Consumes: `InterviewRecord`, `InterviewAggregateV1`, `InterviewMessageRecordV1`, `SummaryRecordV1`, `requestResult`, `transactionComplete`
- Produces:

```ts
export type StoredRecordListItem = {
  interview: InterviewRecord;
  firstAnswerText?: string;
};

export type RecordsRepository = {
  list(): Promise<StoredRecordListItem[]>;
  load(interviewId: string): Promise<InterviewAggregateV1 | undefined>;
};

export function createRecordsRepository(
  database: IDBDatabase,
): RecordsRepository;
```

- [ ] **Step 1: Write repository contract tests**

Add integration tests that seed consent, create one completed interview and one draft, then assert:

```ts
const records = createRecordsRepository(database);
const items = await records.list();

expect(items.map(({ interview }) => interview.id)).toEqual(
  expect.arrayContaining(["completed-record", "draft-record"]),
);
expect(
  items.find(({ interview }) => interview.id === "completed-record"),
).toMatchObject({ firstAnswerText: "무릎이 불편해요." });

const aggregate = await records.load("completed-record");
expect(aggregate?.messages.map(({ sequence }) => sequence)).toEqual([0, 1, 2]);
expect(aggregate?.summary).toMatchObject({
  status: "confirmed",
  interviewId: "completed-record",
});
```

Add separate tests for missing consent, unknown ID, and database invariants:

```ts
await expect(recordsWithoutConsent.list()).rejects.toBeInstanceOf(
  ConsentRequiredError,
);
await expect(records.load("missing-record")).resolves.toBeUndefined();
expect(database.version).toBe(1);
expect([...database.objectStoreNames]).toHaveLength(8);
```

- [ ] **Step 2: Run the repository tests to verify RED**

Run:

```bash
npx vitest run --config vitest.integration.config.ts tests/integration/db/records-repository.test.ts
```

Expected: FAIL because `records-repository.ts` and `createRecordsRepository` do not exist.

- [ ] **Step 3: Implement the readonly repository**

Implement `list()` with one readonly transaction over `consents`, `interviews`, and `messages`. Enqueue the consent, interview, and message reads synchronously before awaiting so IndexedDB cannot auto-close the transaction between requests:

```ts
const transaction = database.transaction(
  ["consents", "interviews", "messages"],
  "readonly",
);
const completion = transactionComplete(transaction);
const [consent, interviews, messages] = await Promise.all([
  requestResult<ConsentRecordV1 | undefined>(
    transaction.objectStore("consents").get("current"),
  ),
  requestResult<InterviewRecord[]>(
    transaction.objectStore("interviews").getAll(),
  ),
  requestResult<InterviewMessageRecordV1[]>(
    transaction.objectStore("messages").getAll(),
  ),
]);
await completion;
if (!consent) throw new ConsentRequiredError();
```

Sort messages by `sequence` and retain only the first `role === "user" && kind === "answer"` for each interview. Return cloned values without logging them.

Implement `load(interviewId)` with one readonly transaction over `consents`, `interviews`, `messages`, and `summaries`:

```ts
const [consent, interview, messages, summary] = await Promise.all([
  requestResult<ConsentRecordV1 | undefined>(
    transaction.objectStore("consents").get("current"),
  ),
  requestResult<InterviewRecord | undefined>(
    transaction.objectStore("interviews").get(interviewId),
  ),
  requestResult<InterviewMessageRecordV1[]>(
    transaction.objectStore("messages").index("byInterviewId").getAll(interviewId),
  ),
  requestResult<SummaryRecordV1 | undefined>(
    transaction.objectStore("summaries").get(interviewId),
  ),
]);
```

Register the transaction completion promise before awaiting requests, await it afterward, then throw `ConsentRequiredError` when consent is absent. Return `undefined` when the interview is missing; otherwise return the interview, sorted messages, and optional summary. Do not read or return an interview draft.

- [ ] **Step 4: Run Task 1 GREEN checks**

Run:

```bash
npx vitest run --config vitest.integration.config.ts tests/integration/db/records-repository.test.ts
npx eslint src/lib/db/records-repository.ts tests/integration/db/records-repository.test.ts
npm run typecheck
```

Expected: repository tests PASS, lint and typecheck exit 0.

- [ ] **Step 5: Record the checkpoint without committing**

Update `.superpowers/sdd/progress.md` with Task 1 commands and results. Do not stage or commit.

---

### Task 2: Pure Records View Models and Corruption Guards

**Files:**
- Create: `src/features/records/records-view-model.ts`
- Create: `tests/unit/records/records-view-model.test.ts`
- Reuse: `src/lib/db/records-repository.ts`
- Reuse: `src/lib/db/contracts.ts`

**Interfaces:**
- Consumes: `StoredRecordListItem`, `InterviewAggregateV1`, `UtcTimestamp`
- Produces:

```ts
export type RecordListItemViewModel = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  statusLabel: "완료" | "확인 중" | "작성 중" | "안전 안내 후 중단";
  modeLabel: "AI 문진" | "수동 문진";
  chiefComplaint: string;
};

export type RecordDetailViewModel = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  statusLabel: RecordListItemViewModel["statusLabel"];
  modeLabel: RecordListItemViewModel["modeLabel"];
  summarySourceLabel?: "AI가 정리한 내용" | "입력 내용 정리";
  subjective: string[];
  objective: string[];
  verificationNeeded: string[];
  turns: { question: string; answer: string }[];
  safetyMessages: string[];
  clinicianAvailable: boolean;
  clinicianBlockedMessage?: string;
};

export type RecordDetailResult =
  | { status: "ready"; record: RecordDetailViewModel }
  | { status: "corrupt" };

export function createRecordListViewModels(
  items: readonly StoredRecordListItem[],
  now: Date,
): RecordListItemViewModel[];

export function createRecordDetailViewModel(
  aggregate: InterviewAggregateV1,
  now: Date,
): RecordDetailResult;
```

- [ ] **Step 1: Write date, sorting, and label RED tests**

Use fixed UTC dates around Seoul midnight:

```ts
const now = new Date("2026-07-22T15:30:00.000Z"); // 서울 7월 23일 00:30
expect(createRecordListViewModels(items, now).map(({ id }) => id)).toEqual([
  "today-completed-newest",
  "today-safety-stopped",
  "today-review",
  "today-draft",
  "past-completed",
]);
expect(viewModels[0]).toMatchObject({
  dateLabel: "오늘",
  statusLabel: "완료",
  modeLabel: "AI 문진",
  chiefComplaint: "무릎이 불편해요.",
});
```

Add tie-break coverage for same timestamp using `id` ascending and missing first answer using `주요 증상 확인 필요`.

- [ ] **Step 2: Write detail and corruption RED tests**

Assert valid completed data maps summary, turns, and clinician availability:

```ts
expect(createRecordDetailViewModel(completedAggregate, now)).toMatchObject({
  status: "ready",
  record: {
    summarySourceLabel: "AI가 정리한 내용",
    subjective: ["무릎이 어제부터 아파요."],
    turns: [{ question: "어디가 불편한가요?", answer: "무릎이 불편해요." }],
    clinicianAvailable: true,
  },
});
```

Assert `{ status: "corrupt" }` for completed without confirmed summary, completed without profile snapshot, mismatched summary interview ID, non-contiguous sequence, answer without preceding question, and evidence IDs that do not point to a user answer.

Assert review·draft·safety-stopped produce `clinicianAvailable: false` with the approved blocked message.

- [ ] **Step 3: Run Task 2 tests to verify RED**

Run:

```bash
npx vitest run tests/unit/records/records-view-model.test.ts
```

Expected: FAIL because the view-model module does not exist.

- [ ] **Step 4: Implement Seoul formatting and deterministic sorting**

Use `Intl.DateTimeFormat` with `timeZone: "Asia/Seoul"` and extract a stable `YYYY-MM-DD` date key. Sort by date key descending, status rank `completed=0`, `safety-stopped=1`, `review=2`, `draft=3`, `updatedAt` descending, then ID ascending.

Map labels exactly as specified in the interface. Never infer chief complaint from profile or summary; use only `firstAnswerText`.

- [ ] **Step 5: Implement aggregate validation and detail mapping**

Validate all message sequences before mapping. Build turns only from an assistant question immediately followed by a user answer, collect safety messages separately, and allow a final system completion marker.

For every summary item, require every `evidenceMessageId` to reference a message with `role === "user"` and `kind === "answer"`. Require completed records to have a profile snapshot and a confirmed summary with the matching interview ID.

Set clinician blocking copy:

```ts
const blockedMessage =
  aggregate.interview.status === "safety-stopped"
    ? "안전 안내로 중단된 기록은 원문을 확인해 주세요."
    : "문진을 완료한 뒤 의료진용 화면을 열 수 있어요.";
```

- [ ] **Step 6: Run Task 2 GREEN checks**

Run:

```bash
npx vitest run tests/unit/records/records-view-model.test.ts
npx eslint src/features/records/records-view-model.ts tests/unit/records/records-view-model.test.ts
npm run typecheck
```

Expected: all Task 2 tests PASS, lint and typecheck exit 0.

- [ ] **Step 7: Record the checkpoint without committing**

Update `.superpowers/sdd/progress.md` with Task 2 results. Do not stage or commit.

---

### Task 3: List Loader, Home Entry, and Records List Screen

**Files:**
- Create: `src/features/records/load-records.ts`
- Create: `src/features/records/record-list.tsx`
- Create: `src/features/records/records.module.scss`
- Create: `src/app/records/page.tsx`
- Create: `tests/unit/records/load-records.test.ts`
- Create: `tests/unit/records/record-list.test.tsx`
- Modify: `src/features/home/home-screen.tsx`
- Modify: `src/features/home/home-screen.module.scss`
- Modify: `tests/unit/home/home-screen.test.tsx`

**Interfaces:**
- Consumes: `createRecordsRepository`, `createRecordListViewModels`, `hasMedicalInterviewDatabase`, `openMedicalInterviewDatabase`
- Produces:

```ts
export type RecordsListState =
  | { status: "ready"; records: RecordListItemViewModel[] }
  | { status: "missing" }
  | { status: "error" };

export async function loadRecordsList(now?: Date): Promise<RecordsListState>;
```

- [ ] **Step 1: Write loader and home navigation RED tests**

Mock database presence and repository boundaries to assert ready, missing, and generalized error states. Extend the home test:

```ts
screen.getByRole("button", { name: "기록 보기" }).click();
expect(navigate).toHaveBeenCalledWith("/records");
```

Assert Persona, fixture, raw database error, and medical content are absent from loader error UI.

- [ ] **Step 2: Write records list component RED tests**

Render injected ready, empty, missing, and error states. Assert record items are links with `/records/<encoded id>`, labels are visible, empty state offers `새 문진 시작하기` and `홈으로`, and retry invokes the loader again.

- [ ] **Step 3: Run Task 3 tests to verify RED**

Run:

```bash
npx vitest run tests/unit/records/load-records.test.ts tests/unit/records/record-list.test.tsx tests/unit/home/home-screen.test.tsx
```

Expected: FAIL because loader, route, and screen do not exist and home lacks `기록 보기`.

- [ ] **Step 4: Implement the loader**

Check database presence before opening it. Close the database in `finally`. Map absent database or consent to `{ status: "missing" }`; map all other errors to `{ status: "error" }` without logging.

- [ ] **Step 5: Implement list UI and route**

`src/app/records/page.tsx` remains a Server Component:

```tsx
import { RecordListScreen } from "@/features/records/record-list";

export default function RecordsPage() {
  return <RecordListScreen />;
}
```

The Client Screen loads in `useEffect`, ignores late completion after unmount, and uses `Link` for record rows. Use one `h1`, `role="status"` for loading, `role="alert"` for errors, 44px minimum controls, 393px responsive layout, and React text rendering only.

- [ ] **Step 6: Add the home entry**

Add `기록 보기` as a prominent secondary action after the interview action group. Keep AI/manual start as the primary action and route through the existing injected `navigate`.

- [ ] **Step 7: Run Task 3 GREEN checks**

Run:

```bash
npx vitest run tests/unit/records/load-records.test.ts tests/unit/records/record-list.test.tsx tests/unit/home/home-screen.test.tsx
npx eslint src/features/records/load-records.ts src/features/records/record-list.tsx src/app/records/page.tsx src/features/home/home-screen.tsx tests/unit/records tests/unit/home/home-screen.test.tsx
npm run typecheck
```

Expected: all Task 3 tests PASS, lint and typecheck exit 0.

- [ ] **Step 8: Record the checkpoint without committing**

Update `.superpowers/sdd/progress.md` with Task 3 results. Do not stage or commit.

---

### Task 4: Record Detail and Clinician View

**Files:**
- Modify: `src/features/records/load-records.ts`
- Create: `src/features/records/record-detail.tsx`
- Create: `src/features/records/clinician-view.tsx`
- Create: `src/app/records/[id]/page.tsx`
- Create: `src/app/records/[id]/clinician/page.tsx`
- Create: `tests/unit/records/record-detail.test.tsx`
- Create: `tests/unit/records/clinician-view.test.tsx`
- Modify: `tests/unit/records/load-records.test.ts`

**Interfaces:**
- Produces:

```ts
export type RecordDetailState =
  | { status: "ready"; record: RecordDetailViewModel }
  | { status: "missing-database" }
  | { status: "not-found" }
  | { status: "corrupt" }
  | { status: "error" };

export async function loadRecordDetail(
  interviewId: string,
  now?: Date,
): Promise<RecordDetailState>;
```

- [ ] **Step 1: Write detail loader RED tests**

Assert missing database, unknown ID, corrupt aggregate, ready completed record, and generalized repository error. Verify database closure in success and failure paths.

- [ ] **Step 2: Write detail screen RED tests**

Assert the approved order and copy:

```ts
expect(screen.getByRole("heading", { name: "문진 기록" })).toBeVisible();
expect(screen.getByText("AI가 정리한 내용")).toBeVisible();
expect(screen.getByRole("heading", { name: "S · 사용자가 말한 내용" })).toBeVisible();
expect(screen.getByRole("heading", { name: "O · 참고 정보" })).toBeVisible();
expect(screen.getByRole("heading", { name: "원문 질문과 답변" })).toBeVisible();
expect(screen.getByRole("link", { name: "의료진에게 보여주기" }))
  .toHaveAttribute("href", "/records/completed-record/clinician");
```

For review, draft, and safety-stopped fixtures assert the clinician link is absent and the exact blocked message is present.

- [ ] **Step 3: Write clinician screen RED tests**

For a completed record, assert:

```ts
expect(screen.getByRole("heading", { name: "의료진 참고용" })).toBeVisible();
expect(screen.getByText("진단이나 치료 안내가 아닙니다.")).toBeVisible();
expect(screen.getByText(
  "사용자가 제공한 참고 정보이며 의료진 확인이 필요합니다.",
)).toBeVisible();
expect(screen.getByRole("link", { name: "기록 상세로 돌아가기" }))
  .toHaveAttribute("href", "/records/completed-record");
expect(screen.queryByText(/프로필 수정|전체 삭제|새 문진/)).not.toBeInTheDocument();
```

For non-completed, corrupt, and missing records assert no summary item or profile snapshot content is rendered.

- [ ] **Step 4: Run Task 4 tests to verify RED**

Run:

```bash
npx vitest run tests/unit/records/load-records.test.ts tests/unit/records/record-detail.test.tsx tests/unit/records/clinician-view.test.tsx
```

Expected: FAIL because detail loader and both screens do not exist.

- [ ] **Step 5: Implement detail loading and dynamic pages**

Add `loadRecordDetail` using the same presence/open/close discipline as the list loader.

Implement Next.js 16 pages with promised params:

```tsx
export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecordDetailScreen interviewId={id} />;
}
```

The clinician page uses the same pattern and passes `interviewId` to `ClinicianViewScreen`.

- [ ] **Step 6: Implement detail and clinician UI**

Both Client Screens use injected or default loaders, cancel late state application on unmount, and provide loading/error/retry/not-found/corrupt states.

Render summary arrays as text-only lists. Render original turns inside a native `<details>` in clinician view. Do not render current profile; do not render snapshot name or full birth date. Hide all management navigation in clinician view.

- [ ] **Step 7: Run Task 4 GREEN checks**

Run:

```bash
npx vitest run tests/unit/records/load-records.test.ts tests/unit/records/record-detail.test.tsx tests/unit/records/clinician-view.test.tsx
npx eslint src/features/records src/app/records tests/unit/records
npm run typecheck
```

Expected: Task 4 tests PASS, lint and typecheck exit 0.

- [ ] **Step 8: Record the checkpoint without committing**

Update `.superpowers/sdd/progress.md` with Task 4 results. Do not stage or commit.

---

### Task 5: Public Journey E2E, Documentation, and Milestone Gate

**Files:**
- Create: `tests/e2e/records-clinician-view.spec.ts`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/05-day-4-u5-u6.md`
- Modify: `docs/worklogs/2026-07-22.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: public onboarding, manual interview completion, `/home`, `/records`, detail and clinician routes
- Produces: U6 browser evidence with one real IndexedDB `interviewId`

- [ ] **Step 1: Write the public journey E2E**

Use synthetic onboarding with AI transfer declined so the test makes zero `/api/ai/*` requests. Complete the existing public manual interview, confirm its summary, and capture the completed interview ID from IndexedDB.

Continue without reseeding:

```ts
await page.goto("/home");
await page.getByRole("button", { name: "기록 보기" }).click();
await expect(page).toHaveURL(/\/records$/);
await page.getByRole("link", { name: /오늘.*완료.*주요 증상/ }).first().click();
await expect(page).toHaveURL(new RegExp(`/records/${completedInterviewId}$`));
await page.getByRole("link", { name: "의료진에게 보여주기" }).click();
await expect(page).toHaveURL(
  new RegExp(`/records/${completedInterviewId}/clinician$`),
);
await expect(page.getByRole("heading", { name: "의료진 참고용" })).toBeVisible();
expect(aiRequests).toBe(0);
```

Set viewport to `393x852` and assert `document.documentElement.scrollWidth <= window.innerWidth`.

- [x] **Step 2: Run the targeted Chromium E2E**

Run:

```bash
npx playwright test tests/e2e/records-clinician-view.spec.ts --project=chromium
```

Expected: PASS. If sandbox localhost bind returns `EPERM`, rerun the identical credential-free command with the required sandbox approval.

- [x] **Step 3: Run the U6 milestone gate once**

Run independent commands in parallel where supported:

```bash
npx eslint src/app/records src/features/records src/lib/db/records-repository.ts src/features/home/home-screen.tsx tests/unit/records tests/integration/db/records-repository.test.ts tests/e2e/records-clinician-view.spec.ts
npm run typecheck
npx vitest run tests/unit/records tests/unit/home/home-screen.test.tsx
npx vitest run --config vitest.integration.config.ts tests/integration/db/records-repository.test.ts
git diff --check
```

Then run the affected Chromium journey once:

```bash
npx playwright test tests/e2e/records-clinician-view.spec.ts --project=chromium
```

Do not run Modal actual or the full E2E suite at this milestone. The full production build and complete E2E remain the final commit·push·merge gate.

- [x] **Step 4: Update project evidence**

Record:

- U5 speech remains deferred.
- U6 records list, detail, and clinician view are complete.
- exact unit, integration, lint, typecheck, and Chromium counts
- actual IndexedDB continuity and the completed-only clinician guard
- external AI/GPU call count 0
- no stage, commit, push, or merge

- [x] **Step 5: Self-review the final diff**

Check:

```bash
git diff --check
git status --short
rg -n "console\\.(log|debug|info)|dangerouslySetInnerHTML" src/features/records src/lib/db/records-repository.ts
```

Expected: no whitespace errors, only intended dirty-worktree files, and no raw data logging or HTML injection.

- [x] **Step 6: Stop at the user-controlled git boundary**

완료 파일·검증·U5 후순위 범위·잔여 위험을 보고한 뒤 사용자 요청 전까지 git 변경을 중단했다. 이후 명시적 통합 요청에 따라 `6681d9b`와 문서 정정 `4889e3c`를 로컬 `main`에 fast-forward했다.
