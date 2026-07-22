---
title: "U1 Completion Gates"
date: 2026-07-21
type: design
status: approved
related:
  - 2026-07-19-interview-screen-design.md
  - 2026-07-20-modal-medgemma-external-demo-design.md
---

# U1 마무리 gate 설계

## 목적

대표 문진 화면에서 상태마다 강조된 핵심 행동을 하나로 제한하고, 합성 Persona를 사용하는 브라우저 요청이 Next.js Route Handler의 서버 전용 Modal 인증을 거쳐 성공한다는 증거를 남긴다. 기존 문진 화면·Modal 계약은 유지하며 U1 체크리스트의 두 미완료 항목만 닫는다.

## 범위

- 행동 가능한 화면에는 강조된 primary CTA를 정확히 하나만 둔다.
- 대기·완료처럼 사용자가 행동할 필요가 없는 화면은 primary CTA가 없어도 된다.
- secondary·utility 행동은 유지하되 primary와 동일한 시각 강조를 사용하지 않는다.
- 브라우저에서 질문 1회만 actual Node Route 경로로 요청한다.
- 체크리스트와 작업일지에 검증 사실과 운영 복구 상태를 기록한다.

다음 항목은 범위 밖이다.

- 실제 환자 정보, 실제 음성, 마이크, 녹음, STT
- 질문 단계 번호, 총 질문 수, 고정 진행률
- 전체 문진·요약 actual 재실행
- IndexedDB, profile, 기록 목록, clinician view
- 사진 입력과 보호자 기능

## 핵심 행동 계약

버튼은 `primary`, `secondary`, `utility` 강조 수준 중 하나를 명시한다. 이 값은 렌더링 스타일과 테스트가 공유하는 화면 계약이며 비즈니스 상태를 새로 만들지 않는다.

| 화면 상태 | primary CTA | 보조 행동 |
|---|---|---|
| 역할극 미확인·일반 답변 | `다음` | 역할극 checkbox, 선택지, 텍스트·모의 음성 입력 |
| 저장 오류 | `다시 저장하기` | 없음 |
| AI 오류 | `다시 질문 받기` | `수동 문진으로 계속` |
| 주의 안내 | `문진 계속하기` | 없음 |
| 긴급 안내 | `119에 전화하기` | `주변 사람에게 보여주기`, `문진 내용 요약 보기` |
| 저장·AI 대기·요약 전환·요약 완료·안전 종료 | 없음 | 상태에 이미 존재하는 비강조 탐색만 허용 |

`다음`은 역할극을 확인하지 않았거나 유효한 답변이 없으면 비활성화하지만 primary 의미는 유지한다. 음성 입력과 최신 질문 이동은 입력·탐색 utility이며 primary CTA로 계산하지 않는다.

## 컴포넌트 경계

- 기존 `ResponseComposer`, `ErrorNotice`, `SafetyNotice`가 각 버튼의 강조 수준을 소유한다.
- 공용 controller나 action registry는 추가하지 않는다.
- CSS module에는 notice용 primary·secondary 스타일을 분리한다.
- DOM에는 테스트가 primary 수를 안정적으로 셀 수 있는 명시적 action emphasis 표지를 둔다.
- 버튼의 accessible name, 실행 함수, 상태 전환은 변경하지 않는다.

이 방식은 현재 컴포넌트 책임을 유지하면서 중앙 registry 도입에 따른 U1 밖 구조 변경을 피한다.

## 브라우저→Node Route actual gate

별도 opt-in Playwright gate가 일반 `/interview/new`에서 합성 Persona 역할극을 확인하고 합성 답변을 한 번 제출한다.

검증 흐름:

1. production Next.js 서버를 Modal mode와 server-only credential로 실행한다.
2. 브라우저에서 합성 Persona 화면을 연다.
3. 역할극 확인 후 합성 선택 답변을 제출한다.
4. `/api/ai/question` 응답이 HTTP 200인지 확인한다.
5. 화면이 다음 질문 상태로 전환되는지 확인한다.
6. 질문·답변·응답 본문, endpoint URL, proxy token은 출력하거나 snapshot하지 않는다.

이 gate는 별도 환경 flag가 있을 때만 실행하고 일반 `npm run test:e2e`에는 포함하지 않는다. credential이 없으면 명시적으로 skip한다. provider 직접 호출 actual test는 이 브라우저 gate를 대체하지 않는다.

## 비용과 운영 안전

- 합성 Persona 한 명의 질문 1회만 실행한다.
- 요약과 추가 질문은 요청하지 않는다.
- T4 `min_containers=0`, `max_containers=1`, 60초 scale-down과 Workspace `$10` hard cap을 유지한다.
- 실행 전 main/test의 실행 container 수와 kill switch 상태를 확인한다.
- actual 실행을 위해 kill switch를 잠시 `0`으로 바꾸면 Secret 갱신 뒤 반드시 재배포한다.
- 검증 뒤 Secret을 `1`로 복구하고 재배포한 다음 인증 요청의 503 `actual-disabled`와 실행 container 0을 확인한다.
- 복구가 확인되지 않으면 U1을 완료 처리하지 않는다.

## 오류 처리

- 브라우저 actual gate 실패 시 응답 본문 대신 HTTP status와 단계 이름만 남긴다.
- 401이면 credential 이름과 server-only 주입 경로만 확인하고 token 값은 읽거나 출력하지 않는다.
- 503이면 kill switch·quota·container 상태를 구분하되 추가 GPU 요청을 자동 반복하지 않는다.
- timeout이나 schema 실패도 자동 전체 suite로 확대하지 않는다.
- 어떤 실패에서도 마지막 작업은 kill switch `1` 재배포와 503 확인이다.

## TDD와 검증

RED부터 다음 계약을 추가한다.

- 행동 가능한 각 fixture에 primary CTA가 정확히 하나 있다.
- 대기·완료 fixture에는 primary CTA가 없다.
- AI 오류와 긴급 안내의 나머지 행동은 secondary다.
- 기존 accessible name과 클릭 전환이 유지된다.
- opt-in actual E2E는 브라우저가 `/api/ai/question` 200을 받고 다음 질문을 표시한다.

로컬 gate:

```text
git diff --check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

외부 gate는 사용자 승인된 비용 범위 안에서 별도로 한 번 실행한다. 일반 자동 검증은 credential 없이 계속 결정론적으로 통과해야 한다.

## 완료 기준

- U1 체크리스트의 `한 화면에 질문 하나와 핵심 행동 하나만 노출`에 테스트 증거가 있다.
- 브라우저 요청이 Next.js Route Handler를 통해 인증된 Modal 응답 200을 받는다.
- 실제 정보·실제 음성·질문 번호·고정 진행률이 없다.
- 전체 로컬 gate가 통과한다.
- 운영 kill switch `1`, 인증 503, 실행 container 0이 최종 확인된다.
- 체크리스트와 작업일지가 실제 결과로 갱신된다.
