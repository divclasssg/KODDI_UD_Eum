> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 7: E2E·문서·전체 Gate

**Files:**
- Modify: `tests/e2e/manual-profile-reset.spec.ts`
- Modify: `docs/README.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/03-day-2-u2-u3.md`
- Modify: `docs/worklogs/2026-07-22.md`

**Interfaces:**
- Consumes: Tasks 1–6 actual manual flow
- Produces: U3 exit evidence and synchronized documentation

- [ ] **Step 1: Chromium input switching·reload RED 작성**

AI 거부 합성 onboarding 뒤 manual을 시작한다. onset에서 text를 입력하고 duration chip을 선택한 뒤 text로 돌아가 값이 남는지 확인한다. chip mode로 돌아가 reload하고 active mode와 chip/text draft가 모두 복원되는지 확인한다. severity chip을 선택하고 기존 최대 5질문 review·complete 흐름을 끝낸다.

- [ ] **Step 2: 공개·외부 IO assertion 추가**

request listener로 `/api/ai/` 요청 배열이 0건인지 확인한다. body에 `/persona|페르소나|fixture|역할극|\d+\/\d+|\d+%/i`가 없고, `getUserMedia`, file chooser, permission prompt가 발생하지 않는지 기존 helper와 함께 검증한다.

- [ ] **Step 3: 관련 E2E RED 확인**

Run: `npm run build && npx playwright test tests/e2e/manual-profile-reset.spec.ts --project=chromium`

Expected before Task 6 completion: FAIL on missing switcher/chip/reload draft assertions. After Task 6: PASS.

- [ ] **Step 4: 체크리스트를 실제 증거로만 갱신**

pure machine, identifier contract, chip, input switching, measurement component/integration, stale response를 test file·test count와 함께 `[x]` 처리한다. 공개 증상 preset 또는 공개 measurement 질문을 권장안대로 구현하지 않았다면 해당 제품 노출을 완료라고 과장하지 않고 결정 gate를 기록한다.

- [ ] **Step 5: 작업일지와 문서 index 갱신**

설계·계획 링크, RED→GREEN 순서, 실제 command 결과, database version 1/8-store 유지, 외부 IO 0건, 알려진 경고를 기록한다. credential이나 실제 payload는 기록하지 않는다.

- [ ] **Step 6: diff·정적 gate**

Run: `git diff --check`

Expected: exit 0.

Run: `npm run lint && npm run typecheck`

Expected: both exit 0.

- [ ] **Step 7: 관련·전체 unit/integration gate**

Run: `npm run test:unit -- tests/unit/interview/interview-machine.test.ts tests/unit/interview/interview-draft.test.ts tests/unit/interview/interview-application-service.test.ts tests/unit/interview/manual-interview-screen.test.tsx tests/unit/inputs`

Expected: all related files PASS.

Run: `npm run test:integration -- tests/integration/interview/input-switching.test.tsx tests/integration/db/interview-repository.test.ts tests/integration/db/reset-revision-guard.test.ts tests/integration/db/schema.test.ts`

Expected: all related integration files PASS.

Run: `npm run test:unit && npm run test:integration`

Expected: all unit and integration files PASS.

- [ ] **Step 8: 전체 Chromium E2E와 production build**

Run: `npm run test:e2e`

Expected: production build compiles and all Chromium E2E PASS. Sandbox localhost `EPERM`이면 동일한 credential-free command만 승인된 sandbox 밖에서 재실행한다.

- [ ] **Step 9: 공개 경계 source 검토**

Run: `rg -n "persona|페르소나|fixture|역할극" src/app/home src/app/interview/manual src/features/home src/features/interview/manual src/features/inputs`

Expected: public copy/runtime path 0 matches. Type/test-only false positive는 파일과 이유를 기록한다.

Run: `rg -n "getUserMedia|SpeechRecognition|webkitSpeechRecognition|input[^>]+type=[\"']file|/api/ai/|fetch\(" src/features/interview/manual src/features/inputs`

Expected: actual AI/media operation 0 matches.

- [ ] **Step 10: 사용자 자산 보존 최종 확인**

원본 root에서 `git diff -- .gitignore`, `git stash list`, `git status --short --branch`를 초기 캡처와 비교한다. worktree에서는 새 문서·구현 변경만 존재해야 한다. `.gitignore`와 stash를 stage·stash·apply·drop하지 않는다.

- [ ] **Step 11: 승인 전 handoff**

변경 파일, test counts, 경고, 미완료 제품 gate를 보고한다. commit, push, main merge는 실행하지 않는다.
