> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 2: Pure Domain Machine

**Files:**
- Create: `src/features/interview/domain/interview-machine.ts`
- Modify: `src/features/interview/domain/interview-state.ts`
- Create: `tests/unit/interview/interview-machine.test.ts`

**Interfaces:**
- Consumes: Task 1 `CommonDraftV2`, `validateDraft()`
- Produces: `InterviewEvent`, `InterviewEffect`, `transitionInterview(state, event)`

- [ ] **Step 1: 허용 전이·double submit RED 작성**

```ts
it("valid submit은 정확히 하나의 submit effect를 만든다", () => {
  const first = transitionInterview(answeringState(), { type: "SUBMIT_REQUESTED" });
  const second = transitionInterview(first.state, { type: "SUBMIT_REQUESTED" });
  expect(first.effects).toHaveLength(1);
  expect(first.effects[0]).toMatchObject({ kind: "submit-answer" });
  expect(second.effects).toEqual([]);
});

it("draft persist 중 submit은 queue되고 persist success 뒤 한 번 실행된다", () => {
  const saving = draftSavingState({ latestText: "합성 입력" });
  const queued = transitionInterview(saving, { type: "SUBMIT_REQUESTED" });
  const flushed = transitionInterview(queued.state, draftPersistSucceededEvent(saving.operation));
  expect(queued.effects).toEqual([]);
  expect(flushed.effects.filter(({ kind }) => kind === "submit-answer")).toHaveLength(1);
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/interview/interview-machine.test.ts`

Expected: FAIL because `interview-machine.ts` does not exist.

- [ ] **Step 3: state/event/effect discriminated union 구현**

`transitionInterview()`는 mutable global, Date, UUID, Promise를 사용하지 않는다. 새 operation token은 event로 주입받고 machine은 pending token을 그대로 effect에 복사한다.

```ts
export type MachineResult = { state: InterviewDomainState; effects: InterviewEffect[] };

export function transitionInterview(
  state: InterviewDomainState,
  event: InterviewEvent,
): MachineResult {
  if (state.phase === "disposed") return { state, effects: [] };
  // phase별 pure 분기만 둔다.
}
```

- [ ] **Step 4: stale success·failure RED 작성**

load, draft persist, submit, complete 각각에서 requestId/sessionId/interviewId/baseRevision/runtimeGeneration 중 하나를 바꾼 result event가 state와 effects를 전혀 바꾸지 않는지 table test로 검증한다.

- [ ] **Step 5: 저장 실패·navigation·reset RED 작성**

submit failure가 question과 모든 mode draft를 deep-equal로 유지하는지, dirty/saving/submitting/completing navigation이 `announce`만 내고 navigate를 내지 않는지, clean navigation과 reset/dispose가 disposed로 가는지 검증한다.

- [ ] **Step 6: 최소 전이 구현**

pending token exact equality helper를 하나만 두고 success와 failure에 공통 적용한다. invalid/incomplete submit은 effect 없이 validation issue를 state에 둔다. stale failure는 alert state를 만들지 않는다.

- [ ] **Step 7: 전체 transition GREEN**

Run: `npm run test:unit -- tests/unit/interview/interview-machine.test.ts tests/unit/interview/interview-draft.test.ts && npm run typecheck && git diff --check`

Expected: transition matrix, stale table, double-submit tests PASS; no React/IndexedDB imports in domain files.

Run: `rg -n "react|indexedDB|IDB|next/navigation|fetch\(" src/features/interview/domain`

Expected: 0 matches.
