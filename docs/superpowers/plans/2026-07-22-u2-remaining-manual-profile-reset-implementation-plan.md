# U2 Remaining Manual, Profile, and Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persona 없는 실제 수동 문진 수직 흐름과 프로필 수정·전체 데이터 삭제 UI를 IndexedDB v1 repository에 연결해 U2 남은 범위를 완료한다.

**Architecture:** 기존 8-store IndexedDB v1 schema는 유지하고 repository API만 확장한다. 브라우저 전용 route는 작은 Client Component로 두고 profile 변환·질문 세트·수동 문진 상태 계산은 순수 module로 분리한다. 모든 쓰기는 consent, interview revision, singleton runtime generation을 검사하며 마지막 답변과 summary 전환은 한 transaction으로 저장한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19, TypeScript, CSS Modules/SCSS, IndexedDB, Vitest, Testing Library, Playwright

## Global Constraints

- database 이름은 `koddi-ud-eum`, version은 `1`, object store는 기존 8개를 유지한다.
- 모든 timestamp는 `YYYY-MM-DDTHH:mm:ss.sssZ` UTC 형식이다.
- 공개 사용자 흐름에 Persona, fixture ID, 역할극 확인을 노출하지 않는다.
- 실제 환자 정보·실제 음성·마이크·STT·사진 파일·외부 AI 요청을 사용하지 않는다.
- 질문 단계 번호, 전체 질문 수, 고정 진행률을 표시하지 않는다.
- 질문은 `manual-intake-v1`의 최대 다섯 항목이며 진단·응급도·치료 권고를 만들지 않는다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 합성·비식별 fixture만 사용하며 credential과 실제 payload를 출력하지 않는다.
- 사용자 소유 root `.gitignore`와 `stash@{0}: codex-transfer-u1-plans`를 수정·stage·stash·폐기하지 않는다.
- 기존 `.worktrees/modal-contracts`를 사용하지 않는다.
- 구현 commit·push·main merge는 사용자의 별도 요청 전 수행하지 않는다.
- Modal actual, 배포, GPU 호출은 실행하지 않는다.

---

## File Map

- `src/features/profile/profile-draft.ts`: persisted profile bundle과 편집 draft 사이 변환·검증
- `src/features/profile/profile-screen.tsx`: 프로필 load/edit/save 상태와 접근 가능한 폼
- `src/features/profile/profile-screen.module.scss`: 프로필 화면 스타일
- `src/app/profile/page.tsx`: `/profile` Server Component route
- `src/lib/runtime/runtime-operation-coordinator.ts`: generation·abort controller·timer 취소 경계와 browser singleton
- `src/features/settings/delete-all-data.tsx`: reset 확인·실패·성공 상태
- `src/features/settings/delete-all-data.module.scss`: 데이터 삭제 화면 스타일
- `src/app/settings/data/page.tsx`: `/settings/data` Server Component route
- `src/features/interview/manual/manual-question-set.ts`: `manual-intake-v1` 질문과 결정론적 summary
- `src/features/interview/manual/manual-interview-service.ts`: repository 기반 생성·복원·답변·완료 application service
- `src/features/interview/manual/manual-interview-screen.tsx`: Persona 없는 수동 문진 UI state
- `src/features/interview/manual/manual-interview-screen.module.scss`: 수동 문진 화면 스타일
- `src/app/interview/manual/page.tsx`: `/interview/manual` Server Component route
- `src/lib/db/contracts.ts`: 마지막 답변+summary 원자 저장 input type
- `src/lib/db/interview-repository.ts`: 최신 진행 문진 조회와 마지막 답변 원자 저장
- `src/features/home/home-screen.tsx`: 실제 수동 문진·프로필·삭제 진입점
- `docs/plans/...`, `docs/worklogs/2026-07-22.md`: 완료 증거 동기화

### Task 1: 프로필 편집용 순수 변환·검증 계약

**Files:**
- Create: `src/features/profile/profile-draft.ts`
- Modify: `src/features/onboarding/onboarding-machine.ts`
- Modify: `src/features/onboarding/onboarding.types.ts`
- Test: `tests/unit/profile/profile-draft.test.ts`
- Test: `tests/unit/onboarding/onboarding-machine.test.ts`

**Interfaces:**
- Consumes: `ProfileBundleV1`, `SaveProfileBundleInputV1`, 기존 `validateBasicProfile()`과 의료정보 정규화 규칙
- Produces: `ProfileDraft`, `profileBundleToDraft(bundle)`, `validateProfileDraft(draft, now, updatedAt)`

