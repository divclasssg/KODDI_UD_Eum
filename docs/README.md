# KODDI UD 이음 문서

이 파일은 구현에 필요한 문서를 찾는 단일 진입점이다. 상위 문서와 상세 문서는 모두 200줄 이하로 유지한다.

## 현재 구현 기준

1. [7일 구현 계획](./plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
2. [구현 체크리스트](./plans/2026-07-16-003-medical-interview-implementation-checklist.md)
3. [문서 관리 규칙](./documentation-policy.md)
4. [최종 프로토타입 필수 UI 목록](./superpowers/specs/2026-07-19-final-prototype-ui-inventory.md)
5. [대표 문진 화면 설계](./superpowers/specs/2026-07-19-interview-screen-design.md)
6. [대표 문진 상태 fixture 설계](./superpowers/specs/2026-07-19-interview-state-fixture-design.md)
7. [대표 문진 화면 구현 계획](./superpowers/plans/2026-07-19-interview-screen-implementation-plan.md)
8. [디자인 토큰 구현 명세](./superpowers/specs/2026-07-16-design-token-foundation-design.md)
9. [아이콘 시스템 설계](./superpowers/specs/2026-07-17-icon-system-design.md)
10. [아이콘 시스템 구현 계획](./superpowers/plans/2026-07-17-icon-system-implementation-plan.md)
11. [Modal MedGemma 외부 데모 설계](./superpowers/specs/2026-07-20-modal-medgemma-external-demo-design.md)
12. [Modal MedGemma 외부 데모 구현 계획](./superpowers/plans/2026-07-20-modal-medgemma-external-demo-implementation-plan.md)
13. [모의 음성 입력 구현 계획](./superpowers/plans/2026-07-20-simulated-voice-input-implementation-plan.md)
14. [U2 IndexedDB v1 schema와 repository 설계](./superpowers/specs/2026-07-22-u2-indexeddb-v1-repository-design.md)
15. [U2 IndexedDB v1 repository 구현 계획](./superpowers/plans/2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)
16. [U2 온보딩·홈 연결 설계](./superpowers/specs/2026-07-22-u2-onboarding-home-integration-design.md)
17. [U2 온보딩·홈 연결 구현 계획](./superpowers/plans/2026-07-22-u2-onboarding-home-integration-plan.md)
18. [U2 IndexedDB v1 실제 제품형 온보딩 개정 계획](./superpowers/plans/2026-07-22-u2-v1-actual-onboarding-revision-plan.md)
19. [U2 남은 범위·최소 U3 수동 문진 설계](./superpowers/specs/2026-07-22-u2-remaining-manual-profile-reset-design.md)
20. [U2 수동 문진·프로필 수정·reset 구현 계획](./superpowers/plans/2026-07-22-u2-remaining-manual-profile-reset-implementation-plan.md)
21. [U3 문진 상태·입력 계약 설계](./superpowers/specs/2026-07-22-u3-interview-state-input-contracts-design.md) — 구현 완료
22. [U3 문진 상태·입력 계약 구현 계획](./superpowers/plans/2026-07-22-u3-interview-state-input-contracts-implementation-plan.md) — 검증 완료
23. [U4 공개 AI 안전·근거·완료 여정 설계](./superpowers/specs/2026-07-22-u4-public-ai-safety-evidence-completion-design.md) — 구현 완료
24. [U4 공개 AI 안전·근거·완료 여정 구현 계획](./superpowers/plans/2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan.md) — mock·actual 검증 완료
25. [U6 기록·의료진 보기 설계](./superpowers/specs/2026-07-23-u6-records-clinician-view-design.md) — 구현 완료
26. [U6 기록·의료진 보기 구현 계획](./superpowers/plans/2026-07-23-u6-records-clinician-view-implementation-plan.md) — 검증·로컬 통합 완료
27. [U7 기록 상세→프로필 수정→동일 기록 복귀 설계](./superpowers/specs/2026-07-23-u7-record-profile-edit-design.md), [구현 계획](./superpowers/plans/2026-07-23-u7-record-profile-edit-implementation-plan.md) — unit 469건·integration 73건, focused Chromium 4건과 final Chromium 25건으로 검증 완료

현재 목표는 AI Persona UT 실행 도구가 아니라 실제 문진 앱을 만드는 것이다. 공개 제품 흐름에는 Persona 선택·주입을 노출하지 않으며 향후 별도 설계에서만 검토한다. 기존 U1 검증 harness와 자동화 test는 합성·비식별 데이터만 사용한다. 실제 환자 정보와 실제 음성 입력은 개발·검증 범위가 아니다.

## Modal 검증 명령

### 현재 배포·Secret 상태

- MedGemma는 개발 컴퓨터에 모델 가중치를 설치하는 방식이 아니다. `google/medgemma-1.5-4b-it`를 Modal image의 `/models/medgemma-1.5-4b-it`에 내려받아 런타임에서 `local_files_only=True`로 로드한다.
- Hugging Face token은 image build·rebuild 때만 Modal Secret `medgemma-hf`의 `HF_TOKEN`으로 사용한다. 실제 질문·요약 요청은 Hugging Face가 아니라 인증된 Modal endpoint를 호출한다.
- 2026-07-23 읽기 전용 확인에서 Modal `main`의 `medgemma-external-demo` 앱은 `deployed`, 실행 task는 0이었다. `medgemma-hf`와 `medgemma-runtime` Secret 이름은 존재하지만 값·현재 token 유효성은 조회하지 않았다.
- 마지막 actual 검증 뒤 `medgemma-runtime`의 kill switch를 `MEDGEMMA_ACTUAL_DISABLED=1`로 재배포하고 인증 요청 503 `actual-disabled`, container 0을 확인했다. Secret 변경 뒤에는 반드시 재배포한다. actual 활성화 배포는 승인된 합성 요청의 성공으로 확인하고, 검증 종료 뒤 `1`로 재잠근 배포는 인증 요청 503과 container 0으로 확인한다.
- Next provider 기본 timeout은 75초, 허용 상한과 공개 UI actual harness는 180초다. Modal CPU web 함수는 180초, 단일 GPU generation 함수는 60초 제한을 유지한다.

### 명령

- credential 없는 mock·로컬 검증: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `.venv/bin/python -m pytest tests/modal`. `npm run test:e2e`가 production build를 포함하므로 같은 tree에서 `npm run build`를 중복 실행하지 않는다.
- actual harness 비활성 확인: `npm run test:actual` 실행 시 테스트 5건이 skip되어야 한다.
- actual 검증: 사용자가 Hugging Face 약관·Modal Secret·proxy token·Workspace hard cap을 직접 준비하고 비용 발생을 승인한 뒤에만 `RUN_MEDGEMMA_ACTUAL=1 npm run test:actual`을 실행한다. 현재 Workspace hard cap은 `$10`이다.
- 공개 AI 실제 응답 검증: 별도 비용 승인과 kill switch 복구 준비 뒤에만 `RUN_MEDGEMMA_ROUTE_ACTUAL=1 npm run test:route-actual -- tests/actual/public-ai-interview.actual.spec.ts`를 실행한다. 합성 입력으로 실제 질문 1회와 실제 요약 1회만 검증한다.

endpoint URL과 token 값은 server-only 환경 변수에만 두며 채팅, 문서, snapshot, git에 기록하지 않는다. mock 통과, actual 통과, 공개 호스팅 통과는 각각 별도 증거로 관리한다.

### Sites 비공개 데모 상태

- 2026-07-24 기준 [KODDI UD Eum 데모](https://koddi-ud-eum-demo.parkseik675440.chatgpt.site)는 OpenAI Sites의 소유자 전용 접근으로 배포했다.
- Sites 버전 2는 소스 commit `d00b65eab90c0102f9302c49c995405fe9bbc471`, 환경 revision 2를 사용한다. `MEDGEMMA_MODE=mock`, `MEDGEMMA_ACTUAL_DISABLED=1`이므로 이 배포는 Modal GPU를 호출하지 않는다.
- 프로덕션에서 `/`와 `/onboarding` 200, 합성 V2 요청의 `/api/ai/question`과 `/api/ai/summary` 200을 확인했다. 질문 응답은 `어디가 불편하신가요?`, 요약 응답은 합성 답변 `무릎이 이틀 전부터 불편해요.`의 evidence ID를 유지했다.
- 첫 배포 점검에서 Cloudflare가 `x-forwarded-for` 대신 `cf-connecting-ip`를 제공해 AI route가 400을 반환했다. 회귀 테스트를 추가하고 해당 표준 헤더를 허용한 뒤 같은 프로덕션 요청을 다시 통과시켰다.
- 실제 MedGemma 공개 응답 전환은 별도 비용 승인, Sites의 Modal endpoint·proxy secret 설정, actual kill switch 해제, 합성 1회 검증과 즉시 재잠금 절차가 필요하다.

## 구현 판단의 우선순위

1. 현재 사용자 지시
2. 2026-07-16 실행 계획과 체크리스트
3. 업데이트된 Google Docs의 `AI 기반 사용성 사전 점검 / 진행방법` 및 하위 6개 탭
4. 2026-07-13 설계 중 위 기준과 충돌하지 않는 내용
5. 2026-07-09~15 과거 참고자료

문서가 충돌하면 위 순서를 따른다. 과거 문서의 Hugging Face, PIN, 완전한 PWA, 사진·영상 필수화 같은 가정은 현재 계획으로 자동 승계하지 않는다.

## 과거 설계 참고자료

- [2026-07-13 제품·화면 설계](./superpowers/specs/2026-07-13-medical-interview-pwa-design.md)
- [2026-07-13 상세 구현 설계](./superpowers/specs/2026-07-13-medical-interview-pwa-implementation-detail.md)
- [2026-07-10 제품·화면 설계](./superpowers/specs/2026-07-10-medical-interview-pwa-design.md)
- [2026-07-10 상세 구현 설계](./superpowers/specs/2026-07-10-medical-interview-pwa-implementation-detail.md)
- [2026-07-09 초기 설계](./superpowers/specs/2026-07-09-medical-interview-pwa-design.md)
- [2026-07-15 이전 구현 계획](./superpowers/plans/2026-07-15-medical-interview-pwa-implementation-plan.md)

과거 문서는 결정 배경과 세부 아이디어를 보존하기 위한 자료다. 현재 범위·일정·기술 선택을 결정하는 문서가 아니다.

## 작업 기록

- [Modal MedGemma Task 1~3 구현 인계](./handoffs/2026-07-20-modal-medgemma-task-1-3.md)
- [2026-07-22 작업일지](./worklogs/2026-07-22.md)
- [2026-07-21 작업일지](./worklogs/2026-07-21.md)
- [2026-07-20 작업일지](./worklogs/2026-07-20.md)
- [2026-07-19 작업일지](./worklogs/2026-07-19.md)
- [2026-07-17 작업일지](./worklogs/2026-07-17.md)
- [2026-07-16 작업일지](./worklogs/2026-07-16.md)
- [2026-07-15 작업일지](./worklogs/2026-07-15.md)

## 폴더 규칙

- `docs/plans`: 활성 계획, 체크리스트와 그 상세 문서
- `docs/superpowers/specs`: 승인된 제품·기술 설계와 과거 버전
- `docs/superpowers/plans`: 승인 설계에서 파생된 단계별 구현 계획과 과거 계획
- `docs/handoffs`: 다음 작업일에 그대로 재개하기 위한 불변 인계 기록
- `docs/worklogs`: 날짜별 사실 기록

새 문서를 만들기 전에 기존 상위 문서에 들어갈 링크인지 확인한다. 상세 내용이 200줄을 넘을 가능성이 있으면 처음부터 책임 단위 파일로 나눈다.
