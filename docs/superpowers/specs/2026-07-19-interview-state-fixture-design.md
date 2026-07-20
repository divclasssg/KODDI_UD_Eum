---
title: "Interview State Fixtures"
date: 2026-07-19
type: design
status: approved
---

# 대표 문진 상태 Fixture 설계

## 목적

`/interview/new`의 기본·저장·AI·오류·안전·요약 상태를 실제 의료데이터와 외부 서비스 없이 결정론적으로 재현한다. 각 상태로 직접 진입하는 시각 검증과 사용자 행동에 따른 전환 검증을 모두 지원한다.

기준 화면 계약은 [대표 문진 화면 설계](./2026-07-19-interview-screen-design.md)를 따른다.

## 실행 경계

- fixture는 서버 전용 `INTERVIEW_FIXTURE_MODE=1`일 때만 활성화한다.
- 진입 형식은 `/interview/new?fixture=<fixture-id>`다.
- 화면에 fixture 선택기, 개발 배지, 상태 변경 버튼을 추가하지 않는다.
- 플래그가 없는데 `fixture` query가 있거나 ID가 유효하지 않으면 404로 처리한다.
- URL의 fixture 값은 allowlist로 검증하고 파일 경로·임의 JSON·사용자 입력으로 해석하지 않는다.
- fixture는 합성 데이터만 사용하며 실제 AI, IndexedDB, 전화·외부 앱을 호출하지 않는다.
- fixture 성공을 실제 저장·MedGemma 성공 증거로 기록하지 않는다.

## 구현 형태

fixture 정의는 화면 props 조각이 아니라 실제 상태 계약과 같은 구조를 사용한다.

```ts
type InterviewFixtureDefinition = {
  id: InterviewFixtureId;
  initialState: InterviewUiState;
  history: FixtureTurn[];
  question?: FixtureQuestion;
  draft?: FixtureDraft;
  pending?: FixturePendingOperation;
  error?: FixtureError;
  safety?: FixtureSafetyNotice;
  summary?: FixtureSummaryTransition;
  expected: FixtureAssertions;
};
```

- 화면은 fixture ID를 분기하지 않고 주입된 상태와 명령 결과만 렌더링한다.
- fixture adapter는 저장·AI·안전 명령에 미리 정한 결과를 반환한다.
- production adapter와 fixture adapter는 같은 명령 인터페이스를 구현한다.
- fixture 전용 로직을 질문 카드·입력·상태 컴포넌트 안에 넣지 않는다.

## 공통 합성 데이터

- `interviewId`: `fixture-interview-001`
- 첫 질문: `어디가 불편하신가요?`
- 첫 답변: `두통이 있어요`
- 두 번째 질문: `어떤 증상을 느끼시나요?`
- 두 번째 답변: `어지럽고 속이 메스꺼워요`
- 현재 질문: `증상이 시작된 지 얼마나 지났나요?`
- 기간 선택지: `오늘`, `며칠에 걸침`, `수주에 걸침`, `잘 모르겠어요`

질문 번호·총 질문 수·단계·잔여량은 데이터와 화면에 포함하지 않는다. `history-review`는 최대 권장 범위 안의 5개 질문·답변으로 내부 스크롤만 발생시킨다.

## Fixture 목록

| ID | 초기 상태 | 핵심 데이터·검증 |
|---|---|---|
| `answering-default` | `answering` | 현재 질문, 선택·텍스트·음성 초안, `다음` |
| `history-review` | `answering` | 5개 확정 turn, 중간 scroll 위치, 최신 질문 복귀 |
| `saving-delayed` | `saving` | 확정 대기 초안, 입력 잠금, 지연 status |
| `waiting-for-ai` | `waiting-for-ai` | 저장된 답변, 입력 숨김, AI status |
| `save-error` | `save-error` | 저장되지 않은 초안, 다시 저장 행동 |
| `ai-error` | `ai-error` | 저장된 답변, AI 재시도·수동 문진 행동 |
| `safety-caution` | `caution` | warning 안내, 문진 계속 행동 |
| `safety-urgent` | `urgent` | error 안내, 일반 입력 잠금, 도움 요청 행동 |
| `summary-transition` | `summary-transition` | 입력 제거, 요약 준비 status |

## 전환 표

| 시작 | 조건 | 결과 |
|---|---|---|
| `answering-default` | 유효한 답변으로 `다음` | `saving` |
| `saving` | 저장 성공 | `waiting-for-ai` |
| `saving` | 저장 실패 | `save-error` |
| `save-error` | `다시 저장하기` | `saving` |
| `waiting-for-ai` | 다음 질문 성공 | 새 질문의 `answering` |
| `waiting-for-ai` | 완료 응답 | `summary-transition` |
| `waiting-for-ai` | AI 실패 | `ai-error` |
| `ai-error` | `다시 질문 받기` | `waiting-for-ai` |
| `ai-error` | `수동 문진으로 계속` | 미리 정한 수동 질문의 `answering` |
| `caution` | `문진 계속하기` | 다음 질문의 `answering` |
| `urgent` | 도움 요청 확인 | `safe-ended` |
| `urgent` | `문진 내용 요약 보기` | `summary-transition` |
| `summary-transition` | 요약 초안 준비 | 요약 확인 화면 |

