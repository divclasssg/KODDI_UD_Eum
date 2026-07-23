# U4 공개 AI 안전·근거·완료 여정 설계

## 문서 상태

- 상태: **사용자 승인·구현 계획 작성 완료**
- 기준: `main@6ac54dd`
- 승인된 방향: 온보딩부터 시작하는 공개 사용자 경로에서 실제 MedGemma 후속 질문과 실제 MedGemma 요약을 표시한다.
- 구현 전 제외: commit, push, main merge, Modal actual, 배포, GPU 호출
- 구현 계획: `docs/superpowers/plans/2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan.md`

## 목표

AI 전송에 동의한 사용자가 `/home`에서 실제 AI 문진을 시작해 안전한 후속 질문에 답하고, 자신의 답변에 근거한 실제 AI 요약을 검토한 뒤 로컬에 완료 저장할 수 있게 한다. 기존 U3 상태 머신, IndexedDB version 1, operation token, revision, runtime generation과 완료 transaction을 재사용해 데모 범위를 줄인다.

AI 전송에 동의하지 않은 사용자는 기존 `/interview/manual`을 계속 사용하며 외부 AI operation은 0회여야 한다. 공개 경로에는 Persona, fixture, 역할극 확인, 질문 번호, 총 질문 수를 노출하지 않는다.

## 현재 구현 재판정

| 항목 | 판정 | U4 작업 |
|---|---|---|
| Node Route·실제 Modal provider | 완료 | 공개 application service에 연결 |
| request allowlist·PII·크기 제한 | 완료 | 기존 guard 유지 |
| question·summary 구조/evidence ID 검사 | 부분 완료 | 의미 validator와 원문 일치 검사 추가 |
| U3 pure machine·stale 결과 폐기 | 완료 | AI effect와 token 결합 |
| `review → completing → completed` | 완료 | AI summary에도 재사용 |
| 원자 완료 저장·profile snapshot | 완료 | schema/store 변경 없이 재사용 |
| 저장 실패 시 review 보존·재시도 | 완료 | 공개 AI 화면에서 동일 상태 표시 |
| 공개 AI 사용자 흐름 | 미완료 | `/interview/ai`와 home 분기 추가 |
| 위험 신호·안전 종료 | fixture만 완료 | deterministic preflight와 terminal 저장 추가 |
| 질문 안전·품질 validator | 미완료 | server/client 공통 pure validator 추가 |
| 수치·날짜·단위·모순 검증 | 미완료 | evidence validator 추가 |

## 권장 구조

### 공개 경로

1. 온보딩은 기존 세 가지 동의를 저장한다.
2. `/home`은 저장된 `aiTransfer`를 읽는다.
3. AI 동의 사용자의 주 행동은 `/interview/ai`, 비동의 사용자의 주 행동은 `/interview/manual`이다.
4. `/interview/ai`는 U3 application service와 pure machine을 사용하고 AI 전용 repository port만 추가한다.
5. 실제 AI 질문과 요약은 Route 응답 검증을 통과한 경우에만 UI와 IndexedDB로 이동한다.

기존 `/interview/new`의 Persona·fixture controller를 공개 경로로 승격하지 않는다. 필요한 HTTP 호출·abort 아이디어만 재사용하고, durable 상태는 U3 aggregate가 유일한 기준이다.

### 공개 AI wire contract

기존 `AiInterviewContextV1`은 합성 데모용 `personaId`가 필수이므로 공개 경로에서 재사용하지 않는다. 공개 경로는 `AiInterviewContextV2`를 추가하며 `version`, `interviewId`, `currentSlot`, `filledSlots`, `recentTurns`만 허용한다. 이름, 생년월일, profile 전체와 Persona ID는 전송하지 않는다.

Next Route, provider port, Modal request schema와 prompt는 V1 합성 데모와 V2 공개 문진을 명시적으로 구분한다. V2 prompt에서는 `합성 Persona 역할극` 지시를 제거하고 `공개 문진 보조`, 쉬운 한국어, 진단·치료 금지, evidence ID 보존을 요구한다. V1 계약과 기존 actual harness는 회귀 검증용으로 유지한다.

응답의 question·summary shape는 기존 필드를 유지하되 public contract version으로 엄격히 파싱한다. V1/V2를 자동 추측하거나 누락된 `personaId`를 기본 Persona로 보정하지 않는다.

### 상태와 effect

