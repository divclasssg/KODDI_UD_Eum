> [상위 계획](../2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)

# Task 3: Interview 복원, Status와 Revision

## Files

- Modify: `src/lib/db/contracts.ts`
- Create: `src/lib/db/interview-repository.ts`
- Create: `tests/integration/db/interview-repository.test.ts`

## Interfaces

- Consumes: consent, profile bundle, `RevisionToken`
- Produces: `create`, `loadInProgress`, `saveProgress`, `saveSummary`, `listCompleted`
- Errors: `RevisionConflictError`, `InterviewNotFoundError`, `ImmutableInterviewError`, `DatabaseCorruptionError`

- [x] **Step 1: 복원과 revision RED test를 작성한다**

```ts
it("draft와 commit history를 같은 snapshot으로 복원한다", async () => {
  const created = await repository.create(SYNTHETIC_INTERVIEW_INPUT);
  const saved = await repository.saveProgress(token(created), {
    draft: SYNTHETIC_DRAFT,
    appendedMessages: SYNTHETIC_MESSAGES,
  });
  const restored = await repository.loadInProgress(saved.interview.id);
  expect(restored?.draft).toEqual(SYNTHETIC_DRAFT_WITH_NEXT_REVISION);
  expect(restored?.messages.map(({ sequence }) => sequence)).toEqual([0, 1]);
  expect(restored?.interview.revision).toBe(2);
});

it("stale revision은 원본 aggregate를 바꾸지 않는다", async () => {
  const current = await seedDraftInterview();
  await expect(repository.saveProgress({
    ...token(current),
    expectedRevision: current.interview.revision - 1,
  }, SYNTHETIC_PROGRESS_INPUT)).rejects.toBeInstanceOf(RevisionConflictError);
  expect(await repository.loadInProgress(current.interview.id)).toEqual(current);
});
```

message sequence unique, `draft → review → draft`, terminal mutation, aggregate revision mismatch도 검증한다.

- [x] **Step 2: repository 부재로 RED인지 확인한다**

```bash
npm run test:integration -- tests/integration/db/interview-repository.test.ts
```

Expected: repository export 부재로 FAIL.

- [x] **Step 3: guarded aggregate transaction을 최소 구현한다**

mutation은 `consents`, `interviews`와 대상 store를 한 transaction으로 연다. consent와 interview를 먼저 읽고 누락, revision 불일치, terminal을 검사한다. 성공 record revision과 header revision을 `current + 1`로 맞춘다.

```ts
function assertMutableInterview(
  interview: InterviewRecordV1 | undefined,
  expectedRevision: number,
): asserts interview is InterviewRecordV1 {
  if (!interview) throw new InterviewNotFoundError();
  if (interview.revision !== expectedRevision) throw new RevisionConflictError();
  if (interview.status === "completed" || interview.status === "safety-stopped") {
    throw new ImmutableInterviewError();
  }
}
```

`loadInProgress`는 consent, header, draft, messages, summary를 한 readonly transaction에서 읽고 revision과 sequence를 검증한다.

- [x] **Step 4: 복원·revision test를 GREEN으로 만든다**

```bash
npm run test:integration -- tests/integration/db/interview-repository.test.ts
```

Expected: interview integration test PASS.
