> [상위 설계](../2026-07-22-u3-interview-state-input-contracts-design.md)

# 상태·Event·Effect와 계층 경계

## Domain state와 UI state

domain state에는 reload 뒤 의미가 유지되어야 하거나 비동기 정합성에 영향을 주는 값만 둔다.

```ts
type InterviewDomainState =
  | { phase: "loading"; sessionId: string; operation: PendingOperation }
  | AnsweringState
  | { phase: "submitting"; sessionId: string; interview: InterviewIdentity; question: QuestionSnapshotV2; draft: CommonDraftV2; operation: PendingOperation }
  | { phase: "review"; sessionId: string; interview: InterviewIdentity; summary: SummaryView }
  | { phase: "completing"; sessionId: string; interview: InterviewIdentity; summary: SummaryView; operation: PendingOperation }
  | { phase: "completed"; sessionId: string; interviewId: string }
  | { phase: "load-error"; sessionId: string; error: DomainErrorView }
  | { phase: "disposed"; sessionId: string };

type AnsweringState = {
  phase: "answering";
  sessionId: string;
  interview: InterviewIdentity;
  question: QuestionSnapshotV2;
  draft: CommonDraftV2;
  draftSync: "clean" | "dirty" | "saving" | "error";
  operation?: PendingOperation;
  submitQueued: boolean;
};
```

domain state는 current question snapshot, mode별 draft, durable revision, pending request token, 저장 오류와 review/completed 전이를 소유한다. focus target, dialog open 여부, textarea 높이, 300ms status 표시 timer, scroll 위치와 visual pressed 상태는 UI state다. UI state는 durable revision을 결정하지 않는다.

## Event

허용 event는 다음으로 제한한다.

- `LOAD_REQUESTED`, `LOAD_SUCCEEDED`, `LOAD_FAILED`
- `DRAFT_EDITED`, `INPUT_MODE_SWITCHED`
- `DRAFT_PERSIST_SUCCEEDED`, `DRAFT_PERSIST_FAILED`
- `SUBMIT_REQUESTED`, `SUBMIT_SUCCEEDED`, `SUBMIT_FAILED`
- `COMPLETE_REQUESTED`, `COMPLETE_SUCCEEDED`, `COMPLETE_FAILED`
- `NAVIGATION_REQUESTED`, `RESET_OBSERVED`, `DISPOSED`

모든 async result event는 시작 때 발급한 `OperationToken` 전체를 포함한다. event payload에 raw Error, 환자 입력 전문, credential을 넣지 않는다.

## Effect

machine은 다음 descriptor만 반환한다.

```ts
type InterviewEffect =
  | { kind: "load-or-create"; token: OperationToken }
  | { kind: "persist-draft"; token: OperationToken; draft: CommonDraftV2 }
  | { kind: "submit-answer"; token: OperationToken; answer: ValidatedAnswerV2 }
  | { kind: "complete-interview"; token: OperationToken }
  | { kind: "navigate"; path: "/home" }
  | { kind: "announce"; messageKey: InterviewMessageKey };
```

timer, repository, AI, media, router 호출은 effect runner인 application service에만 있다. machine unit test는 effect descriptor와 다음 state만 비교한다.

## 허용 전이

| 현재 | Event | 다음 | Effect |
|---|---|---|---|
| loading | load success | answering 또는 review | 없음 |
| loading | load failure | load-error | 오류 announce |
| answering | draft edit | answering/dirty | persist-draft 직렬화 |
| answering | mode switch | answering/saving | 전체 mode draft persist |
| answering | submit(valid) | submitting 또는 submitQueued | submit-answer 또는 선행 draft flush |
| submitting | success | answering 또는 review | 새 질문 focus/announce |
| submitting | failure | answering/error | 입력 보존, 오류 announce |
| review | complete | completing | complete-interview |
| completing | success | completed | 완료 announce |
| completing | failure | review | summary 보존, 오류 announce |
| clean answering/review | navigation | disposed | navigate |
| dirty/saving/submitting/completing | navigation | 동일 | 이동 차단 announce |
| 비terminal | reset/dispose | disposed | local effect 없음 |

`SUBMIT_REQUESTED`가 이미 submitting이면 무시한다. draft persist 중이면 `submitQueued`만 true로 하고 persist 성공 뒤 정확히 한 번 submit effect를 만든다.

## Ports

```ts
interface InterviewRepositoryPort {
  loadOrCreateManual(input: LoadOrCreateManualCommand): Promise<InterviewSessionSnapshot>;
  persistDraft(command: PersistDraftCommand): Promise<InterviewSessionSnapshot>;
  submitAnswer(command: SubmitAnswerCommand): Promise<InterviewSessionSnapshot>;
  complete(command: CompleteInterviewCommand): Promise<CompletedInterviewSnapshot>;
}

interface AiQuestionPort {
  requestNext(command: AiQuestionCommand, signal: AbortSignal): Promise<AiQuestionResult>;
}

interface MediaInputPort {
  start(command: MediaInputCommand, signal: AbortSignal): Promise<MediaInputResult>;
}
```

manual application factory는 `InterviewRepositoryPort`, clock, ID factory, runtime coordinator만 받는다. `AiQuestionPort`와 `MediaInputPort`를 dependency로 받지 않으므로 AI 동의 거부 manual flow가 외부 쓰기를 호출할 경로 자체가 없다. 향후 AI application factory만 consent policy 통과 뒤 AI port를 받는다.

## UI 책임

Client Component는 machine state를 렌더링하고 event를 dispatch한다. repository record를 조립하거나 revision을 증가시키지 않는다. `useRouter`는 application service가 내보낸 navigate effect에만 사용한다. App Router page는 Server Component를 유지하고 browser API가 필요한 작은 screen boundary에만 `"use client"`를 둔다.