기존 `loading`, `answering`, `submitting`, `review`, `completing`, `completed`, `disposed`를 유지한다. AI 전용으로 `waiting-for-question`, `waiting-for-summary`, `safety-review`, `safety-stopped`를 같은 pure machine에 추가한다. 별도 machine을 두지 않아 draft·navigation·stale 규칙이 갈라지는 것을 막는다.

AI effect는 모두 exact operation token을 갖는다. `sessionId`, `requestId`, `interviewId`, `baseRevision`, `runtimeGeneration` 중 하나라도 다르면 늦은 성공과 실패를 UI와 저장소에서 폐기한다. reset과 dispose는 fetch를 abort하고 이후 결과를 무시한다.

### 실제 AI 호출 순서

- 답변 제출 전 client deterministic safety preflight를 실행한다.
- 위험 신호가 없으면 답변을 먼저 IndexedDB에 commit한다.
- 새 revision을 기준으로 실제 question Route를 호출한다.
- 필수 질문이 끝나면 같은 immutable message history로 실제 summary Route를 호출한다.
- 질문 또는 요약 검증이 실패하면 잘못된 모델 출력을 표시하거나 저장하지 않는다.
- 질문 실패는 1회 재시도 후 저장된 history를 유지한 수동 질문으로 전환한다.
- 요약 실패는 저장된 history로 deterministic summary를 만들어 `review`로 이동한다.

실제 AI가 성공한 정상 데모에서는 질문과 최종 요약 모두 `source: "ai"`로 표시된다. fallback은 실패 복구이며 정상 성공으로 위장하지 않는다.

데모의 시간과 비용을 제한하기 위해 첫 질문은 기존 deterministic 문구를 사용하고, 실제 AI 후속 질문은 최소 1회·최대 3회 호출한다. provider가 먼저 `complete`를 반환하거나 최대 횟수에 도달하면 실제 AI 요약을 1회 요청한다. provider 내부의 기존 transient retry 1회 외에 UI가 actual 호출을 자동 반복하지 않는다.

## Deterministic 안전 계약

### 질문 validator

server와 client는 같은 pure validator와 reason code를 사용한다. server는 provider 직후, client는 신뢰 경계의 마지막 방어선에서 재검사한다.

허용 질문은 한 문장, 한 의도, 쉬운 한국어, 단일 질문이어야 한다. 다음 출력은 거절한다.

- 두 개 이상의 물음표, 두 질문을 잇는 표현, 복수 의도를 요구하는 문장
- 진단 확정, 치료 권고, 약 복용·중단·용량 변경 지시
- 전문용어 allowlist 밖 표현 또는 사용자에게 설명 없는 약어
- 이전 질문과 정규화 문장이 같거나 같은 slot을 반복하는 질문
- prompt injection 지시문, Markdown code fence, JSON object/array 위장
- HTML tag, script, event handler, URL 또는 제어문자

질문 option의 ID와 label에도 unknown field, 길이, 중복, injection·HTML·URL 규칙을 동일하게 적용한다.

validator는 의료적으로 좋은 질문을 판정하지 않는다. 위의 명시적 금지 패턴과 형식만 결정론적으로 차단한다.

### 위험 신호 preflight

위험 신호는 일반 AI 질문보다 먼저 처리한다. 데모에서는 기존 승인 문구와 직접 대응하는 좁은 합성 규칙만 사용한다. 포괄적 임상 triage를 주장하지 않는다.

- 현재 심한 호흡 곤란
- 의식 소실 또는 반응 없음
- 멈추지 않는 심한 출혈
- 지금 즉시 도움이 필요하다는 사용자 명시

부정 표현이 같은 짧은 절 안에 있으면 위험 신호로 판정하지 않는다. 애매하거나 과거 시점이면 `확인 필요`로 남기고 AI 질문을 계속할 수 있다. 규칙이 적중하면 답변과 safety message를 원자 저장하고 `safety-review`로 이동하며 추가 AI 호출은 하지 않는다.

긴급 안내는 기존 문구를 사용한다. 사용자가 안내를 확인하면 허용 행동은 `119에 전화하기`, `주변 사람에게 보여주기`, `문진 내용 요약 보기`뿐이다. 실제 `tel:119`와 Web Share 연결은 이번 데모 범위에서 제외하고 행동 의도만 기록한다. 문진 상태는 `safety-stopped` terminal로 저장한다.

## 근거와 contradiction 계약

AI summary item은 하나 이상의 durable `message.id`를 참조해야 한다. 검증은 summary 생성에 사용한 immutable message snapshot만 읽고 현재 draft나 profile의 가변 값은 근거로 사용하지 않는다.

