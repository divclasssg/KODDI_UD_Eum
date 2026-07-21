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
| 2026-07-20 | 이전 작업 기준점 재검증 | 완료 | lint·typecheck·단위 31건·계약 10건·Turbopack build·E2E 14건 | 문서 정리·커밋 |
| 2026-07-20 | Modal Task 1·2 계약·Next proxy | 구현 완료 | DTO·validator·식별정보 탐지, Modal adapter·Route guard 단위 검증 | Modal Task 3 |
| 2026-07-20 | Modal Task 3 quota·GPU runtime | 코드·로컬 검증 완료 | Python schema·quota·prompt·runtime 25건 통과, deploy 미실행 | Modal Task 4 |
| 2026-07-21 | Modal Task 4 화면 연결·fallback | 구현·로컬 검증 완료 | HTTP/fixture 분리, 역할극 확인, stale·history fallback, 관련 단위 85건·lint·typecheck 통과 | 승인 후 Modal Task 5 |
| 2026-07-21 | Modal Task 5 opt-in actual harness | 로컬 준비 완료·외부 확인 대기 | actual 7건 skip, lint·typecheck·단위 85건·E2E 14건·build·Python 25건 통과 | Secret·proxy·budget·비용 승인 확인 |
| 2026-07-21 | Modal Task 5 `main` 안전 배포 | 배포·무인증 gate 완료 | module mode 배포, gated model 이미지 구성, 무인증 POST 401, actual kill switch `1` 유지 | proxy env·GPU 미기동 확인 후 actual 활성화 |
| 2026-07-21 | Modal T4 FP16 원인 진단 | 원인 확인·actual 잠금 | 기본·eager 첫 forward 모두 logits 262,208개 전부 NaN, 진단 코드 제거·kill switch `1` 복구 | T4 호환 추론 방식 결정 |
| 2026-07-21 | Modal T4 8비트 비용 우선 검증 | 수치 안정·성능 gate 실패 | logits 전부 유한·6.34GB·8토큰 비-PAD, cold 약 69.9초 timeout·warm 24.7초·JSON 미완성 | latency·구조화 출력 최적화 여부 결정 |
| 2026-07-21 | T4 compact JSON prompt 재검증 | 로컬 통과·actual gate 실패 | Python 27건·단위 85건 통과, warm 26.5초·96토큰 EOS 0·JSON 미완성 | constrained decoding 또는 런타임 변경 전까지 actual 잠금 |
| 2026-07-21 | Modal kill switch 재적용 | 잠금 확인 | Secret 갱신 직후 기존 web 컨테이너가 이전 값을 유지해 재배포 후 503 `actual-disabled` 확인 | 이후 Secret 변경마다 재배포·503 확인 |
| 2026-07-21 | T4 assistant prefill 검증 | warm gate 통과·cold 실패 | Python 34건, warm 9.0초·유효 JSON, cold 67.2초·유효 JSON | 안정적 cold 최적화 대안 결정 |
| 2026-07-21 | GPU memory snapshot 실험 | 미채택·복구 완료 | alpha snapshot 생성 완료 없이 Pending, GPU 컨테이너 종료·설정 제거·503 잠금 확인 | 실험 기능 제외 |
| 2026-07-21 | 비용 우선 latency 기준 조정 | 부분 actual 통과·잠금 확인 | scale-to-zero 유지, cold 69.378초 ≤75초, warm 5.518초·5.223초 ≤15초, 모두 유효 응답·최종 503 | 세 Persona 질문·요약과 quota·fallback 전체 gate |
| 2026-07-21 | Modal Task 5 전체 actual·quota | gate 통과·운영 잠금 | 세 Persona 질문 9회·요약 3회 통과, CPU-only quota 4/4, adapter/fallback 단위 36건, 최종 인증 503 | 최종 자동 검증 |
| 2026-07-21 | Modal Task 5 최종 검증 | 완료 | diff·lint·typecheck·단위 86건·Python 36건·E2E 14건·build 통과, main/test container 0 | U1 잔여 범위 결정 |
| 2026-07-21 | Modal Task 1~5 저장소 통합 | 완료 | `ac5be27`~`5940fd2`, feature push, `main` fast-forward, `origin/main` divergence `0 0`, 병합 후 전체 자동 검증 통과 | U1 잔여 gate·U2 저장 계약 |

## 차단 기록

| 날짜 | 차단 항목 | 영향 | 우회·결정 | 상태 |
|---|---|---|---|---|
| 2026-07-16 | Figma URL 미제공 | 실제 token·필수 UI 반영 대기 | URL 수신 후 구현 명세 승인 | 해소 |
| 2026-07-16 | Day 1~2 결정 8개 미확정 | U2~U8 일부 계약 구현 차단 | U1 진행과 병행해 결정 | 열림 |
| 2026-07-21 | Next.js 16 Turbopack production build worker 반복 정지 | 자동 build·E2E 시작 차단 | 캐시·worker 설정을 배제한 뒤 공식 `--webpack` opt-out을 모든 production build에 적용 | 해소 |
| 2026-07-21 | Modal 배포 외부 반출 승인 필요 | deploy·GPU·quota actual gate 대기 | 사용자가 소스·런타임 구성의 Modal `main` 업로드를 명시 승인했고 배포 성공 | 해소 |
| 2026-07-21 | 로컬 proxy token 환경 변수 미설정 | 인증 actual·quota gate 대기 | gitignored `.env.local`에 사용자가 직접 server-only 값 설정 | 해소 |
| 2026-07-21 | T4 float16 actual 출력이 PAD로 붕괴 | 세 Persona actual gate 차단 | 기본·eager 첫 forward의 logits가 모두 NaN으로 확인돼 직접 원인을 float16 forward 수치 붕괴로 좁힘, kill switch `1` 복구 | 최초 NaN layer 또는 T4 호환 추론 방식 결정 필요 |
| 2026-07-21 | T4 8비트가 actual 성능·JSON gate 실패 | 세 Persona actual gate 차단 | NaN은 해소했지만 cold timeout, warm 24.7초, 96토큰 JSON 미완성 확인 | 비용 대비 4비트·출력 제약 최적화 여부 결정 필요 |

## 범위 제외 기록

| 날짜 | 항목 | 이유 | 재검토 시점 |
|---|---|---|---|
| 2026-07-16 | AI Persona UT 실행 | 실제 검증 대상 앱 구현이 우선 | 앱 P0 완료 후 |
| 2026-07-16 | 운영·실환자 기능 | 인증·암호화·접근통제 없는 7일 prototype | 별도 운영 계획 수립 시 |
| 2026-07-16 | PWA cache·PIN·export·영상 | 7일 핵심 Task에 직접 필요하지 않음 | Day 7 이후 |
