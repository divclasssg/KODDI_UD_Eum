> [상위 문서](../2026-07-16-003-medical-interview-implementation-checklist.md)
> 이전: [Day 7 · 검증](./08-day-7-verification.md)
> 다음: 없음
## 후순위 범위

- [ ] **후순위** 참가자 Persona 실행 엔진
- [ ] **후순위** screenshot relay·Think Aloud 로그
- [ ] **후순위** 평가자 AI·Synthetic SUS·2/3 재실행
- [ ] **후순위** 3열 Persona/앱/UT 결과 콘솔
- [ ] **후순위** 실환자·실제 식별정보 사용
- [ ] **후순위** LAN 직접 공개·운영 의료 서비스
- [ ] **후순위** PIN·공개 계정·서버 DB·저장 암호화
- [ ] **후순위** PDF/JSON export·영상·service worker cache

## 진행 기록

구현 변경을 완료할 때마다 한 줄을 추가한다. 실패한 검증도 삭제하지 않는다.

| 날짜 | 항목 | 상태 | 증거 | 다음 작업 |
|---|---|---|---|---|
| 2026-07-16 | 전체 문서 200줄 구조 개편 | 완료 | 87개 문서, 최대 182줄, 링크·펜스·원문 보존 검사 통과 | U1 시작 |
| 2026-07-16 | 구현 체크리스트 생성 | 완료 | 앱 코드 없음 확인, U1~U9·R1~R22·gate 매핑 | U1 시작 |
| 2026-07-16 | U1 Next.js 프로젝트 기반 | 완료 | Next.js·SCSS·버전·환경 계약, lint·typecheck·build·loopback 검증 | 디자인 토큰 |
| 2026-07-16 | 디자인 토큰 구현 명세 | 승인 완료 | Figma 매핑, 접근성 보정, Pretendard·48px·line-height 결정 | SCSS token 구현 |
| 2026-07-17 | U1 SCSS 토큰·Pretendard | 완료 | 전체 토큰 계약·대비 4건, lint·typecheck·build, production 로컬 폰트 CSS 확인 | 대표 문진 화면·393px E2E |
| 2026-07-19 | U1 대표 문진 상태 전환·route | 구현 완료 | 9개 fixture, 저장→AI·오류 복구·안전 종료, 단위 31건·계약 10건·lint·typecheck·build 통과 | 시각·접근성 E2E·200% 확대 |
| 2026-07-19 | U1 대표 문진 시각·접근성 E2E | 자동 검증 완료 | 393×852·440×900 측정, 9개 fixture·키보드·스크롤·snapshot E2E 14건 통과 | 실제 Chrome 200% 확대 수동 확인 |
| 2026-07-19 | U1 대표 문진 200% 확대 | 수동 검증 완료 | 사용자가 실제 Chrome에서 바깥·내부 scroll, 입력·행동 접근, visible focus 확인 | MedGemma·환경 gate |
| 2026-07-20 | Modal 외부 데모·모의 음성 설계 | 승인·계획 완료 | 공개 익명 합성 Persona, 인증 endpoint, quota·budget, 모의 transcript 계약 | Modal Task 1 |
| 2026-07-20 | Modal Task 1·2 계약·Next proxy | 구현 완료 | DTO·validator·식별정보 탐지, Modal adapter·Route guard 단위 검증 | Modal Task 3 |
| 2026-07-20 | Modal Task 3 quota·GPU runtime | 코드·로컬 검증 완료 | Python schema·quota·prompt·runtime 25건 통과, deploy 미실행 | Modal Task 4 |
| 2026-07-20 | 이전 작업 기준점 재검증 | 완료 | lint·typecheck·단위 31건·계약 10건·Turbopack build·E2E 14건 | 문서 정리·커밋 |

## 차단 기록

| 날짜 | 차단 항목 | 영향 | 우회·결정 | 상태 |
|---|---|---|---|---|
| 2026-07-16 | Figma URL 미제공 | 실제 token·필수 UI 반영 대기 | URL 수신 후 구현 명세 승인 | 해소 |
| 2026-07-16 | Day 1~2 결정 8개 미확정 | U2~U8 일부 계약 구현 차단 | U1 진행과 병행해 결정 | 열림 |
| 2026-07-20 | `test:e2e` lifecycle의 Turbopack build worker 정지 | 자동 E2E 시작 차단 | 일반 build는 Turbopack 유지, E2E 준비 build만 공식 webpack 사용 | 해소 |

## 범위 제외 기록

| 날짜 | 항목 | 이유 | 재검토 시점 |
|---|---|---|---|
| 2026-07-16 | AI Persona UT 실행 | 실제 검증 대상 앱 구현이 우선 | 앱 P0 완료 후 |
| 2026-07-16 | 운영·실환자 기능 | 인증·암호화·접근통제 없는 7일 prototype | 별도 운영 계획 수립 시 |
| 2026-07-16 | PWA cache·PIN·export·영상 | 7일 핵심 Task에 직접 필요하지 않음 | Day 7 이후 |