- [ ] **Step 1: profile 변환과 연령 경계 RED 작성**

```ts
it("저장 record를 손실 없이 편집 draft로 바꾼다", () => {
  const draft = profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE);
  expect(draft.displayName).toBe("테스트 사용자");
  expect(draft.conditions).toBe("합성 만성질환");
  expect(draft.medicationsUnknown).toBe(true);
});

it("프로필 수정에서 만 14세 미만을 저장 input으로 만들지 않는다", () => {
  const result = validateProfileDraft(
    { ...SYNTHETIC_PROFILE_DRAFT, birthDate: "2012-07-23" },
    new Date("2026-07-22T03:00:00.000Z"),
    toUtcTimestamp("2026-07-22T03:00:00.000Z"),
  );
  expect(result).toEqual({
    ok: false,
    errors: { birthDate: "만 14세 이상만 사용할 수 있어요." },
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/profile/profile-draft.test.ts`

Expected: FAIL because `@/features/profile/profile-draft` does not exist.

- [ ] **Step 3: 공용 draft type과 변환 구현**

```ts
export type ProfileDraft = BasicProfileInput & MedicalProfileInput;

export type ProfileDraftValidation =
  | { ok: true; value: SaveProfileBundleInputV1 }
  | {
      ok: false;
      errors: BasicProfileErrors & MedicalProfileErrors;
    };

export function profileBundleToDraft(bundle: ProfileBundleV1): ProfileDraft {
  return {
    displayName: bundle.profile.displayName,
    birthDate: bundle.profile.birthDate,
    sex: bundle.profile.sex,
    conditions: listToText(bundle.medicalProfile.conditions),
    conditionsUnknown: bundle.medicalProfile.conditions.state === "unknown",
    medications: listToText(bundle.medicalProfile.medications),
    medicationsUnknown: bundle.medicalProfile.medications.state === "unknown",
    allergies: listToText(bundle.medicalProfile.allergies),
    allergiesUnknown: bundle.medicalProfile.allergies.state === "unknown",
    familyHistory: listToText(bundle.medicalProfile.familyHistory),
    familyHistoryUnknown: bundle.medicalProfile.familyHistory.state === "unknown",
    medicalHistory: listToText(bundle.medicalProfile.medicalHistory),
    medicalHistoryUnknown: bundle.medicalProfile.medicalHistory.state === "unknown",
    surgicalHistory: listToText(bundle.medicalProfile.surgicalHistory),
    surgicalHistoryUnknown: bundle.medicalProfile.surgicalHistory.state === "unknown",
    smokingStatus: bundle.medicalProfile.smoking.state,
    smokingDetails: bundle.medicalProfile.smoking.state === "yes"
      ? bundle.medicalProfile.smoking.details ?? ""
      : "",
    alcoholStatus: bundle.medicalProfile.alcohol.state,
    alcoholDetails: bundle.medicalProfile.alcohol.state === "yes"
      ? bundle.medicalProfile.alcohol.details ?? ""
      : "",
    heightCm: bundle.medicalProfile.heightCm?.toString() ?? "",
    weightKg: bundle.medicalProfile.weightKg?.toString() ?? "",
  };
}
```

`validateProfileDraft()`는 `validateBasicProfile()`과 `normalizeMedicalProfile()`의 결과를 합치고, 성공 시 profile과 medical profile 양쪽에 같은 `updatedAt`을 넣는다. 온보딩 module에 있던 순수 validator type은 `profile-draft.ts`가 import할 수 있게 유지하고 UI state는 끌어오지 않는다.

- [ ] **Step 4: profile과 기존 onboarding unit GREEN 확인**

Run: `npm run test:unit -- tests/unit/profile/profile-draft.test.ts tests/unit/onboarding/onboarding-machine.test.ts`

Expected: PASS.

- [ ] **Step 5: 변경 검토 checkpoint**

Run: `git diff --check && git diff -- src/features/profile src/features/onboarding tests/unit/profile tests/unit/onboarding`

Expected: whitespace error 0건. 사용자 승인 전 commit하지 않는다.

### Task 2: 프로필 수정 route와 원자 저장 UI

**Files:**
- Create: `src/features/profile/profile-screen.tsx`
- Create: `src/features/profile/profile-screen.module.scss`
- Create: `src/app/profile/page.tsx`
- Modify: `src/features/home/home-screen.tsx`
- Modify: `src/features/home/home-screen.module.scss`
- Test: `tests/unit/profile/profile-screen.test.tsx`
- Test: `tests/unit/home/home-screen.test.tsx`
- Test: `tests/integration/db/consent-profile-repositories.test.ts`

