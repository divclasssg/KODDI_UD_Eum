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

- [x] **Step 1: opt-in actual test를 작성한다**

`test:actual` script는 별도 `vitest.actual.config.ts`로 `tests/actual/**/*.actual.test.ts`만 수집하며 `RUN_MEDGEMMA_ACTUAL=1`이 아니면 명시적으로 skip한다. 활성화 시 persona마다 90초 idle을 확인한 뒤 cold 질문 1회, 이어서 warm 질문 2회와 요약 1회를 실행한다. version, slot, 한 문장·한 의도·쉬운 한국어, 비용 우선 cold ≤75초, warm ≤15초를 검증하며 실패 출력에도 prompt·answer·response 본문을 넣지 않는다. cold 요청 timeout은 85초로 두어 성능 실패와 전송 timeout을 구분한다. 세 Persona는 단일 fail-fast 테스트에서 순차 실행하며 실행마다 비식별 session/IP hash를 새로 만든다.

- [x] **Step 2: credential 없는 전체 자동 검증을 통과시킨다**

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build && python3 -m pytest tests/modal`

Expected: 모두 PASS, actual test는 skip.

증거(2026-07-21): `npm run test:actual`에서 actual 5건이 명시적으로 skip되었고, lint·typecheck·단위 86건·Chromium E2E 14건·webpack production build·Modal Python 36건이 통과했다. 시스템 `python3`에는 pytest가 없어 저장소 `.venv/bin/python -m pytest tests/modal`로 같은 Python gate를 실행했다. Next.js 16 Turbopack production build는 캐시·worker 설정과 무관하게 반복 정지하여 공식 `--webpack` opt-out을 기본 build script에 적용했다.

- [x] **Step 3: 외부 상태 변경 전에 사용자 확인을 받는다**

사용자가 Modal 배포와 비용 발생을 승인하고 다음을 직접 준비했는지 확인한다: Hugging Face 모델 약관 수락, fine-grained read token을 `medgemma-hf` Secret에 등록, Modal proxy token 생성, Workspace 월 예산 $30 하드 캡 설정. 값은 채팅·문서·git에 복사하지 않는다.

확인(2026-07-21): 사용자가 약관, `medgemma-hf`, `medgemma-runtime=1`, proxy token과 배포·비용 발생 승인을 확인했다. Workspace hard cap은 계획보다 엄격한 `$10`으로 설정했다. Modal 프로필과 `main`의 두 Secret 이름은 확인했으며 값은 읽거나 기록하지 않았다.

- [x] **Step 4: Modal을 배포하고 endpoint 인증을 확인한다**

Run: `modal deploy inference/modal_medgemma/medgemma_app.py --env main`

Expected: 배포 성공과 인증 endpoint URL 출력.

인증 헤더 없는 요청이 401이고 GPU container가 시작되지 않았는지 Modal dashboard에서 확인한다. endpoint URL과 proxy token은 배포 호스트의 server-only env에만 설정하고 `MEDGEMMA_ACTUAL_DISABLED=0`으로 전환한다.

진행(2026-07-21): 파일 경로 배포는 상대 import 때문에 실패해 Modal 안내에 따라 module mode로 교정했다. `transformers==5.14.1`과 충돌하던 `huggingface-hub==1.3.4`를 호환 최솟값 `1.5.0`으로 TDD 수정한 뒤 `main` 배포와 gated model 이미지 다운로드가 성공했다. 무인증 POST 401과 인증 요청의 GPU 이전 `actual-disabled` 503을 본문 기록 없이 확인했다. server-only 로컬 proxy 환경 변수도 설정됐으며 `medgemma-runtime`은 `MEDGEMMA_ACTUAL_DISABLED=1`로 잠겨 있다.

진단(2026-07-21): 인증 kill-switch 503과 GPU 미기동을 확인한 뒤 actual을 잠시 활성화했다. 첫 actual은 processor 선택 의존성 누락으로 실패해 호환되는 `torchvision==0.28.0`과 `pillow==12.3.0`을 TDD 추가했다. 모델은 T4에서 입력 192개를 정상 인식했지만 출력 96개가 모두 PAD였고 실제 문자는 0개였다. 비용 절감을 우선해 생성 대신 첫 토큰 forward만 기본·eager attention으로 각각 한 번 계측했으며, 두 경로 모두 logits 262,208개가 전부 NaN이었다. 따라서 직접 원인은 T4 float16 forward의 수치 붕괴이며 prompt·생성 반복·attention backend는 배제됐다. 정확히 처음 NaN이 생기는 layer·연산은 아직 특정하지 않았다. 진단 코드는 제거했고 actual은 `1`로 다시 잠갔다.

8비트 검증(2026-07-21): T4 공식 지원 범위인 `bitsandbytes==0.49.2`와 `load_in_8bit=True`, float32 잔여 연산을 TDD 추가했다. 첫 logits 262,208개가 모두 유한했고 메모리는 약 6.34GB였으며, 제한한 8토큰은 PAD 없이 모두 디코딩됐다. 그러나 cold 질문은 web 함수 65초 timeout으로 500이 됐고 GPU는 취소 뒤 96토큰 생성을 완료했다. 즉 cold ≤60초를 충족하지 못했다. 이어진 warm 질문은 24.7초에 HTTP 200이었지만 96토큰 내 JSON이 완성되지 않아 schema gate와 warm ≤15초를 모두 실패했다. 비용 우선 원칙에 따라 4비트·추가 토큰 검증은 실행하지 않고 actual을 `1`로 잠갔다.

compact JSON 재검증(2026-07-21): 질문 prompt에 단일 JSON 객체, 앞뒤 설명·Markdown·코드펜스 금지, 고정 field, 단일 짧은 option 예시를 RED 테스트부터 추가했다. Python 27건·TypeScript 단위 85건·lint·typecheck가 통과한 뒤 합성 cold seed 1회와 warm 질문 1회만 실행했다. warm은 26.5초였고 96토큰을 모두 사용한 뒤 EOS 없이 내부 JSON이 완성되지 않아 warm ≤15초와 schema gate를 다시 실패했다. warm gate가 선행 조건을 통과하지 못했으므로 cold 최적화·4비트·전체 actual suite는 진행하지 않았고 kill switch를 `1`로 복구했다.

운영 확인(2026-07-21): `modal secret create --force`로 kill switch를 `1`로 덮어쓴 직후 기존 web 컨테이너가 이전 값 `0`을 계속 사용해 첫 확인 요청이 200이었다. 같은 소스를 재배포해 컨테이너를 교체한 뒤 503 `actual-disabled`를 확인했다. 이후 kill switch 변경은 Secret 갱신만으로 완료 처리하지 않고 반드시 재배포와 인증 503 확인을 함께 수행한다.

assistant prefill 검증(2026-07-21): 전체 provider JSON 예시를 제거하고 assistant 응답을 `{\"slot\":\"`에서 이어 쓰게 했다. 모델은 slot·text만 최대 64토큰 생성하며 런타임이 strict parse 후 고정 필드를 조립한다. 모든 slot이 있으면 생성 없이 complete를 반환한다. Python 34건·TypeScript 단위 85건·lint·typecheck 통과 후 생성 없는 cold seed는 53.9초, 측정 warm 질문은 9.0초·유효 JSON으로 gate를 통과했다. 새 배포의 실제 cold 질문도 유효 JSON이었지만 67.2초로 cold ≤60초를 실패했다.

cold 최적화 검토(2026-07-21): Modal 공식 문서의 alpha GPU memory snapshot을 TDD로 잠시 적용했다. 최초 seed가 web 65초 timeout으로 500이 됐고 snapshot 컨테이너는 생성 완료 없이 Pending 상태에 머물렀다. 추가 비용을 막기 위해 해당 GPU 컨테이너만 종료하고 snapshot 코드·테스트를 되돌렸다. prefill 런타임은 유지하되 actual은 Secret `1` 갱신과 재배포 후 503 `actual-disabled`를 확인했다.

비용 우선 latency 기준 조정(2026-07-21): 상시 GPU와 alpha snapshot을 사용하지 않고 T4 `min_containers=0`, `max_containers=1`, 60초 scale-down을 유지하기 위해 cold 기준을 75초로 조정했다. CPU web timeout은 85초, Next provider 기본 timeout은 75초·상한은 85초로 분리했다. 합성 `kim` persona의 제한된 cold 1회·warm 2회에서 각각 69.378초, 5.518초, 5.223초와 유효 응답을 확인했다. 이는 latency 계약만 확인한 부분 gate이며 세 persona 질문·요약과 quota·fallback 전체 gate는 실행하지 않았다. 검증 뒤 Secret을 `1`로 복구하고 재배포해 인증 요청의 503 `actual-disabled`를 확인했다.

전체 actual 보정과 통과(2026-07-21): 최초 전체 실행에서 질문은 통과했지만 384토큰 요약이 GPU 60초 timeout을 두 차례 발생시켰다. 요약도 assistant prefill로 짧은 text만 최대 64토큰 생성하고 런타임이 evidence 구조를 조립하도록 RED 테스트부터 수정했다. 고정 session/IP hash는 실행별 비식별 hash로 바꾸고 세 Persona를 단일 fail-fast 테스트로 묶었다. 65초 idle에서는 종료 직전 컨테이너를 첫 요청이 사용한 뒤 다음 요청이 cold start가 되는 경계를 확인해 idle을 90초로 조정했다. 마지막 실행에서 세 합성 Persona의 질문 9회·요약 3회가 cold ≤75초·warm/요약 ≤15초와 schema·한국어 품질 gate를 통과했다. prompt·answer·response 본문은 출력하거나 기록하지 않았다.

- [x] **Step 5: actual·abuse·fallback gate를 실행한다**

Run: `RUN_MEDGEMMA_ACTUAL=1 npm run test:actual`

Expected: 3 persona 질문 9회와 요약 3회 PASS.

테스트용 별도 Modal environment에 CPU-only quota app을 배포한다.

Run: `modal deploy inference/modal_medgemma/quota_smoke_app.py --env test`

동일 session 6번째, 동일 IP 21번째, 전체 101번째 요청이 429인지 확인하고 GPU container가 전혀 없는 app임을 dashboard에서 확인한다. 검증 뒤 `modal app stop medgemma-quota-smoke --env test`로 중지한다. 운영 adapter의 401/403/schema 오류 no-retry와 429/503 1회 retry도 payload 없는 지표로 확인한다.

Run: `RUN_MEDGEMMA_ACTUAL=1 npm run test:actual -- tests/actual/modal-quota.actual.test.ts`

`MODAL_QUOTA_SMOKE_URL`은 deploy 출력 URL, 인증값은 기존 server-only proxy token env를 사용한다. 테스트는 무인증 401과 인증 threshold를 검증하되 token·URL을 snapshot이나 작업일지에 쓰지 않는다.

증거(2026-07-21): 새 Modal `test` 환경에 GPU 없는 `medgemma-quota-smoke`를 배포해 무인증 401, 동일 session 6번째·동일 IP 21번째·전체 101번째 요청의 429를 4/4로 확인하고 앱을 중지했다. adapter·화면 관련 단위 36건에서 401/403·schema no-retry, 429/503 1회 retry, stale 폐기와 history 보존 fallback을 확인했다. 운영 app은 Secret `1` 갱신과 재배포 후 인증 503 `actual-disabled`를 확인했다.

- [x] **Step 6: 문서와 체크리스트를 사실만 갱신한다**

Vertex는 변경 이력으로 남기고 현재 선택은 Modal로 표시한다. mock/actual/public-hosting 결과를 별도 행으로 기록한다. actual 미실행 항목은 완료 표시하지 않는다. 모든 새 주석과 작업일지는 한글로 작성한다.

- [x] **Step 7: 최종 검증 후 멈춘다**

Run: `git diff --check && npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build`

Expected: 모두 PASS. `git status --short`에서 의도한 파일만 검토하고 commit·push하지 않는다.

증거(2026-07-21): `git diff --check`, lint, typecheck, TypeScript 단위 10개 파일·86건, Modal Python 36건, Chromium E2E 14건, webpack production build가 통과했고 actual 비활성 실행은 5건을 명시적으로 skip했다. E2E 첫 시도는 sandbox의 loopback bind `EPERM`으로 실패했으나 동일 명령을 로컬 서버 권한으로 재실행해 통과했다. 검증을 마친 시점에는 main/test의 실행 task·container가 모두 0개였으며 commit·push하지 않았다. 이후 사용자 요청에 따라 `9d04c54`, `5940fd2`를 커밋하고 `codex/modal-contracts`를 푸시한 뒤 `main`에 fast-forward 병합해 `origin/main`과 동기화했다.
