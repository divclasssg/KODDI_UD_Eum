# Tasks 4–5 · Storage and Public AI Service

> [상위 계획](../2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan.md)

## Task 4: Atomic Generated Question and Safety Storage

**Files:** modify `src/lib/db/contracts.ts`, `interview-repository.ts`, integration repository tests/fixtures.

**Produces:** `saveGeneratedQuestion`, `saveSafetyReview`, `confirmSafetyStop`; DB version/store 변화 없음.

- [ ] **Step 1: repository RED를 작성한다**

```ts
expect(database.version).toBe(1);
expect(saved.interview.schemaVersion).toBe(2);
expect(saved.interview.questionSetSnapshot.questions.at(-1)?.id)
  .toBe("ai-question-002");
expect(saved.draft?.currentQuestion.id).toBe("ai-question-002");
```

- 같은 question ID, 기존 snapshot 변경, stale revision은 거절한다.
- answer commit 뒤 current question과 마지막 Q/A pair가 같아 reload가 대기 상태를 유도할 수 있어야 한다.
- `saveSafetyReview`는 Q/A+safety message를 append하고 `draft`와 revision을 보존한다.
- `confirmSafetyStop`은 허용 action 뒤 `safety-stopped`로 바꾸고 draft를 삭제한다.
- `beforeFinalPut` 강제 실패 시 aggregate 전체가 원상 유지된다.

- [ ] **Step 2: RED를 확인한다**

```bash
npx vitest run --config vitest.integration.config.ts tests/integration/db/interview-repository.test.ts
```

Expected: repository methods 부재로 FAIL.

- [ ] **Step 3: exact inputs와 methods를 구현한다**

```ts
export type SaveGeneratedQuestionInputV2 = {
  question: QuestionSnapshotV2;
  updatedAt: UtcTimestamp;
};

export type SaveSafetyReviewInputV1 = {
  appendedMessages: InterviewMessageInputV1[];
  updatedAt: UtcTimestamp;
};
```

모든 write는 consent, revision, runtime generation을 검사한다. generated question은 V2 snapshot append + draft reset을 한 transaction에서 처리한다. safety review는 messages/interview/draft revision을 맞추고 confirmation은 interview/draft를 terminal 처리한다.

- [ ] **Step 4: GREEN을 확인한다**

Step 2 명령을 재실행한다. Expected: 신규와 기존 repository tests PASS.

## Task 5: Public AI Service and Recovery

**Files:** create `src/features/interview/ai/ai-interview-service.ts`, `src/features/interview/domain/safety-preflight.ts`와 unit tests; export deterministic first/fallback helper from manual question set.

**Produces:** create/load, answer commit, reload continuation, actual limit, fallback, safety-review/terminal service.

- [ ] **Step 1: service RED를 작성한다**

- 새 AI interview는 `mode: "ai"`, deterministic 첫 질문, empty V2 draft다.
- 마지막 Q/A가 current question과 일치하면 reload는 `waiting-for-question`이다.
- 위험 문구는 AI client 0회, safety-review 저장 1회, action 전 terminal 0회다.
- 부정된 위험 문구는 정상 저장 뒤 question client를 호출한다.
- 실제 follow-up은 최소 1회·기본 최대 3회며 max 뒤 summary로 간다.
- question 오류는 provider retry 뒤 deterministic fallback 질문을 저장한다.
- summary 오류/0 valid item은 deterministic `source: "manual"`, 정상은 `source: "ai"`다.

- [ ] **Step 2: RED를 확인한다**

```bash
npx vitest run tests/unit/interview/safety-preflight.test.ts tests/unit/interview/ai-interview-service.test.ts
```

Expected: modules 부재로 FAIL.

- [ ] **Step 3: safety preflight를 구현한다**

```ts
export type SafetyPreflightResult =
  | { kind: "none" }
  | { kind: "verification-needed" }
  | { kind: "urgent"; reason: "breathing" | "unresponsive" | "bleeding" | "explicit-help" };
```

현재 심한 호흡 곤란, 의식 소실/반응 없음, 멈추지 않는 심한 출혈, 즉시 도움 요청만 urgent다. 같은 짧은 절의 `없다|아니다|괜찮다`는 제외하고 과거·모호 표현은 verification-needed다.

- [ ] **Step 4: reload derivation을 구현한다**

```ts
export function deriveAiContinuation(
  aggregate: InterviewAggregateV1,
  runtimeGeneration: number,
): SessionSnapshot | AiContinuationSnapshot;
```

assistant question + user answer pair를 만들고 current snapshot과 마지막 answered question을 비교한다. follow-up 수는 deterministic 첫 질문을 제외한 answered AI question 수다. `PUBLIC_AI_MAX_FOLLOW_UPS`는 server page에서 1..3으로 읽어 service dependency로 주입하고 기본값은 3이다.

- [ ] **Step 5: HTTP·validator·repository 순서를 구현한다**

draft validation→safety preflight 순서를 먼저 실행한다. urgent면 Q/A+safety message를 `saveSafetyReview`로 원자 저장하고 AI를 호출하지 않는다. urgent가 아니면 answer commit→question/summary 결정→V2 HTTP→공통 validator→repository write 순서를 지킨다. actual 대기 중 reload는 durable aggregate에서 재개한다. invalid model output은 표시·저장하지 않는다.

- [ ] **Step 6: GREEN을 확인한다**

Step 2 명령을 재실행한다. Expected: 호출 횟수, source, reload, safety PASS.

- [ ] **Step 7: checkpoints를 기록한다**

별도 승인 시 `feat(storage): persist generated questions and safety reviews`, `feat(interview): add durable public AI service` commit을 만든다.
