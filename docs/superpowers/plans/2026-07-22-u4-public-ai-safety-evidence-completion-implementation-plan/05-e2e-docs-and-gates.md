# Tasks 8–9 · E2E, Documentation, and Gates

> [상위 계획](../2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan.md)

## Task 8: Browser Integration and Actual Harness

**Files:** create `tests/e2e/public-ai-interview.spec.ts`, `tests/actual/public-ai-interview.actual.spec.ts`; modify onboarding E2E와 actual config.

**Produces:** credential-free public journey와 opt-in 실제 질문 1회·요약 1회 증거.

- [ ] **Step 1: credential-free E2E를 작성한다**

합성 사용자 onboarding AI 동의→home→AI interview를 진행하고 V2 Route를 deterministic response로 intercept한다.

- 첫 답변 V2 payload에 Persona/profile/이름/생년월일 없음
- generated question 표시와 reload 복원
- summary evidence 표시→review→completed
- 완료 전 외부 공유·clinician link 없음
- reset 뒤 늦은 Route response가 UI/IndexedDB를 바꾸지 않음
- AI 비동의 case의 `/api/ai/*` 요청 0회

- [ ] **Step 2: targeted Chromium RED를 확인한다**

```bash
npm run build
npx playwright test tests/e2e/public-ai-interview.spec.ts tests/e2e/onboarding-home.spec.ts --project=chromium
```

Expected: public AI journey assertion이 FAIL. build 뒤 source가 바뀌기 전에는 반복하지 않는다.

- [ ] **Step 3: failure만 좁혀 GREEN으로 만든다**

affected source가 바뀐 뒤 targeted Playwright만 재실행한다. Expected: 신규 public cases와 onboarding 회귀 PASS.

- [ ] **Step 4: actual harness를 작성하되 실행하지 않는다**

`PUBLIC_AI_MAX_FOLLOW_UPS=1`과 합성·비식별 입력을 사용한다. onboarding→home→실제 질문 표시→합성 답변→실제 summary 표시를 검증한다. kill switch 복구 절차를 기존 harness와 공유하고 credential/prompt/payload를 artifact에 남기지 않는다.

- [ ] **Step 5: 별도 비용 승인 후에만 actual을 실행한다**

```bash
npm run test:route-actual -- tests/actual/public-ai-interview.actual.spec.ts
```

Expected: 실제 질문 1회와 실제 요약 1회가 public UI에 표시되고 PASS. 실패 시 자동 반복하지 않고 GPU 호출 횟수와 원인을 보고한다.

## Task 9: Documentation and Milestone Gates

**Files:** modify `docs/README.md`, U4 checklist/status, `docs/worklogs/2026-07-22.md`.

- [ ] **Step 1: 관련 suites를 실행한다**

독립 명령은 병렬 실행한다.

```bash
npx vitest run tests/unit/ai tests/unit/interview tests/unit/home
npx vitest run --config vitest.integration.config.ts tests/integration/db/interview-repository.test.ts tests/integration/interview
.venv/bin/python -m pytest tests/modal -q
git diff --check
```

Expected: 모두 PASS. 실패하면 해당 file/test name만 좁힌다.

- [ ] **Step 2: milestone full non-E2E gates를 한 번 실행한다**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
```

서로 독립적으로 병렬 실행한다. 이후 source가 바뀌면 영향 test만 실행하고 최종 source 변경이면 full gate를 갱신한다.

- [ ] **Step 3: 전체 Chromium을 최종 통합 지점에서 한 번 실행한다**

```bash
npm run test:e2e
```

Expected: production build와 전체 Chromium PASS. 같은 tree에서 별도 build를 반복하지 않는다.

- [ ] **Step 4: 문서를 실제 증거와 동기화한다**

- actual 미실행이면 actual `[ ]`를 유지한다.
- actual 질문·요약이 승인 후 통과했을 때만 해당 exit evidence를 `[x]`로 바꾼다.
- clinician view, 실제 share, 포괄적 triage 제외를 명시한다.
- test 수, 명령 결과, tree를 작업일지에 기록한다.

- [ ] **Step 5: 문서 정합성을 확인한다**

```bash
git diff --check
rg -n "U4|public AI|실제 MedGemma|actual" docs/README.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist* docs/worklogs/2026-07-22.md
git status --short
```

Expected: 링크/상태 일치, 사용자 `.gitignore`는 기존 별도 변경으로 남는다.

- [ ] **Step 6: 완료를 보고한다**

commit·push·main merge는 실행하지 않는다. 사용자가 요청할 때 검증 tree를 확인하고 shipping workflow를 시작한다.