각 item은 다음 순서로 검사한다.

1. 모든 evidence ID가 snapshot에 존재하는지 확인한다.
2. summary의 수치, 날짜, 시간, 단위 token이 evidence 원문에 그대로 존재하는지 확인한다.
3. 명시적 부정, 현재·과거 시점, 강도 표현, 사용자·가족 등 주체가 evidence와 반대인지 확인한다.
4. 검증된 item은 원래 section에 유지한다.
5. 근거는 있지만 결정론적으로 확정할 수 없는 item은 `verificationNeeded`로 이동한다.
6. 근거가 없거나 명백히 모순된 item은 거절한다.

하나의 잘못된 item 때문에 검증된 전체 요약을 폐기하지 않는다. 다만 검증 뒤 표시할 item이 하나도 없으면 deterministic summary fallback을 사용한다. 자유로운 의미 추론, 의학적 인과관계, 동의어 확장은 이번 범위에서 하지 않는다.

## 저장과 사용자 확정

AI 질문 snapshot과 실제 표시 문구는 해당 revision의 durable aggregate에 저장한다. 요약은 검증 완료 뒤 `review` 상태로 저장하며 사용자 확정 전에는 `confirmed` 또는 `completed`가 될 수 없다.

사용자가 `문진 저장 완료`를 누르면 기존 하나의 IndexedDB transaction이 interview status, confirmed summary, profile snapshot, question-set snapshot을 함께 확정하고 draft를 삭제한다. 실패하면 `review`와 편집 가능한 저장 데이터가 남고 같은 버튼으로 재시도한다. database version 1과 8개 store는 유지한다.

별도 clinician view는 구현하지 않는다. 완료 전 clinician view 차단 요구는 공개 AI 화면이 `completed` 이전에 외부 공유·의료진 화면 링크를 노출하지 않는 것으로 충족한다.

## 오류와 운영 경계

- raw provider 오류, prompt, credential, 실제 payload를 UI·문서·log에 노출하지 않는다.
- 실제 환자 정보·실제 음성·마이크·STT·사진을 사용하지 않는다.
- actual 검증은 합성·비식별 온보딩 데이터만 사용한다.
- 실제 Modal/GPU 실행은 구현과 credential 없는 gate가 끝난 뒤 별도 비용 승인을 받아 최소 질문 1회와 요약 1회로 시작한다.
- kill switch, quota, Origin, HMAC, server-only 환경 변수 계약은 변경하지 않는다.
- actual 성공, mock 성공, deterministic fallback 성공을 별도 증거로 기록한다.

## 데모 범위 제외

- `/interview/new` Persona·fixture 흐름의 제품화
- 포괄적 임상 triage 또는 진단·치료 판단
- clinician 전용 상세 화면과 실제 공유
- 실제 음성·STT·사진·attachment 처리
- IndexedDB schema version 증가 또는 새 store
- 배포, Modal actual, GPU 호출, 실제 환자 데이터
- 완전한 자연어 entailment·동의어·의학 지식 contradiction 판정

## 수용 기준

- AI 동의 사용자는 온보딩→홈→공개 AI 문진→실제 질문→실제 요약→완료 저장을 통과한다.
- AI 비동의 사용자는 기존 manual 완주를 유지하고 AI Route 호출이 0회다.
- Persona·fixture·역할극 문구가 공개 경로에 없다.
- 안전하지 않은 질문 fixture와 injection·JSON·HTML fixture가 provider 이후 server에서 거절된다.
- 위험 신호는 question Route보다 먼저 처리되고 acknowledgement 뒤 `safety-stopped`로 저장된다.
- 잘못된 evidence ID, 원문에 없는 수치·날짜·단위, 명백한 부정 모순이 그대로 표시·저장되지 않는다.
- 저장 실패 뒤 review 내용이 남고 재시도가 완료된다.
- stale AI 성공·실패와 reset 이후 응답이 UI와 IndexedDB를 바꾸지 않는다.
- 정상 actual 데모는 MedGemma가 생성한 질문과 MedGemma가 생성한 요약을 모두 화면에 표시한다.

## 승인 후 구현 순서

설계 승인 뒤 별도 구현 계획에서 validator → evidence → AI repository port → pure machine AI 상태 → 공개 화면·home 분기 → safety terminal → 관련 E2E → 최종 gate 순서로 TDD 단계를 구체화한다.
