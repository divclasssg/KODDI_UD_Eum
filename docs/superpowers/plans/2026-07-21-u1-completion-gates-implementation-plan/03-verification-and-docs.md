> [상위 계획](../2026-07-21-u1-completion-gates-implementation-plan.md)

### Task 3: 운영 복구·전체 검증·문서 완료

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/02-day-1-u1.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md`
- Modify: `docs/worklogs/2026-07-21.md`
- Modify: `docs/superpowers/plans/2026-07-21-u1-completion-gates-implementation-plan.md`

**Interfaces:**
- Consumes: Task 1 primary contract, Task 2 `test:route-actual`, Modal `medgemma-runtime`
- Produces: U1 `1/9 units` 완료 증거, kill switch `1`·503·container 0 복구 증거

- [x] **Step 1: 외부 호출 전 로컬 전체 gate를 통과시킨다**

Run:

```text
git diff --check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run test:route-actual
npm run build
```

Expected: unit·일반 E2E·build PASS, route actual 1건은 flag가 없어 명시적 SKIP.

- [x] **Step 2: 실행 전 운영 상태를 확인한다**

Run: `modal container list --env main`

Expected: MedGemma 실행 container 0. 활성 container가 있으면 종료될 때까지 기다리고 새 요청을 보내지 않는다.

Modal dashboard에서 Workspace `$10` hard cap과 `medgemma-runtime` Secret 이름만 확인한다. credential 값은 읽거나 출력하지 않는다.

- [x] **Step 3: kill switch를 활성화하고 재배포한다**

Run: `modal secret create medgemma-runtime MEDGEMMA_ACTUAL_DISABLED=0 --env main --force`

Run: `modal deploy -m inference.modal_medgemma.medgemma_app --env main`

Expected: `main` 배포 성공. Secret 갱신만으로 완료 처리하지 않는다.

- [x] **Step 4: 합성 Persona 브라우저 질문 1회를 실행한다**

Run: `MEDGEMMA_MODE=modal MEDGEMMA_ACTUAL_DISABLED=0 RUN_MEDGEMMA_ROUTE_ACTUAL=1 npm run test:route-actual`

Expected: Playwright 1 PASS, `/api/ai/question` HTTP 200, 새 질문 표시. prompt·answer·response 본문·URL·token은 출력하지 않는다.

실패해도 추가 질문·요약·전체 actual suite를 실행하지 않고 즉시 Step 5로 이동한다.

실행 결과(2026-07-22): Node guard·Modal proxy 인증과 T4의 합성 질문 17토큰 생성은 확인했지만, Next provider 75초 제한 안에 웹 응답이 돌아오지 않아 `/api/ai/question` HTTP 502로 실패했다. 추가 actual은 실행하지 않는다.

재실행 결과(2026-07-22): browser actual server만 provider 상한 85초를 사용하도록 TDD 보정한 뒤, 사용자 승인에 따라 합성 질문 1회를 재검증했다. `/api/ai/question` HTTP 200과 새 질문 표시가 58.7초에 통과했다.

- [x] **Step 5: kill switch를 다시 잠그고 재배포한다**

Run: `modal secret create medgemma-runtime MEDGEMMA_ACTUAL_DISABLED=1 --env main --force`

Run: `modal deploy -m inference.modal_medgemma.medgemma_app --env main`

Expected: `main` 배포 성공. 이 단계는 Step 4 결과와 관계없이 반드시 실행한다.

- [x] **Step 6: 인증 503과 container 0을 확인한다**

server-only 환경 변수를 사용해 유효한 합성 request를 status-only 방식으로 보내고 HTTP 503을 확인한다. 출력은 status code만 허용한다.

Run:

```text
curl --silent --show-error --output /dev/null --write-out "%{http_code}\n" --request POST "$MODAL_MEDGEMMA_ENDPOINT_URL" --header "Content-Type: application/json" --header "Modal-Key: $MODAL_PROXY_TOKEN_ID" --header "Modal-Secret: $MODAL_PROXY_TOKEN_SECRET" --data '{"kind":"question","context":{"version":"1","interviewId":"u1-route-lock-check","personaId":"persona-kim","currentSlot":"chief-complaint","filledSlots":{"chief-complaint":"합성 역할극 답변"},"recentTurns":[{"id":"turn-u1-lock-check","question":"어디가 불편하신가요?","answer":"합성 역할극에서 두통이 있다고 답함"}]},"session_hash":"0000000000000000000000000000000000000000000000000000000000000000","ip_hash":"1111111111111111111111111111111111111111111111111111111111111111"}'
```

Run: `modal container list --env main`

Expected: scale-down 뒤 실행 container 0. 503 또는 container 0이 확인되지 않으면 U1을 완료 처리하지 않는다.

- [x] **Step 7: 체크리스트와 작업일지를 갱신한다**

- U1의 `한 화면에 질문 하나와 핵심 행동 하나만 노출`을 `[x]`로 바꾸고 primary fixture 테스트 증거를 기록한다.
- `Node.js Route Handler에서 인증 성공`은 실제 인증 통과 증거가 있을 때 `[x]`로 바꾼다.
- HTTP 200과 새 질문 표시가 실패하면 상위 진행률은 `0/9 units`로 유지한다.
- actual 실패가 있으면 숨기지 않고 작업일지와 진행 기록에 남긴다.
- 최종 kill switch `1`, 인증 503, container 0을 기록한다.

- [x] **Step 8: 문서 변경 뒤 최종 gate를 다시 실행한다**

Run: `git diff --check && npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build`

Expected: 모두 PASS. `git status --short`에서 의도한 U1 파일과 문서만 보이며 기존 사용자 `.gitignore` 변경은 제외된다.

실행 결과(2026-07-22): 85초 browser actual config 계약을 포함해 `git diff --check`, lint, typecheck, 단위 12개 파일·100건, Chromium E2E 14건, webpack production build가 통과했다. credential 없는 `test:route-actual`은 1건을 명시적으로 skip했다. 이후 승인된 합성 질문 1회 actual이 HTTP 200과 새 질문 표시를 통과했다.

- [x] **Step 9: 사용자 통합 요청을 확인한다**

2026-07-22 사용자가 commit과 로컬 `main` 병합을 요청했다. push는 요청 범위가 아니므로 실행하지 않는다.

```text
git add src/features/interview/interview-screen.tsx src/features/interview/interview-screen.module.scss src/features/interview/components/response-composer.tsx src/features/interview/components/error-notice.tsx src/features/interview/components/safety-notice.tsx src/features/interview/components/text-input.tsx src/features/interview/components/conversation-viewport.tsx tests/unit/interview/interview-primary-action.test.tsx playwright.actual.config.ts tests/actual/modal-route.actual.spec.ts package.json docs/superpowers/specs/2026-07-21-u1-completion-gates-design.md docs/superpowers/plans/2026-07-21-u1-completion-gates-implementation-plan.md docs/superpowers/plans/2026-07-21-u1-completion-gates-implementation-plan/01-primary-action-contract.md docs/superpowers/plans/2026-07-21-u1-completion-gates-implementation-plan/02-route-actual-gate.md docs/superpowers/plans/2026-07-21-u1-completion-gates-implementation-plan/03-verification-and-docs.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/02-day-1-u1.md docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md docs/worklogs/2026-07-21.md
git commit -m "fix(interview): complete U1 interaction and route gates"
git checkout main
git merge --ff-only codex/u1-completion-gates
```
