# U2 IndexedDB v1 실제 제품형 온보딩 개정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma의 스플래시·소개·프로필·의료정보 흐름 전체를 온보딩으로 반영하고, 만 14세 제한과 확장된 IndexedDB v1 계약을 실제 제품 경계로 고정한다.

**Architecture:** 기존 8-store schema와 단일 transaction 완료 저장은 유지한다. `contracts.ts`의 profile/medical/consent record shape를 출시 전 v1로 개정하고, 순수 reducer·validator가 자격과 의료정보를 정규화한 뒤 UI가 한 번의 `OnboardingRepository.complete()`만 호출한다. 음성·사진은 공개 버튼과 준비 중 안내만 제공하고 권한·파일·네트워크 IO는 만들지 않는다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, native IndexedDB, SCSS modules, Vitest 4, Testing Library, fake-indexeddb, Playwright 1.61

## Global Constraints

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 공개 데모는 실제 제품 흐름이며 Persona 선택·주입을 노출하지 않는다.
- 테스트에는 합성·비식별 fixture만 사용한다.
- 만 14세 미만, 로컬 저장 거부, 민감정보 처리 거부는 database open·write·외부 요청이 0회다.
- 실제 음성·마이크·STT·사진 선택·사진 판독을 실행하지 않는다.
- 질문 단계 번호와 고정 진행률을 표시하지 않는다.
- Modal actual, 배포, GPU 호출을 실행하지 않는다.
- credential 값이나 실제 payload를 출력·문서화·커밋하지 않는다.
- root `.gitignore`와 `stash@{0}`을 건드리지 않는다.
- 별도 요청 전 commit, push, main 병합을 하지 않는다.

---

### Task 1: v1 record와 완료 snapshot 개정

**Files:**
- Modify: `src/lib/db/contracts.ts`
- Modify: `src/lib/db/interview-repository.ts`
- Modify: `tests/integration/db/fixtures.ts`
- Test: `tests/integration/db/onboarding-repository.test.ts`
- Test: `tests/integration/db/consent-profile-repositories.test.ts`
- Test: `tests/integration/db/interview-repository.test.ts`

**Interfaces:**
- Produces: `ProfileRecordV1.birthDate`, `ConsentRecordV1.sensitiveHealth`, `LifestyleAnswerV1`, 확장된 `MedicalProfileRecordV1`

- [x] **Step 1: 새 record assertion을 먼저 작성한다.**

```ts
expect(saved.profile.birthDate).toBe("1960-05-20");
expect(saved.medicalProfile.familyHistory).toEqual({ state: "unknown" });
expect(saved.medicalProfile.smoking).toEqual({ state: "no" });
```

- [x] **Step 2: integration test를 실행해 RED를 확인한다.**

Run: `npm run test:integration -- tests/integration/db/onboarding-repository.test.ts tests/integration/db/consent-profile-repositories.test.ts tests/integration/db/interview-repository.test.ts`

Expected: 저장 결과에 `sensitiveHealth`, `birthDate`, 확장 의료정보가 없어 FAIL.

- [x] **Step 3: record type과 완료 snapshot을 최소 구현한다.**

```ts
export type LifestyleAnswerV1 =
  | { state: "yes"; details?: string }
  | { state: "no" }
  | { state: "unknown" };
```

store·key·index·database version은 바꾸지 않고 `interview-repository.ts`의 snapshot deep clone에 모든 새 필드를 포함한다.

- [x] **Step 4: 같은 integration 명령과 `npm run typecheck`로 GREEN을 확인한다.**

### Task 2: 만 14세와 의료정보 정규화

**Files:**
- Modify: `src/features/onboarding/onboarding.types.ts`
- Modify: `src/features/onboarding/onboarding-machine.ts`
- Test: `tests/unit/onboarding/onboarding-machine.test.ts`

**Interfaces:**
- Produces: `validateEligibility(birthDate, now)`, `validateBasicProfile(input, now)`, 확장된 `normalizeMedicalProfile(input)`

- [x] **Step 1: 생년월일 경계 test를 작성한다.**

```ts
expect(validateEligibility("2012-07-22", now)).toEqual({ eligible: true });
expect(validateEligibility("2012-07-23", now)).toEqual({
  eligible: false,
  reason: "under-14",
});
```

윤년 생년월일, 미래 날짜, 130세 초과도 각각 분리해 test한다.

- [x] **Step 2: 가족력·병력·수술력과 흡연·음주 정규화 test를 작성하고 RED를 확인한다.**

Run: `npm run test:unit -- tests/unit/onboarding/onboarding-machine.test.ts`

Expected: 새 함수와 필드가 없어 FAIL.

- [x] **Step 3: 서울 날짜 기준 date-only 계산과 새 draft/normalizer를 최소 구현한다.**

