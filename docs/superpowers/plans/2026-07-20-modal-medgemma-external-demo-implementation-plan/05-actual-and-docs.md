> [상위 계획](../2026-07-20-modal-medgemma-external-demo-implementation-plan.md)

### Task 5: actual gate·문서·최종 검증

**Files:**
- Create: `tests/actual/modal-medgemma.actual.test.ts`
- Create: `tests/actual/modal-quota.actual.test.ts`
- Create: `vitest.actual.config.ts`
- Create: `docs/worklogs/2026-07-20.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/README.md`
- Modify: `docs/plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan/03-scope-and-sources.md`
- Modify: `docs/plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan/07-units-u4-u6.md`
- Modify: `docs/plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan/10-open-questions-and-appendix.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/02-day-1-u1.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md`

- [ ] **Step 1: opt-in actual test를 작성한다**

`test:actual` script는 별도 `vitest.actual.config.ts`로 `tests/actual/**/*.actual.test.ts`만 수집하며 `RUN_MEDGEMMA_ACTUAL=1`이 아니면 명시적으로 skip한다. 활성화 시 persona마다 65초 idle을 확인한 뒤 cold 질문 1회, 이어서 warm 질문 2회와 요약 1회를 실행한다. version, slot, 한 문장·한 의도·쉬운 한국어, cold ≤60초, warm ≤15초를 검증하며 실패 출력에도 prompt·answer·response 본문을 넣지 않는다.

- [ ] **Step 2: credential 없는 전체 자동 검증을 통과시킨다**

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build && python3 -m pytest tests/modal`

Expected: 모두 PASS, actual test는 skip.

- [ ] **Step 3: 외부 상태 변경 전에 사용자 확인을 받는다**

사용자가 Modal 배포와 비용 발생을 승인하고 다음을 직접 준비했는지 확인한다: Hugging Face 모델 약관 수락, fine-grained read token을 `medgemma-hf` Secret에 등록, Modal proxy token 생성, Workspace 월 예산 $30 하드 캡 설정. 값은 채팅·문서·git에 복사하지 않는다.

- [ ] **Step 4: Modal을 배포하고 endpoint 인증을 확인한다**

Run: `modal deploy inference/modal_medgemma/medgemma_app.py --env main`

Expected: 배포 성공과 인증 endpoint URL 출력.

인증 헤더 없는 요청이 401이고 GPU container가 시작되지 않았는지 Modal dashboard에서 확인한다. endpoint URL과 proxy token은 배포 호스트의 server-only env에만 설정하고 `MEDGEMMA_ACTUAL_DISABLED=0`으로 전환한다.

- [ ] **Step 5: actual·abuse·fallback gate를 실행한다**

Run: `RUN_MEDGEMMA_ACTUAL=1 npm run test:actual`

Expected: 3 persona 질문 9회와 요약 3회 PASS.

테스트용 별도 Modal environment에 CPU-only quota app을 배포한다.

Run: `modal deploy inference/modal_medgemma/quota_smoke_app.py --env test`

동일 session 6번째, 동일 IP 21번째, 전체 101번째 요청이 429인지 확인하고 GPU container가 전혀 없는 app임을 dashboard에서 확인한다. 검증 뒤 `modal app stop medgemma-quota-smoke --env test`로 중지한다. 운영 adapter의 401/403/schema 오류 no-retry와 429/503 1회 retry도 payload 없는 지표로 확인한다.

Run: `RUN_MEDGEMMA_ACTUAL=1 npm run test:actual -- tests/actual/modal-quota.actual.test.ts`

`MODAL_QUOTA_SMOKE_URL`은 deploy 출력 URL, 인증값은 기존 server-only proxy token env를 사용한다. 테스트는 무인증 401과 인증 threshold를 검증하되 token·URL을 snapshot이나 작업일지에 쓰지 않는다.

- [ ] **Step 6: 문서와 체크리스트를 사실만 갱신한다**

Vertex는 변경 이력으로 남기고 현재 선택은 Modal로 표시한다. mock/actual/public-hosting 결과를 별도 행으로 기록한다. actual 미실행 항목은 완료 표시하지 않는다. 모든 새 주석과 작업일지는 한글로 작성한다.

- [ ] **Step 7: 최종 검증 후 멈춘다**

Run: `git diff --check && npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build`

Expected: 모두 PASS. `git status --short`에서 의도한 파일만 검토하고 commit·push하지 않는다.