**Interfaces:**
- Consumes: Task 1 `ProfileDraft`, `profileBundleToDraft()`, `validateProfileDraft()`; existing `ProfileRepository.getBundle()` and `saveBundle()`
- Produces: `ProfileScreen({ load, save, navigate, now })`, `/profile`, 홈의 `프로필 수정` 진입점

- [ ] **Step 1: load·save·연령·입력 보존 component RED 작성**

```tsx
it("저장 실패 뒤 입력을 유지하고 다시 저장한다", async () => {
  const save = vi.fn()
    .mockRejectedValueOnce(new Error("합성 저장 실패"))
    .mockResolvedValueOnce(SYNTHETIC_PROFILE_BUNDLE);
  render(
    <ProfileScreen
      load={() => Promise.resolve(SYNTHETIC_PROFILE_BUNDLE)}
      save={save}
      navigate={vi.fn()}
      now={() => new Date("2026-07-22T03:00:00.000Z")}
    />,
  );
  const name = await screen.findByLabelText("이름");
  await userEvent.clear(name);
  await userEvent.type(name, "수정한 테스트 사용자");
  await userEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("저장하지 못했어요");
  expect(name).toHaveValue("수정한 테스트 사용자");
});
```

Repository integration에는 두 record가 같은 timestamp로 저장되고 강제 transaction abort 시 둘 다 기존 값인 assertion을 추가한다.

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/profile/profile-screen.test.tsx tests/unit/home/home-screen.test.tsx && npm run test:integration -- tests/integration/db/consent-profile-repositories.test.ts`

Expected: FAIL because profile screen/route action is absent.

- [ ] **Step 3: 주입 가능한 ProfileScreen 구현**

```ts
type ProfileScreenProps = {
  load: () => Promise<ProfileBundleV1 | undefined>;
  save: (input: SaveProfileBundleInputV1) => Promise<ProfileBundleV1>;
  navigate: (path: string) => void;
  now?: () => Date;
};
```

화면 상태는 `loading | ready | load-error | saved`와 별도 `pending`, `saveError`, field error로 제한한다. ready에서 기본정보, 의료 목록, 생활습관, 측정값을 실제 form control로 표시한다. submit은 `validateProfileDraft()` 성공 뒤에만 `save()`를 호출하며 pending 동안 제출을 잠근다. load missing이면 `/onboarding`, 저장 성공이면 `변경사항을 저장했어요.` status와 홈 이동을 제공한다.

브라우저 wrapper는 database를 열고 `createProfileRepository(database)`를 사용한 뒤 `finally`에서 close한다. route page는 Client Component만 렌더링한다.

```tsx
export default function ProfilePage() {
  return <ProfileScreenWithRouter />;
}
```

- [ ] **Step 4: 홈에 실제 route 진입점 연결**

```tsx
<button type="button" onClick={() => navigate("/profile")}>
  프로필 수정
</button>
<button type="button" onClick={() => navigate("/settings/data")}>
  저장된 정보 모두 삭제