`YYYY-MM-DD`를 직접 검증하고 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })`에서 기준 날짜를 얻는다. 나이는 record에 저장하지 않는다.

- [x] **Step 4: 같은 unit 명령과 `npm run typecheck`로 GREEN을 확인한다.**

### Task 3: 전체 온보딩 상태와 쓰기 금지 경계

**Files:**
- Modify: `src/features/onboarding/onboarding.types.ts`
- Modify: `src/features/onboarding/onboarding-machine.ts`
- Modify: `tests/unit/onboarding/onboarding-machine.test.ts`
- Modify: `tests/unit/onboarding/onboarding-screen.test.tsx`

**Interfaces:**
- Produces: `splash → input-intro → clinician-intro → eligibility → local-consent → sensitive-consent → ai-consent → basic-profile → profile-review → medical-menu → completion`

- [x] **Step 1: 만 14세 미만과 민감정보 거부가 blocked 상태로 가고 `complete`를 호출하지 않는 test를 작성한다.**
- [x] **Step 2: 의료정보 메뉴에서 항목 입력 뒤 메뉴 복귀와 종료가 가능하고 draft가 보존되는 test를 작성한다.**
- [x] **Step 3: 두 onboarding unit test file을 실행해 RED를 확인한다.**

Run: `npm run test:unit -- tests/unit/onboarding/onboarding-machine.test.ts tests/unit/onboarding/onboarding-screen.test.tsx`

Expected: 새 상태와 화면이 없어 FAIL.

- [x] **Step 4: 인접 전이 reducer와 화면을 추가한다.**

완료 시에만 `complete()`를 호출하고, `age-blocked`와 두 필수 동의 거부에서는 호출 경로 자체를 제공하지 않는다.

- [x] **Step 5: 같은 unit 명령으로 GREEN을 확인한다.**

### Task 4: 음성·사진 준비 중 계약과 Figma형 화면

**Files:**
- Modify: `src/features/onboarding/onboarding-screen.tsx`
- Modify: `src/features/onboarding/onboarding-screen.module.scss`
- Modify: `tests/unit/onboarding/onboarding-screen.test.tsx`
- Modify: `tests/e2e/onboarding-home.spec.ts`

**Interfaces:**
- Produces: 접근성 이름 `음성 입력, 준비 중`, `사진 추가, 준비 중`과 IO 없는 안내 dialog/status

- [x] **Step 1: 미디어 entry point test를 작성한다.**

```tsx
expect(screen.getByRole("button", { name: "음성 입력, 준비 중" })).toBeVisible();
expect(screen.getByRole("button", { name: "사진 추가, 준비 중" })).toBeVisible();
```

클릭 뒤 안내가 보이고 `navigator.mediaDevices.getUserMedia`와 file input이 호출·생성되지 않음을 함께 검증한다.

- [x] **Step 2: component test를 실행해 RED를 확인한다.**

Run: `npm run test:unit -- tests/unit/onboarding/onboarding-screen.test.tsx`

Expected: 두 버튼과 안내가 없어 FAIL.

- [x] **Step 3: Figma 정보 구조의 화면과 미디어 안내를 최소 구현한다.**

큰 조작 영역, 명시적 이전/다음, 의료정보 메뉴를 제공하되 성공한 미디어 분석 화면과 file input은 만들지 않는다.

- [x] **Step 4: component test를 실행해 GREEN을 확인한다.**
- [x] **Step 5: 합성 값만 사용하는 E2E를 새 화면 순서로 수정한다.**

### Task 5: 문서 동기화와 전체 검증

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/03-day-2-u2-u3.md`
- Modify: `docs/worklogs/2026-07-22.md`

- [x] **Step 1: 변경된 계약과 경계를 체크리스트·작업일지에 기록한다.**
- [x] **Step 2: whitespace와 정적 검증을 실행한다.**

Run: `git diff --check && npm run lint && npm run typecheck`

- [x] **Step 3: 전체 unit·integration test를 실행한다.**

Run: `npm run test:unit && npm run test:integration`

- [x] **Step 4: 관련 Chromium E2E를 실행한다.**

Run: `npm run build && npx playwright test tests/e2e/onboarding-home.spec.ts --project=chromium`

- [x] **Step 5: production build를 실행한다.**

Run: `npm run build`

Expected: 모든 명령 exit 0. commit·push·merge는 수행하지 않는다.

## Self-Review

- 생년월일, 만 14세, 민감정보 동의, 확장 의료정보, 원자적 저장, snapshot, 음성·사진 존재 계약을 Task 1~4에 연결했다.
- database name/version, 8개 store, key/index, reset/revision guard는 변경하지 않는다.
- 비상 연락처와 실제 미디어 처리는 제외했고 공개 UI가 성공을 가장하지 않도록 test 경계를 명시했다.
- 타입 이름은 `birthDate`, `sensitiveHealth`, `familyHistory`, `medicalHistory`, `surgicalHistory`, `smoking`, `alcohol`로 통일했다.