직접 진입한 async fixture는 자동으로 끝나지 않아 시각 검증에 사용할 수 있다. `answering-default`에서 사용자가 시작한 시나리오와 오류·안전 화면의 실제 행동만 전환 표를 따른다.

## 시간 계약

- 저장이 300ms 안에 끝나면 저장 status를 표시하지 않는다.
- 전환 시나리오의 저장 adapter는 900ms 후 미리 정한 결과를 반환한다.
- AI adapter는 1,200ms 후 미리 정한 질문·완료·오류 중 하나를 반환한다.
- 상태가 실제로 바뀔 때만 live region 문구를 갱신한다.
- E2E는 고정 sleep을 사용하지 않고 상태 제목과 `aria-busy`의 등장·해제를 기다린다.

## 상태 문구와 행동

| 상태 | 제목·설명 | 행동 |
|---|---|---|
| 저장 지연 | `답변을 저장하고 있어요` | 없음 |
| AI 대기 | `다음 질문을 준비하고 있어요` | 없음 |
| 저장 오류 | `답변을 저장하지 못했어요` / `입력한 내용은 그대로 있어요. 다시 저장해 주세요.` | `다시 저장하기` |
| AI 오류 | `다음 질문을 불러오지 못했어요` / `저장한 답변은 남아 있어요.` | `다시 질문 받기`, `수동 문진으로 계속` |
| 주의 | `주의가 필요한 답변이 있어요` / `문진은 계속할 수 있지만, 상태가 달라지면 도움을 요청해 주세요.` | `문진 계속하기` |
| 긴급 | `위험 신호가 있어요` / `이 앱은 진단하지 않지만, 지금은 문진보다 도움 요청이 먼저일 수 있어요. 주변 사람에게 알리거나 119에 연락하세요.` | `119에 전화하기`, `주변 사람에게 보여주기`, `문진 내용 요약 보기` |
| 요약 전환 | `문진 내용을 정리하고 있어요` / `잠시만 기다려 주세요.` | 없음 |

fixture 모드에서 `119에 전화하기`와 외부 공유 행동은 실제 외부 동작을 실행하지 않고 의도된 명령만 기록한다. 실제 행동 계약은 안전 기능 구현 단계에서 별도로 검증한다.

## 접근성 Assertion

각 fixture는 다음 예상값을 가진다.

- 최초 초점 대상: 현재 질문, 오류 제목, 안전 안내 제목 중 하나
- `role`: 일반 status는 `status`, 오류·긴급은 `alert`
- `aria-live`: status는 `polite`, 같은 문구의 반복 발표 없음
- `aria-busy`: 저장·AI·요약 전환 영역에만 적용
- 입력 잠금: 저장·AI·긴급·요약 전환에서 true
- 사용 가능한 주요 행동: 상태 표와 정확히 일치
- 조작 영역: 모든 사용자 행동 최소 48×48
- 상태 구분: 색상 외 제목·설명·아이콘 또는 체크 표시 포함

## 시나리오 Assertion

- `다음` 한 번에 저장 명령이 정확히 1회 호출된다.
- 저장 성공 전 AI 명령 호출은 0회다.
- 저장 실패 뒤 draft와 현재 질문이 그대로 남는다.
- AI 실패 뒤 확정 답변은 남고 재저장되지 않는다.
- 긴급 상태에서는 일반 질문·입력이 다시 활성화되지 않는다.
- 과거 대화를 읽는 중 새 질문이 와도 scroll 위치를 강제로 바꾸지 않는다.
- 최신 영역 근처에서 새 질문이 오면 현재 질문으로 이동한다.
- 요약 전환에서는 질문 입력이 탭 순서에서 제거된다.

## 제외 범위

- 실제 IndexedDB failure injection과 transaction 복구
- 실제 MedGemma latency·timeout·schema 오류
- 실제 STT 권한·인식 오류와 TTS
- 실제 `tel:119`, Web Share API, 네이티브 앱 전환
- 사진·영상 fixture
- Persona별 전체 Task fixture

위 항목은 해당 구현 단위의 통합·E2E에서 검증한다. 대표 fixture는 실제 성공을 대체하지 않는다.

## 다음 단계

대표 문진 화면과 fixture adapter의 구현 계획을 작성한 뒤 `/interview/new`를 테스트 우선으로 구현한다.
