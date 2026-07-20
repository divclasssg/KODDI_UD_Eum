> [상위 문서](../2026-07-16-003-medical-interview-implementation-checklist.md)
> 이전: [Day 6 · U8/U9](./07-day-6-u8-u9.md)
> 다음: [후순위·진행·차단 기록](./09-deferred-and-logs.md)
## Day 7 · Verification and Release Readiness

### 자동 검증 Gate

- [x] `lint`
- [x] `typecheck`
- [x] unit tests
- [ ] integration tests
- [x] deterministic mock `test:e2e`
- [ ] opt-in serial `test:actual`
- [x] production build

증거(2026-07-16): `npm run lint`, `npm run typecheck`, `npm run build` 종료 코드 0.

증거(2026-07-19): `npm run test:unit`에서 문진 단위 테스트 31건이 통과했다. 기존 Node 기반 아이콘 계약 6건과 토큰 계약 4건도 각 전용 스크립트로 통과했다.

증거(2026-07-19): `npm run test:e2e`에서 production build 후 9개 fixture·키보드·스크롤·시각 snapshot E2E 14건이 통과했다.

증거(2026-07-20): `npm run lint`, `npm run typecheck`, 문진 단위 31건, 아이콘 6건, token·Pretendard 4건과 기본 Turbopack production build가 통과했다. `test:e2e` lifecycle에서 Turbopack build worker 정지를 재현해 Playwright 준비 build만 Next.js 공식 `--webpack`으로 고정했고, production build와 Chromium E2E 14건이 통과했다.

### 핵심 사용자 과업 Gate

- [ ] Task 1A actual AI 문진·요약 확정·completed 저장
- [ ] Task 1B AI 비동의 manual 문진·기록 확인
- [ ] Task 1B provider 실패 manual 문진·기록 확인
- [ ] Task 2 오늘 기록·clinician view
- [ ] Task 3 과거 기록·profile edit·snapshot 보존
- [ ] onboarding부터 clinician view까지 동일 `interviewId` 연속 여정

### 안전·개인정보·접근성 Gate

- [ ] 합성 Persona 데이터만 사용
- [ ] direct identifier·unknown field·oversize payload provider 호출 전 거절
- [ ] prompt injection·markup fixture 거절
- [ ] 진단·치료·복약 지시·근거 없는 요약 거절
- [ ] 위험 안내가 일반 AI 질문보다 먼저 표시
- [ ] 동의 철회 시 해당 외부 호출 0건
- [ ] reset 뒤 모든 store 0건
- [ ] 늦은 AI 응답·모의 음성 timer가 current revision에 반영되지 않음
- [ ] TTS 자동 실행 없음·hidden content 미발화
- [ ] 비동기 전환이 live region과 focus로 전달

### 문서·정리 Gate

- [ ] README에 mock/actual 실행법 기록
- [ ] `.env.example`과 실제 환경 계약 일치
- [ ] dead route·임시 기능·폐기 실험 코드 제거
- [ ] 실패·미완료·범위 제외 항목 기록
- [ ] Day 7에는 신규 기능을 추가하지 않음
