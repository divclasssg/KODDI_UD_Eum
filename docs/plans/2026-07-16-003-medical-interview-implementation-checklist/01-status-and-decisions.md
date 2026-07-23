> [상위 문서](../2026-07-16-003-medical-interview-implementation-checklist.md)
> 이전: 없음
> 다음: [Day 1 · U1](./02-day-1-u1.md)
# Medical Interview App Implementation Checklist

이 문서는 7일 구현의 단일 진행 현황판이다. 계획의 U1~U9, R1~R22, 검증 gate를 실제 증거와 함께 관리한다. AI Persona UT 실행은 후순위이며 앱 UI와 기능 구현만 추적한다.

## 현재 상태

- 마지막 갱신: 2026-07-23
- 앱 구현 진행률: **6/9 units 완료**
- P0 요구사항: **0/20 검증 완료**
- 자동 검증 gate: **7/7 통과**
- 현재 단계: **U7 완료 — 실제 IndexedDB 기록 상세에서 프로필 수정 후 같은 기록으로 복귀**
- 다음 작업: **provider 실패 수동 문진·scroll 복원 계약과 후순위 U5 speech/U8 photo 결정**
- 현재 차단 요소: **의료 콘텐츠·speech interaction·후속 UI 계약 미확정**

현재 앱 저장소에는 Next.js App Router 기반 `/interview/new` 개발 fixture와 Persona 없는 실제 `/interview/manual`, `/interview/ai` 경로가 분리돼 있다. 공개 흐름은 `/onboarding`의 AI 전송 동의를 홈의 주 행동에 반영하고, 동의한 사용자만 V2 allowlist 질문·근거 요약 여정으로 진입한다. 질문 안전성과 답변 근거를 client/server에서 검증하고 위험 신호는 일반 AI 질문보다 먼저 승인된 세 행동으로 전환한다. request identity, durable revision, reset generation과 abort signal은 분리돼 reload·Strict Mode·reset·dispose 뒤 늦은 UI와 IndexedDB 쓰기를 폐기한다. AI 거부 사용자는 외부 요청 없이 `manual-intake-v1`을 저장·복원·완료할 수 있다. profile snapshot과 IndexedDB version 1·8개 store는 유지하며 전체 삭제는 모든 store를 한 transaction으로 비운다. `/records` 목록, 동일 ID 상세와 completed·confirmed 기록 전용 의료진 참고용 화면은 실제 IndexedDB에 연결됐다. U7은 첫 완료 record의 browser IndexedDB ID로 목록→상세→프로필 수정→같은 상세 복귀를 검증하고, 이후 완료 record만 수정된 profile snapshot을 저장한다. 실제 공유·음성·사진 처리는 아직 범위 밖이며 U5 speech와 U8 photo는 후순위로 유지한다.

## 상태 표시와 갱신 규칙

- `[x]`: 구현과 검증 증거가 모두 있는 완료 항목
- `[ ]`: 아직 시작하지 않았거나 완료 증거가 없는 항목
- `[ ] **진행 중**`: 현재 수정 중이지만 exit evidence가 없는 항목
- `[ ] **차단**`: 외부 조건이나 결정이 필요하며 이유를 바로 아래에 기록
- `[ ] **후순위**`: 이번 7일 범위에서 구현하지 않는 항목
- 각 구현 작업이 끝날 때 이 문서를 같은 변경 묶음에서 갱신한다.
- 완료 항목에는 파일, 테스트 이름, 명령 결과 중 하나 이상의 증거를 `증거:`로 남긴다.
- UI가 보이기만 하는 상태, mock만 성공한 상태, 테스트를 작성했지만 실행하지 않은 상태는 완료가 아니다.
- 실제 MedGemma 성공과 deterministic mock 성공은 별도로 기록한다.
- 실패나 제외는 숨기지 않고 `차단 기록` 또는 `범위 제외 기록`에 날짜와 이유를 남긴다.

## 문서 준비 완료

