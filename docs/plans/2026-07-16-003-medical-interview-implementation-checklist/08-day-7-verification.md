> [상위 문서](../2026-07-16-003-medical-interview-implementation-checklist.md)
> 이전: [Day 6 · U8/U9](./07-day-6-u8-u9.md)
> 다음: [후순위·진행·차단 기록](./09-deferred-and-logs.md)
## Day 7 · Verification and Release Readiness

### 자동 검증 Gate

- [x] `lint`
- [x] `typecheck`
- [x] unit tests
- [x] integration tests
- [x] deterministic mock `test:e2e`
- [x] opt-in serial `test:actual`
- [x] production build

증거(2026-07-16): `npm run lint`, `npm run typecheck`, `npm run build` 종료 코드 0.

증거(2026-07-19): `npm run test:unit`에서 문진 단위 테스트 31건이 통과했다. 기존 Node 기반 아이콘 계약 6건과 토큰 계약 4건도 각 전용 스크립트로 통과했다.

증거(2026-07-19): `npm run test:e2e`에서 production build 후 9개 fixture·키보드·스크롤·시각 snapshot E2E 14건이 통과했다.

증거(2026-07-20): `npm run lint`, `npm run typecheck`, 문진 단위 31건, 아이콘 6건, token·Pretendard 4건과 기본 Turbopack production build가 통과했다. `test:e2e` lifecycle에서 Turbopack build worker 정지를 재현해 Playwright 준비 build만 Next.js 공식 `--webpack`으로 고정했고, production build와 Chromium E2E 14건이 통과했다.

증거(2026-07-21): opt-in actual harness 5건은 credential 없이 명시적으로 skip된다. 활성화한 MedGemma gate에서 세 합성 Persona 질문 9회·요약 3회가 통과했고 CPU-only quota gate 4건도 통과했다. payload 본문과 credential은 출력하거나 기록하지 않았으며 최종 kill switch 재배포 뒤 인증 503을 확인했다.

증거(2026-07-22 U4): lint·typecheck, unit 36개 파일·365건, integration 6개 파일·67건, Modal Python 42건과 production build·Chromium E2E 23건이 통과했다. 공개 AI actual harness는 작성했지만 비용 승인을 받지 않아 실행하지 않았다.

증거(2026-07-23 U4·U6 통합): lint·typecheck, unit 41개 파일·427건, integration 7개 파일·73건, production build와 전체 Chromium E2E 24건이 통과했다. 첫 E2E 서버 시작은 sandbox `EPERM`이었고, 성공한 동일 build를 사용해 승인된 credential-free Playwright를 재실행했다.

증거(2026-07-23 U7): lint·typecheck, unit 42개 파일·469건, integration 7개 파일·73건, `git diff --check`가 통과했다. `npm run test:e2e`의 production build는 통과했고 sandbox server bind는 `EPERM`으로 중단됐다. 같은 build에서 승인된 credential-free `npx playwright test`는 Chromium 25건을 통과했다. `manual-profile-reset.spec.ts` focused Chromium 4건도 통과해 첫 completed ID의 ready detail 동일 record 복귀, old/new snapshot, 393×852 overflow, 외부 요청 0건과 Tab·Enter·키보드 타이핑만 사용한 수정·저장·취소 확인·계속 수정·폐기를 검증했다.

### 핵심 사용자 과업 Gate

- [x] Task 1A actual AI 문진·요약 확정·completed 저장
- [x] Task 1B AI 비동의 manual 문진·기록 확인
- [ ] Task 1B provider 실패 manual 문진·기록 확인
- [x] Task 2 오늘 기록·clinician view
- [x] Task 3 과거 기록·profile edit·snapshot 보존
- [x] onboarding부터 clinician view까지 동일 `interviewId` 연속 여정

### 안전·개인정보·접근성 Gate

- [x] 합성 Persona 데이터만 사용
- [x] direct identifier·unknown field·oversize payload provider 호출 전 거절
- [x] prompt injection·markup fixture 거절
- [x] 진단·치료·복약 지시·근거 없는 요약 거절
- [x] 위험 안내가 일반 AI 질문보다 먼저 표시
- [x] 동의 철회 시 해당 외부 호출 0건
- [x] reset 뒤 모든 store 0건
- [x] 늦은 AI 응답·모의 음성 timer가 current revision에 반영되지 않음
- [ ] TTS 자동 실행 없음·hidden content 미발화
- [x] 비동기 전환이 live region과 focus로 전달

### 문서·정리 Gate

- [x] README에 mock/actual 실행법 기록
- [x] `.env.example`과 실제 환경 계약 일치
- [ ] dead route·임시 기능·폐기 실험 코드 제거
- [x] 실패·미완료·범위 제외 항목 기록
- [ ] Day 7에는 신규 기능을 추가하지 않음

증거(2026-07-23 문서 동기화): `.env.example`의 기본 provider timeout을 구현 기본값 75초와 일치시켰다. 공개 UI actual 전용 180초 상한, Modal web 180초·GPU generation 60초 경계와 Hugging Face build Secret 책임을 운영 문서에 분리해 기록했다.
