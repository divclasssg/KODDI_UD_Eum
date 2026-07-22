> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 4: Application Service·Ports·Stale 폐기

**Files:**
- Create: `src/features/interview/application/interview-ports.ts`
- Create: `src/features/interview/application/interview-application-service.ts`
- Modify: `src/features/interview/manual/manual-interview-service.ts`
- Create: `tests/unit/interview/interview-application-service.test.ts`
- Modify: `tests/unit/interview/manual-interview-service.test.ts`

**Interfaces:**
- Consumes: Task 2 `transitionInterview`, Task 3 repository methods, runtime coordinator
- Produces: `createInterviewApplicationService()`, `dispatch(event)`, `subscribe(listener)`, `dispose()`

- [ ] **Step 1: UI event→machine→port 순서 RED 작성**

```ts
it("submit은 최신 draft persist가 끝난 뒤 한 번만 repository에 전달된다", async () => {
  const service = createSyntheticService({ persistDraft: deferredPersist, submitAnswer });
  service.dispatch(editTextEvent("합성 두통"));
  service.dispatch({ type: "SUBMIT_REQUESTED" });
  expect(submitAnswer).not.toHaveBeenCalled();
  deferredPersist.resolve(persistedRevision(2));
  await service.whenIdle();
  expect(submitAnswer).toHaveBeenCalledOnce();
  expect(submitAnswer).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 2 }));
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/interview/interview-application-service.test.ts`

Expected: FAIL because application service and ports do not exist.

- [ ] **Step 3: effect runner와 serialized write lane 구현**

clock, `randomId`, runtime coordinator, repository port, router port를 주입한다. `requestId`와 `sessionId`는 `randomId()`로 만들고 저장하지 않는다. draft edits는 한 write lane에서 최신 payload로 coalesce하되 resolve event는 실제 request token으로 machine에 되돌린다.

- [ ] **Step 4: stale success·failure RED 작성**

두 deferred operation의 완료 순서를 뒤집어 older success와 older failure 모두 listener state와 repository follow-up effect를 바꾸지 않는지 확인한다. unmount `dispose()` 뒤 resolve/reject도 no-op이고 unhandled rejection이 없어야 한다.

- [ ] **Step 5: runtime/navigation/reset RED 작성**

navigation 중 dirty state에서는 router port 0회, clean state에서는 1회인지 확인한다. runtime generation invalidation 뒤 old operation result가 UI alert를 만들지 않는지 확인한다. reset 자체는 기존 `browserRuntimeOperations.invalidateAndCancel()`과 local data reset 경계를 유지한다.

- [ ] **Step 6: manual factory 외부 port 금지 구현**

manual service dependency type에는 AI/media port를 넣지 않는다. 기존 `ManualInterviewService` facade가 필요한 동안 application service를 감싸되 state transition을 직접 구현하지 않게 한다.

Run: `rg -n "AiQuestionPort|MediaInputPort|fetch\(|/api/ai/|getUserMedia|SpeechRecognition" src/features/interview/manual`

Expected: 0 runtime call matches; type-only contract import도 manual factory에는 없어야 한다.

- [ ] **Step 7: GREEN**

Run: `npm run test:unit -- tests/unit/interview/interview-machine.test.ts tests/unit/interview/interview-application-service.test.ts tests/unit/interview/manual-interview-service.test.ts`

Expected: serialization, stale success/failure, dispose, manual no-external-port tests PASS.

Run: `npm run typecheck && git diff --check`

Expected: exit 0.