</button>
```

AI 버튼은 계속 disabled로 두고 수동 문진 버튼은 Task 7 전까지 기존 상태를 유지한다.

- [ ] **Step 5: GREEN 확인**

Run: `npm run test:unit -- tests/unit/profile/profile-screen.test.tsx tests/unit/home/home-screen.test.tsx && npm run test:integration -- tests/integration/db/consent-profile-repositories.test.ts`

Expected: PASS.

- [ ] **Step 6: 변경 검토 checkpoint**

Run: `git diff --check && npm run typecheck`

Expected: PASS. 사용자 승인 전 commit하지 않는다.

### Task 3: Runtime operation coordinator와 singleton generation guard

**Files:**
- Create: `src/lib/runtime/runtime-operation-coordinator.ts`
- Test: `tests/unit/runtime/runtime-operation-coordinator.test.ts`
- Modify: `src/lib/db/revision-guard.ts`
- Test: `tests/integration/db/reset-revision-guard.test.ts`

**Interfaces:**
- Consumes: `RuntimeRevisionGuard`
- Produces: `RuntimeOperationCoordinator`, `createRuntimeOperationCoordinator()`, `browserRuntimeOperations`

- [ ] **Step 1: abort·timer·generation RED 작성**

```ts
it("reset 경계에서 등록 요청과 timer를 취소하고 이전 generation을 거부한다", () => {
  vi.useFakeTimers();
  const coordinator = createRuntimeOperationCoordinator();
  const controller = new AbortController();
  const timerCallback = vi.fn();
  const timer = setTimeout(timerCallback, 1_000);
  const captured = coordinator.capture();
  coordinator.registerAbortController(controller);
  coordinator.registerTimer(timer);

  coordinator.invalidateAndCancel();

  expect(controller.signal.aborted).toBe(true);
  expect(() => coordinator.assertCurrent(captured)).toThrow(RevisionConflictError);
  vi.runAllTimers();
  expect(timerCallback).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/runtime/runtime-operation-coordinator.test.ts`

Expected: FAIL because runtime coordinator does not exist.

- [ ] **Step 3: 최소 coordinator 구현**

```ts
export type RuntimeOperationCoordinator = {
  capture(): number;
  assertCurrent(generation: number): void;
  registerAbortController(controller: AbortController): () => void;
  registerTimer(timer: ReturnType<typeof setTimeout>): () => void;
  invalidateAndCancel(): void;
};

export function createRuntimeOperationCoordinator(): RuntimeOperationCoordinator {
  const guard = createRuntimeRevisionGuard();
  const controllers = new Set<AbortController>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  return {
    capture: guard.capture,
    assertCurrent: guard.assertCurrent,
    registerAbortController(controller) {
      controllers.add(controller);
      return () => controllers.delete(controller);
    },
    registerTimer(timer) {
      timers.add(timer);
      return () => timers.delete(timer);
    },
    invalidateAndCancel() {
      guard.invalidate();
      controllers.forEach((controller) => controller.abort());
      timers.forEach((timer) => clearTimeout(timer));
      controllers.clear();
      timers.clear();
    },
  };
}

export const browserRuntimeOperations = createRuntimeOperationCoordinator();
```

- [ ] **Step 4: unit과 기존 이중 guard integration GREEN 확인**

Run: `npm run test:unit -- tests/unit/runtime/runtime-operation-coordinator.test.ts && npm run test:integration -- tests/integration/db/reset-revision-guard.test.ts`

Expected: PASS.

- [ ] **Step 5: 변경 검토 checkpoint**

Run: `git diff --check && npm run typecheck`

Expected: PASS. 사용자 승인 전 commit하지 않는다.

### Task 4: 전체 데이터 삭제 UI와 원자적 reset

**Files:**
- Create: `src/features/settings/delete-all-data.tsx`
- Create: `src/features/settings/delete-all-data.module.scss`
- Create: `src/app/settings/data/page.tsx`
- Test: `tests/unit/settings/delete-all-data.test.tsx`
- Modify: `tests/integration/db/reset-revision-guard.test.ts`

**Interfaces:**
- Consumes: `browserRuntimeOperations.invalidateAndCancel()`, `LocalDataRepository.resetAll()`
- Produces: `DeleteAllData({ reset, navigate })`, `/settings/data`

- [ ] **Step 1: 확인·취소·rollback·성공 상태 RED 작성**

```tsx
it("최종 확인 뒤 runtime을 취소하고 reset 성공만 알린다", async () => {
  const reset = vi.fn().mockResolvedValue(undefined);
  render(<DeleteAllData reset={reset} navigate={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "모든 정보 삭제" }));
  expect(screen.getByRole("dialog", { name: "모든 정보를 삭제할까요?" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
  expect(reset).toHaveBeenCalledOnce();
  expect(await screen.findByRole("status")).toHaveTextContent("삭제를 완료했어요");
});

it("reset 실패 시 삭제 완료를 표시하지 않는다", async () => {
  render(<DeleteAllData reset={() => Promise.reject(new Error("합성 실패"))} navigate={vi.fn()} />);
  await confirmDeletion();
  expect(await screen.findByRole("alert")).toHaveTextContent("삭제하지 못했어요");
  expect(screen.queryByText("삭제를 완료했어요")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/settings/delete-all-data.test.tsx`

Expected: FAIL because delete UI does not exist.

- [ ] **Step 3: reset orchestration 구현**

`resetWithBrowserDatabase()`는 먼저 `browserRuntimeOperations.invalidateAndCancel()`을 호출하고 database를 연 뒤 `createLocalDataRepository(database).resetAll()`을 실행한다. database는 `finally`에서 close한다. UI는 `idle | confirming | deleting | success | error`만 사용하고 success 전에는 개인정보를 다시 렌더링하지 않는다.

```ts
async function resetWithBrowserDatabase() {
  browserRuntimeOperations.invalidateAndCancel();
  const database = await openMedicalInterviewDatabase();
  try {
    await createLocalDataRepository(database).resetAll();
  } finally {
    database.close();
  }
}
```

dialog는 `role="dialog"`, `aria-modal="true"`, 제목 연결, 취소, `삭제 확인`을 제공한다. 성공 화면의 `처음부터 시작하기`는 `/onboarding`으로 이동한다.

- [ ] **Step 4: UI·integration GREEN 확인**

Run: `npm run test:unit -- tests/unit/settings/delete-all-data.test.tsx && npm run test:integration -- tests/integration/db/reset-revision-guard.test.ts`

Expected: PASS, 8개 store 전량 clear와 abort rollback assertion 유지.

- [ ] **Step 5: 변경 검토 checkpoint**

Run: `git diff --check && npm run typecheck`

Expected: PASS. 사용자 승인 전 commit하지 않는다.

### Task 5: 최신 진행 문진과 마지막 답변 원자 저장 repository API

**Files:**
- Modify: `src/lib/db/contracts.ts`
- Modify: `src/lib/db/interview-repository.ts`
- Modify: `tests/integration/db/interview-repository.test.ts`
- Modify: `tests/integration/db/fixtures.ts`

**Interfaces:**
- Consumes: 기존 `InterviewAggregateV1`, `RevisionToken`, `SaveProgressInputV1`, `SaveSummaryInputV1`
- Produces: `SaveFinalProgressInputV1`, `findLatestInProgress(mode)`, `saveFinalProgress(token, input)`

- [ ] **Step 1: 최신 manual 복원과 마지막 답변 transaction RED 작성**

```ts
it("가장 최근 manual draft 또는 review만 복원한다", async () => {
  const repository = createInterviewRepository(database);
  await repository.create({ ...SYNTHETIC_INTERVIEW_INPUT, id: "manual-old", mode: "manual" });
  await repository.create({
    ...SYNTHETIC_INTERVIEW_INPUT,
    id: "ai-newer",
    mode: "ai",
    createdAt: toUtcTimestamp("2026-07-22T02:00:00.000Z"),
    draft: { ...SYNTHETIC_INTERVIEW_INPUT.draft, updatedAt: toUtcTimestamp("2026-07-22T02:00:00.000Z") },
  });
  expect((await repository.findLatestInProgress("manual"))?.interview.id).toBe("manual-old");
});

it("마지막 답변과 summary를 한 revision의 review로 저장한다", async () => {
  const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
  const reviewed = await repository.saveFinalProgress(token(created), SYNTHETIC_FINAL_PROGRESS_INPUT);
  expect(reviewed.interview.status).toBe("review");
  expect(reviewed.interview.revision).toBe(2);
  expect(reviewed.draft?.revision).toBe(2);
  expect(reviewed.summary?.revision).toBe(2);
  expect(reviewed.messages).toHaveLength(2);
});
```

강제 실패 hook을 사용한 assertion에서 interview, draft, messages, summary가 전부 원본 상태임을 확인한다.

- [ ] **Step 2: RED 확인**

Run: `npm run test:integration -- tests/integration/db/interview-repository.test.ts`

Expected: typecheck/test FAIL because both repository methods are absent.

- [ ] **Step 3: input type과 repository signature 추가**

```ts
export type SaveFinalProgressInputV1 = {
  draft: InterviewDraftInputV1;
  appendedMessages: InterviewMessageInputV1[];
  summary: SaveSummaryInputV1;
};

export type InterviewRepository = {
  findLatestInProgress(mode: "ai" | "manual"): Promise<InterviewAggregateV1 | undefined>;
  saveFinalProgress(
    token: RevisionToken,
    input: SaveFinalProgressInputV1,
  ): Promise<InterviewAggregateV1>;
  // 기존 method는 유지한다.
};
```

- [ ] **Step 4: 기존 schema로 최소 구현**

`findLatestInProgress()`는 `byStatusUpdatedAt` index를 `draft`와 `review` 각각 newest-first로 읽고 합친 뒤 `mode`를 filter하고 가장 큰 `updatedAt` aggregate를 `readAggregate()`로 읽는다. store/index 추가나 version 증가는 하지 않는다.

`saveFinalProgress()`는 consent, runtime generation, interview revision을 검사한 뒤 existing+appended message ID set으로 summary evidence를 검증한다. 같은 transaction에서 interview를 `review`, draft·summary를 같은 next revision으로 put하고 message를 append한다. transaction 완료 후 aggregate를 반환한다.

- [ ] **Step 5: repository 전체 GREEN 확인**

Run: `npm run test:integration -- tests/integration/db/interview-repository.test.ts tests/integration/db/reset-revision-guard.test.ts tests/integration/db/schema.test.ts`

Expected: PASS and database version remains 1.

- [ ] **Step 6: 변경 검토 checkpoint**

Run: `git diff --check && npm run typecheck`

Expected: PASS. 사용자 승인 전 commit하지 않는다.

### Task 6: Versioned 수동 질문과 결정론적 summary

**Files:**
- Create: `src/features/interview/manual/manual-question-set.ts`
- Test: `tests/unit/interview/manual-question-set.test.ts`

**Interfaces:**
- Consumes: `InterviewQuestionSnapshotV1`, `InterviewMessageRecordV1`, `SummaryContentV1`
- Produces: `MANUAL_QUESTION_SET_ID`, `MANUAL_QUESTIONS_V1`, `getManualQuestion(index)`, `formatManualAnswer(question, draft)`, `createManualSummary(messages)`

- [ ] **Step 1: 질문 내용·상한·비권고 summary RED 작성**

```ts
it("질문 번호 없이 최대 다섯 개 versioned 질문을 제공한다", () => {
  expect(MANUAL_QUESTION_SET_ID).toBe("manual-intake-v1");
  expect(MANUAL_QUESTIONS_V1).toHaveLength(5);
  expect(MANUAL_QUESTIONS_V1.map(({ id }) => id)).toEqual([
    "manual-intake-v1:chief-complaint",
    "manual-intake-v1:onset",
    "manual-intake-v1:pattern",
    "manual-intake-v1:severity",
    "manual-intake-v1:additional",
  ]);
  expect(MANUAL_QUESTIONS_V1.map(({ text }) => text).join(" "))
    .not.toMatch(/1\/5|2\/5|진단|치료|응급/);
});

it("summary의 모든 항목이 저장된 user message를 근거로 한다", () => {
  const summary = createManualSummary(SYNTHETIC_MANUAL_MESSAGES);
  expect(summary.subjective.flatMap((item) => item.evidenceMessageIds))
    .toEqual(SYNTHETIC_MANUAL_MESSAGES.filter(({ role }) => role === "user").map(({ id }) => id));
  expect(JSON.stringify(summary)).not.toMatch(/진단|치료|응급실|약을 드세요/);
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/interview/manual-question-set.test.ts`

Expected: FAIL because manual question set module does not exist.

- [ ] **Step 3: 다섯 질문과 formatter 구현**

```ts
export const MANUAL_QUESTION_SET_ID = "manual-intake-v1";

export const MANUAL_QUESTIONS_V1 = [
  question("chief-complaint", "지금 가장 불편한 점을 적어 주세요.", "text", []),
  question("onset", "언제부터 불편했나요?", "choice", [
    option("today", "오늘"), option("days", "며칠 전"),
    option("weeks", "몇 주 전"), option("unknown", "잘 모르겠어요"),
  ]),
  question("pattern", "불편함은 어떻게 나타나나요?", "choice", [
    option("continuous", "계속 이어져요"),
    option("intermittent", "나아졌다가 다시 나타나요"),
    option("unknown", "잘 모르겠어요"),
  ]),
  question("severity", "지금 느끼는 불편함은 어느 정도인가요?", "choice", [
    option("mild", "조금 불편해요"), option("moderate", "많이 불편해요"),
    option("severe", "매우 불편해요"), option("unknown", "잘 모르겠어요"),
  ]),
  question("additional", "의료진에게 추가로 전하고 싶은 내용이 있나요?", "text", [
    option("none", "추가 내용 없음"),
  ]),
] as const;
```

`question()`은 `InterviewQuestionSnapshotV1`과 default input mode를 함께 보관하는 local type을 반환한다. `createManualSummary()`는 user answer message 하나당 subjective item 하나를 만들고 objective는 비우며, 알 수 없거나 확인이 필요한 답변만 verificationNeeded에 복제하지 않고 별도 항목으로 분류한다.

- [ ] **Step 4: GREEN 확인**

Run: `npm run test:unit -- tests/unit/interview/manual-question-set.test.ts`

Expected: PASS.

- [ ] **Step 5: 변경 검토 checkpoint**

Run: `git diff --check && npm run typecheck`

Expected: PASS. 사용자 승인 전 commit하지 않는다.

### Task 7: 수동 문진 application service·UI·home 연결

**Files:**
- Create: `src/features/interview/manual/manual-interview-service.ts`
- Create: `src/features/interview/manual/manual-interview-screen.tsx`
- Create: `src/features/interview/manual/manual-interview-screen.module.scss`
- Create: `src/app/interview/manual/page.tsx`
- Modify: `src/features/home/home-screen.tsx`
- Modify: `src/features/home/home-screen.module.scss`
- Test: `tests/unit/interview/manual-interview-service.test.ts`
- Test: `tests/unit/interview/manual-interview-screen.test.tsx`
- Modify: `tests/unit/home/home-screen.test.tsx`

**Interfaces:**
- Consumes: Task 3 `browserRuntimeOperations`, Task 5 repository API, Task 6 question helpers
- Produces: `createManualInterviewService()`, `ManualInterviewScreen`, `/interview/manual`, 실제 홈 버튼

- [ ] **Step 1: 생성·복원·중복 제출·실패 보존 RED 작성**

```ts
it("진행 중 manual aggregate가 있으면 새로 만들지 않고 복원한다", async () => {
  repository.findLatestInProgress.mockResolvedValue(SYNTHETIC_MANUAL_AGGREGATE);
  const state = await service.loadOrCreate();
  expect(repository.create).not.toHaveBeenCalled();
  expect(state.interviewId).toBe(SYNTHETIC_MANUAL_AGGREGATE.interview.id);
});
```

```tsx
it("저장 실패 시 현재 질문과 입력을 유지한다", async () => {
  render(<ManualInterviewScreen service={failingService} navigate={vi.fn()} />);
  const answer = await screen.findByLabelText("답변");
  await userEvent.type(answer, "합성 불편함");
  await userEvent.click(screen.getByRole("button", { name: "답변 저장" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("저장하지 못했어요");
  expect(answer).toHaveValue("합성 불편함");
});
```

같은 test에서 저장 promise가 pending인 동안 두 번 click해 service submit이 1회인지 확인한다. body text에는 `/persona|페르소나|fixture|1\/5|20%/i`가 없어야 한다.

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/interview/manual-interview-service.test.ts tests/unit/interview/manual-interview-screen.test.tsx tests/unit/home/home-screen.test.tsx`

Expected: FAIL because service/screen/actual route are absent.

- [ ] **Step 3: application service 구현**

```ts
export type ManualInterviewService = {
  loadOrCreate(): Promise<ManualInterviewState>;
  saveAnswer(state: ManualInterviewState, answer: ManualAnswerDraft): Promise<ManualInterviewState>;
  complete(state: ManualInterviewState): Promise<InterviewAggregateV1>;
};
```

`loadOrCreate()`는 `findLatestInProgress("manual")`을 먼저 호출한다. 없으면 `crypto.randomUUID()` 기반 ID, first question draft, capture한 singleton generation으로 `create()`한다. aggregate가 `review`이면 summary review state로, `draft`이면 저장된 current question과 input으로 복원한다.

중간 답변은 assistant/user message를 연속 sequence로 만들고 다음 question draft와 `saveProgress()`한다. 마지막 답변은 same messages와 `createManualSummary()`를 `saveFinalProgress()`에 전달한다. 모든 token은 현재 aggregate revision과 service가 capture한 runtime generation을 사용한다.

- [ ] **Step 4: 수동 문진 UI와 route 구현**

화면 state는 `loading | answering | saving | review | completing | completed | error`로 제한한다. text 질문은 label이 있는 textarea, choice 질문은 fieldset/legend와 radio를 사용한다. answer가 비어 있으면 저장하지 않는다. review는 저장된 summary만 표시하고 `문진 저장 완료` 버튼으로 `complete()`를 호출한다. 완료 뒤 홈 이동을 제공한다.

브라우저 wrapper는 service factory에 `openMedicalInterviewDatabase`, `createInterviewRepository`, `browserRuntimeOperations`를 주입한다. component unmount에서는 local active flag만 끄며 reset generation은 바꾸지 않는다.

```tsx
export default function ManualInterviewPage() {
  return <ManualInterviewScreenWithRouter />;
}
```

- [ ] **Step 5: 홈 버튼을 actual route로 연결**

AI 동의 상태와 관계없이 수동 버튼은 enabled이며 `navigate("/interview/manual")`을 호출한다. AI 동의 버튼만 계속 준비 중이다. 기존 `문진 시작 기능은 다음 업데이트` 문구는 AI 기능에만 맞는 문구로 바꾼다.

- [ ] **Step 6: unit GREEN 확인**

Run: `npm run test:unit -- tests/unit/interview/manual-question-set.test.ts tests/unit/interview/manual-interview-service.test.ts tests/unit/interview/manual-interview-screen.test.tsx tests/unit/home/home-screen.test.tsx`

Expected: PASS.

- [ ] **Step 7: 변경 검토 checkpoint**

Run: `git diff --check && npm run typecheck && npm run lint`

Expected: PASS. 사용자 승인 전 commit하지 않는다.

### Task 8: 실제 사용자 E2E, 문서 동기화, 전체 gate

**Files:**
- Create: `tests/e2e/manual-profile-reset.spec.ts`
- Modify: `tests/e2e/onboarding-home.spec.ts`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/03-day-2-u2-u3.md`
- Modify: `docs/worklogs/2026-07-22.md`

**Interfaces:**
- Consumes: Tasks 1–7 전체 사용자 경로와 repository
- Produces: U2 exit evidence와 최소 U3 수직 흐름 증거

- [ ] **Step 1: 수동 문진 복원·완료 E2E RED 작성**

AI 거부 합성 온보딩 helper로 홈까지 간 뒤 수동 문진을 시작한다. 첫 답변 `합성 두통`을 저장하고 reload해 다음 질문이 복원되는지 확인한다. 나머지를 합성 선택으로 답하고 summary에서 `합성 두통`을 확인한 뒤 완료한다. request listener의 `/api/ai/` 배열은 끝까지 0건이어야 한다. body에는 Persona, fixture, 질문 번호, 고정 진행률이 없어야 한다.

- [ ] **Step 2: 프로필 snapshot 불변 E2E RED 작성**

첫 수동 문진을 완료하고 `/profile`에서 이름을 `수정한 테스트 사용자`로 바꾼다. IndexedDB evaluation으로 첫 completed interview snapshot은 `테스트 사용자`이고 current profile은 수정 이름인지 확인한다. 두 번째 문진을 완료한 뒤 새 snapshot만 수정 이름인지 확인한다.

- [ ] **Step 3: reset E2E RED 작성**

모든 store에 합성 데이터가 있는 상태에서 `/settings/data`로 이동해 dialog를 확인하고 삭제한다. 성공 status 뒤 IndexedDB transaction으로 8개 store count가 모두 0인지 확인한다. `처음부터 시작하기` 뒤 온보딩 heading을 확인한다.

- [ ] **Step 4: 신규 Chromium E2E 실행**

Run: `npm run build && npx playwright test tests/e2e/manual-profile-reset.spec.ts --project=chromium`

Expected before missing UI completion: FAIL. Tasks 1–7 완료 후 PASS.

- [ ] **Step 5: checklist와 작업일지 동기화**

U2의 manual flow, profile 수정, reset runtime 취소를 실제 test file과 assertion 수로 `[x]` 처리한다. U2 진행률은 모든 exit evidence가 통과한 뒤에만 완료로 올린다. U3는 수동 수직 흐름에 포함된 항목만 체크하고 measurement input·입력 방식 전환 등 미구현 항목은 그대로 둔다. 의료 콘텐츠 계약과 clinician view 차단도 그대로 유지한다.

- [ ] **Step 6: 전체 정적·unit·integration gate**

Run: `git diff --check`

Expected: exit 0.

Run: `npm run lint && npm run typecheck`

Expected: both exit 0.

Run: `npm run test:unit && npm run test:integration`

Expected: all test files pass.

- [ ] **Step 7: 전체 E2E와 production build**

Run: `npm run test:e2e`

Expected: production build와 Chromium 전체 E2E PASS.

`npm run test:e2e`가 선행 build를 포함하므로 별도 build가 필요하지 않지만 최종 로그에서 `Compiled successfully`와 모든 E2E pass를 확인한다.

- [ ] **Step 8: 최종 보안·범위 검토**

Run: `rg -n "persona|fixture" src/app/home src/app/interview/manual src/features/home src/features/interview/manual src/features/profile src/features/settings`

Expected: 공개 수동·프로필·삭제 경로에서 match 0건.

Run: `rg -n "getUserMedia|SpeechRecognition|webkitSpeechRecognition|input[^>]+type=[\"']file|/api/ai/" src/features/interview/manual src/features/profile src/features/settings`

Expected: 실제 media·AI IO match 0건.

- [ ] **Step 9: 사용자 검토 checkpoint**

`git status --short`, `git diff --stat`, 검증 결과, 알려진 `npm audit` 3건을 보고한다. 별도 요청 전 stage·commit·push·merge하지 않는다.
