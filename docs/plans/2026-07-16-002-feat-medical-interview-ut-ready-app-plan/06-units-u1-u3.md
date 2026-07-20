> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [7일 일정과 위험](./05-schedule-and-risks.md)
> 다음: [구현 단위 U4~U6](./07-units-u4-u6.md)
## Implementation Units

### U1. Project Foundation, Tokens, and Representative Screen

**Goal:** 실행 가능한 Next.js 프로젝트와 Figma 교체 가능한 token, 실제 상태가 보이는 대표 문진 화면을 만든다.

**Requirements:** R1-R5

**Files:** `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/interview/new/page.tsx`, `src/features/interview/interview-screen.tsx`, `src/styles/_tokens.scss`, `src/styles/_reset.scss`, `src/styles/_layout.scss`, `src/styles/_interview.scss`, `src/styles/globals.scss`, `tests/e2e/interview-layout.spec.ts`

**Approach:** 393px에서 기본, 저장 중, AI 대기, 오류, 안전 안내, 요약 전환 상태를 fixture로 표시한다. Persona 계약을 반영해 본문 18px, 48px 조작 영역, 명시적 텍스트 라벨, 한 화면 한 행동을 기본값으로 둔다.

**Test Scenarios:**

1. 393px에서 질문, 입력, 진행 상태, 주요 행동이 잘리지 않는다.
2. A1 fixture에서 작은 보조 텍스트에 의존하지 않고 주요 내용을 읽을 수 있다.
3. loading, error, safety 상태가 색상 외 text·icon·role로 구분된다.
4. class name이 하이픈 convention을 따르고 `.env.local`이 git ignore된다.

**Verification:** lint, typecheck, production build, 393px layout E2E가 통과한다.

### U2. Consent, Profile, Local Data, and Reset

**Goal:** 동의와 최소 정보를 안전하게 저장하고 기록 snapshot·새로고침 복구·전체 삭제를 제공한다.

**Dependencies:** U1

**Requirements:** R6-R7, R15, R20

**Files:** `src/features/onboarding/*`, `src/features/profile/profile-form.tsx`, `src/features/settings/delete-all-data.tsx`, `src/lib/db/database.ts`, `src/lib/db/profile-repository.ts`, `src/lib/db/interview-repository.ts`, `src/lib/privacy/consent.ts`, `tests/integration/db/repositories.test.ts`, `tests/e2e/onboarding-reset.spec.ts`

**Approach:** 로컬 저장 동의와 AI 전송 동의를 분리한다. 저장 거부는 `ConsentBlocked`에서 재검토·종료만 제공하고, AI 거부는 홈의 manual flow로 연결한다. 완료 기록은 현재 profile을 참조하지 않고 immutable snapshot을 보관한다. 전체 삭제는 AI·TTS와 모의 음성 timer를 중단하고 모든 object store를 한 transaction으로 지운 뒤 성공을 표시한다.

**Test Scenarios:**

1. 로컬 저장 거부 시 IndexedDB 쓰기가 0건이고 `ConsentBlocked`에 이유·재검토·종료가 표시되며 Task 2·3 진입점이 없다.
2. AI 동의 거부 시 외부 요청이 0건이며 홈에서 manual flow를 선택할 수 있다.
3. 새로고침 뒤 profile과 진행 중 문진이 복구된다.
4. profile 수정 뒤 기존 기록 snapshot은 유지되고 새 기록만 새 값을 사용한다.
5. 전체 삭제 뒤 profile, medical profile, interview, message, draft, summary, attachment가 모두 0건이고 부분 삭제 실패가 없다.
6. reset·동의 철회 뒤 늦은 AI 응답이나 모의 음성 timer가 레코드를 복구하지 않는다.
7. 김영수 fixture는 목적·동의 설명을 명시적으로 들을 수 있고, 이민정 fixture는 한 화면 한 동의·구체적 라벨·이전 단계 복귀와 입력 보존으로 onboarding을 완료한다.

**Verification:** repository integration과 onboarding/reset E2E가 통과한다.

### U3. Interview State and Text-Based Inputs

**Goal:** 짧은 질문 하나에 텍스트·선택·측정값으로 답하고 입력 방식을 바꾸어도 draft를 보존한다.

**Dependencies:** U1, U2

**Requirements:** R5, R8, R10, R15

**Files:** `src/features/interview/interview-machine.ts`, `src/features/interview/interview-application-service.ts`, `src/features/interview/interview-store.ts`, `src/features/interview/question-card.tsx`, `src/features/inputs/input-switcher.tsx`, `src/features/inputs/text-input.tsx`, `src/features/inputs/choice-input.tsx`, `src/features/inputs/measurement-input.tsx`, `src/features/interview/manual-question-set.ts`, `tests/unit/interview/interview-machine.test.ts`, `tests/integration/interview/input-switching.test.tsx`

**Approach:** UI는 application service만 호출하고 pure machine은 IO를 모른다. 모든 입력 adapter가 하나의 draft를 사용한다. 각 명령은 `interviewId/revision/requestId`를 가지며 저장 transaction 완료 전 다음 질문으로 이동하지 않고 double submit과 stale response를 차단한다. manual question set도 같은 질문 카드와 answer schema를 사용한다.

**Test Scenarios:**

1. A2 fixture에서 질문 하나와 `예/아니오/모르겠음`만 먼저 보인다.
2. text에서 choice로 전환한 뒤 text draft로 돌아오면 내용이 남는다.
3. 빠른 두 번 제출에도 answer가 하나만 저장된다.
4. 저장 실패 시 입력과 현재 질문이 유지된다.
5. 질문 수 5개 뒤 추가 질문을 차단하고 요약으로 이동한다.
6. navigation·reset으로 revision이 바뀌면 이전 requestId의 늦은 성공 응답을 폐기한다.

**Verification:** state unit과 input integration이 통과한다.