- [x] Google Docs의 `AI 기반 사용성 사전 점검 / 진행방법`과 하위 탭 6개 반영
  - 증거: [7일 구현 계획](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
- [x] UT 실행 후순위, 앱 UI·기능 우선 범위 확정
  - 증거: 구현 계획의 `Scope Boundaries`, `KTD1`
- [x] 3 Persona × 3 Task 수용 기준 정의
  - 증거: 구현 계획의 `Three-Persona × Three-Task Acceptance Matrix`
- [x] 합성 Persona 데이터·공개 데모 경계 정의
  - 증거: Modal 외부 데모 설계의 공개 익명 역할극·보안 계약
- [x] U1~U9와 7일 일정 정의
  - 증거: 구현 계획의 `Seven-Day Schedule`, `Implementation Units`
- [x] Figma 기반 디자인 토큰 구현 명세 승인
  - 증거: [Design Token Foundation](../../superpowers/specs/2026-07-16-design-token-foundation-design.md)
- [x] 최종 프로토타입 필수 UI와 Figma node 확정
  - 증거: [최종 프로토타입 필수 UI 목록](../../superpowers/specs/2026-07-19-final-prototype-ui-inventory.md)
- [x] 대표 문진 화면 구조·입력·상태·주요 행동 계약 승인
  - 증거: [대표 문진 화면 설계](../../superpowers/specs/2026-07-19-interview-screen-design.md)
- [x] 대표 문진 상태 fixture 데이터·전환·접근성 assertion 승인
  - 증거: [대표 문진 상태 fixture 설계](../../superpowers/specs/2026-07-19-interview-state-fixture-design.md)
- [x] 대표 문진 화면 구현 순서·파일 경계·검증 gate 작성
  - 증거: [대표 문진 화면 구현 계획](../../superpowers/plans/2026-07-19-interview-screen-implementation-plan.md)
- [x] 공개·익명 합성 Persona Modal 데모 계약 승인
  - 증거: [Modal 외부 데모 설계](../../superpowers/specs/2026-07-20-modal-medgemma-external-demo-design.md)
- [x] Modal provider와 모의 음성 입력 구현 계획 작성
  - 증거: [Modal 구현 계획](../../superpowers/plans/2026-07-20-modal-medgemma-external-demo-implementation-plan.md), [모의 음성 계획](../../superpowers/plans/2026-07-20-simulated-voice-input-implementation-plan.md)

## 구현 전 결정 Gate

U1은 바로 시작할 수 있다. 아래 결정과 연결된 기능은 결정 항목을 완료한 뒤 구현한다.

- [ ] **차단** 의료 콘텐츠 계약 확정
  - required slot, 조기 종료, 중복 질문, 위험 rule별 종료 행동, 승인 문구, manual 질문 세트, actual 모델 반복 성공 기준
  - 완료 증거: 결정 내용이 구현 계획 또는 별도 ADR에 기록됨
- [x] API 계약 구현 계획 확정
  - `AiInterviewContextV1`, question/summary response, slot·Persona, unknown·stale·oversize·evidence 처리
  - 완료 증거: Modal 구현 계획 Task 1·2의 TypeScript interface와 contract test 목록
- [x] IndexedDB v1 schema 확정
  - store, key, index, UTC timestamp, 생년월일, 만 14세, 민감정보 동의, 확장 의료정보, status, snapshot, reset transaction, upgrade 정책
  - 완료 증거: [schema 설계](../../superpowers/specs/2026-07-22-u2-indexeddb-v1-repository-design.md), [v1 개정 계획](../../superpowers/plans/2026-07-22-u2-v1-actual-onboarding-revision-plan.md), integration 5개 파일·28건
- [x] P0 profile·clinician view 필드 확정
  - 기본정보·의료정보 snapshot, 미확인 표시, summary provenance, 근거 원문과 completed-only guard
  - 완료 증거: U6 milestone unit 6개 파일·61건(그중 view-model 21건), repository integration 1개 파일·6건, 실제 IndexedDB 연속 Chromium 1건
- [ ] **차단** 전역 navigation·speech interaction 확정
  - 홈·기록·내 정보 위치, 상세 뒤로가기, 모의 음성/TTS 상호 배타, 요약 수정 후 재생성
- [x] 공개 데모·Modal 운영 계약 확정
  - 인증 endpoint, Origin, body·turn·concurrency, session/IP/daily quota, kill switch, logging, 월 $30 hard budget
  - 완료 증거: Modal 런타임·보안·검증 설계
- [ ] **차단** 7일 recovery ladder 확정
  - 음성·사진 진입점은 실제 제품 위치에 유지하고 v1의 권한·파일·처리는 후순위로 확정했다. Day 3 지연 시 Figma 정밀 반영 범위의 추가 결정이 필요하다.
- [ ] **차단** A5 보호자·보조자 지원 범위 확정
