> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [구현 단위 U4~U6](./07-units-u4-u6.md)
> 다음: [검증 계약과 완료 기준](./09-verification-and-dod.md)
### U7. Previous Records, Profile Edit, and Snapshot Integrity

**Goal:** 이전 기록을 확인하고 내 정보를 수정하는 상황 3을 완성한다.

**Dependencies:** U2, U6

**Requirements:** R7, R19-R20

**Files:** `src/app/profile/page.tsx`, `src/features/profile/profile-form.tsx`, `src/features/profile/profile-summary.tsx`, `src/features/records/record-list.tsx`, `tests/integration/profile/snapshot-integrity.test.ts`, `tests/e2e/task-3-history-profile.spec.ts`

**Approach:** `RecordList → RecordDetail → ProfileEdit → SavingProfile → Saved | SaveFailed`와 `DiscardConfirm`을 구현한다. records와 profile을 하단 또는 동일한 일관된 navigation pattern에서 찾게 한다. profile edit은 한 section씩 저장하고 변경 완료를 text로 알린다. 저장 완료 전 current profile과 과거 snapshot은 바꾸지 않고 실패 시 편집 초안을 보존한다.

**Test Scenarios:**

1. 날짜가 다른 두 기록 중 과거 기록을 선택하고 상세를 연다.
2. 기록에서 profile로 이동해 기본정보를 수정하고 완료 상태를 확인한다.
3. 수정 후 과거 기록의 이름·나이·의료정보 snapshot이 변하지 않는다.
4. validation 오류는 해당 field와 요약 위치에 쉬운 문장으로 표시된다.
5. keyboard만으로 기록 확인과 profile 저장을 완료한다.
6. 저장 실패 재시도, 취소, 뒤로가기 이탈 확인, 새로고침 뒤 편집 초안 복구가 기존 profile과 snapshot을 오염시키지 않는다.
7. 세 Persona가 짧은 섹션·현재 값 유지·낮은 입력 부담·일관된 내비게이션으로 Task 3을 완주한다.

**Verification:** snapshot integration과 상황 3 E2E가 통과한다.

### U8. Conditional Photo Input

**Goal:** 핵심 과업이 먼저 통과한 경우에만 사진을 실제 MedGemma 입력으로 제공한다.

**Dependencies:** U2, U3, U4; Day 5 core gate 통과 후에만 시작

**Requirements:** R21

**Files:** `src/features/inputs/photo-input.tsx`, `src/lib/media/compress-image.ts`, `src/lib/db/attachment-repository.ts`, `src/lib/ai/modal-medgemma-adapter.ts`, `tests/unit/media/compress-image.test.ts`, `tests/integration/interview/photo-input.test.tsx`, `tests/e2e/actual-photo-medgemma.spec.ts`

**Approach:** 촬영·선택 뒤 크기·형식을 검사하고 client에서 압축한다. 사용자가 미리보기와 전송 범위를 확인한 뒤 저장·전송한다. actual multimodal response까지 통과하지 않으면 feature flag를 켜지 않는다.

**Test Scenarios:**

1. 허용 이미지가 압축·미리보기·삭제되고 새로고침 뒤 복구된다.
2. 과대 파일·미지원 형식·압축 실패에서 원본을 전송하지 않는다.
3. 별도 동의 전 사진 bytes가 Modal 요청에 포함되지 않는다.
4. 사진이 실제 MedGemma 질문 context에 포함되고 결과가 같은 validator를 통과한다.
5. flag off build에는 사진 control과 빈 navigation이 없다.

**Verification:** core gate 통과 증거와 actual multimodal E2E가 모두 있을 때만 완료한다.

### U9. Figma Integration and Three-Task Hardening

**Goal:** 사용자가 제공한 필수 UI를 반영하고 세 과업을 안정적으로 반복할 수 있게 한다.

**Dependencies:** U1-U7, U8 when enabled

**Requirements:** R1-R20, R21 when enabled; R22 is deferred

**Files:** `src/styles/_tokens.scss`, feature SCSS partials, `README.md`, `.env.example`, `tests/e2e/task-1-interview.spec.ts`, `tests/e2e/task-2-clinician-view.spec.ts`, `tests/e2e/task-3-history-profile.spec.ts`, `tests/e2e/persona-accessibility.spec.ts`, `tests/e2e/error-recovery.spec.ts`

**Approach:** Figma token과 필수 UI를 먼저 매핑하고 나머지는 같은 spacing·typography·state pattern을 사용한다. 세 Persona fixture와 세 상황을 product regression으로 사용하되 AI Persona 실행·채점 코드는 작성하지 않는다.

**Test Scenarios:**

1. 상황 1이 세 Persona fixture에서 실제 질문·요약 확정까지 완주한다.
2. AI 비동의와 provider 실패 각각에서 manual question set → deterministic summary 검토·확정 → completed 저장 → 기록 상세까지 완주한다.
3. 상황 2가 세 Persona fixture에서 오늘 완료 기록과 clinician view까지 완주한다.
4. 상황 3이 세 Persona fixture에서 과거 기록과 profile edit까지 완주한다.
5. 393px에서 18px body, 48px target, visible focus, live status가 유지된다.
6. AI·모의 음성·IndexedDB 실패에서 입력을 잃지 않고 대체 행동을 제공한다.
7. client bundle과 browser log에 credential, access token, system prompt, 의료 payload가 없다.
8. 하나의 IndexedDB 상태와 동일 `interviewId`로 onboarding → 문진 → 요약 확정 → completed 저장 → 홈 → 오늘 기록 → clinician view를 연속 완주한다. Task 3은 같은 current profile과 과거 snapshot fixture를 함께 사용한다.
9. production build와 README의 mock/actual 실행 설명이 일치한다.

**Verification:** 모든 automated gate, 실제 MedGemma rehearsal, Figma visual review가 통과한다.

---
