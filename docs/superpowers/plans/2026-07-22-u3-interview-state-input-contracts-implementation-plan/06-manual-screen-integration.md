> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 6: Manual 공개 화면 연결

**Files:**
- Modify: `src/features/interview/manual/manual-interview-screen.tsx`
- Modify: `src/features/interview/manual/manual-interview-screen.module.scss`
- Modify: `src/features/interview/manual/manual-question-set.ts`
- Modify: `tests/unit/interview/manual-interview-screen.test.tsx`
- Modify: `tests/unit/interview/manual-interview-service.test.ts`

**Interfaces:**
- Consumes: Task 4 application service, Task 5 adapters
- Produces: `/interview/manual` actual product UI with V2 draft switching

- [ ] **Step 1: screen 경계 RED 작성**

render 뒤 기간과 강도 질문은 chip adapter, pattern은 choice, chief complaint/additional은 text로 보이는지 검증한다. 두 mode가 허용된 질문에는 switcher가 있고 Persona/fixture/질문 번호/고정 진행률이 없어야 한다.

- [ ] **Step 2: 저장 중 navigation·실패 보존 RED 작성**

deferred persist와 submit으로 `나중에 계속하기`가 dirty/saving/submitting 동안 이동하지 않는지, double click이 submit port 1회인지 확인한다. failure event 뒤 current heading, text/chip/measurement branches가 유지되고 stale failure alert는 나타나지 않는지 검증한다.

- [ ] **Step 3: RED 확인**

Run: `npm run test:unit -- tests/unit/interview/manual-interview-screen.test.tsx tests/unit/interview/manual-interview-service.test.ts`

Expected: FAIL because current screen owns local pending/state and has no V2 adapters.

- [ ] **Step 4: screen을 machine state renderer로 교체**

Client Component는 application service state를 subscribe하고 user interaction을 event로 dispatch한다. browser wrapper만 IndexedDB repository adapter와 `useRouter` navigate port를 조립한다. loading/answering/review/completed/error copy는 현재 공개 문구를 유지한다.

- [ ] **Step 5: unload·dispose 경계 구현**

dirty/saving일 때만 `beforeunload` preventDefault handler를 등록하고 clean이면 제거한다. component unmount는 service `dispose()`만 호출하며 runtime global generation을 증가시키지 않는다.

- [ ] **Step 6: 준비 중 media 경계 회귀 검증**

기존 음성·사진 진입점은 준비 중 dialog만 유지한다. manual source에서 마이크 permission, file input, STT, AI route가 0건인지 component spy와 source search로 확인한다.

- [ ] **Step 7: 관련 GREEN**

Run: `npm run test:unit -- tests/unit/interview/manual-interview-screen.test.tsx tests/unit/interview/manual-interview-service.test.ts tests/unit/inputs`

Expected: screen, switching, pending navigation, stale failure, media boundary tests PASS.

Run: `npm run lint && npm run typecheck && git diff --check`

Expected: exit 0.
