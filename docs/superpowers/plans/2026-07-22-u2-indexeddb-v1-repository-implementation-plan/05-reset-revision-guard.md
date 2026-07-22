> [상위 계획](../2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)

# Task 5: 원자적 Reset과 늦은 응답 폐기

## Files

- Create: `src/lib/db/revision-guard.ts`
- Create: `src/lib/db/local-data-repository.ts`
- Create: `tests/integration/db/reset-revision-guard.test.ts`

## Interfaces

- `createRuntimeRevisionGuard()` with `capture`, `invalidate`, `assertCurrent`
- `resetAll`, `countAll`
- reset 성공 뒤 8개 store 0건, 실패 시 부분 삭제 없음

- [x] **Step 1: reset·abort·late response RED test를 작성한다**

```ts
it("모든 store를 한 transaction으로 비운다", async () => {
  await seedEveryStore(database);
  await localDataRepository.resetAll();
  expect(await localDataRepository.countAll()).toEqual({
    attachments: 0,
    consents: 0,
    interviewDrafts: 0,
    interviews: 0,
    medicalProfiles: 0,
    messages: 0,
    profiles: 0,
    summaries: 0,
  });
});

it("reset 뒤 늦은 응답이 interview를 되살리지 않는다", async () => {
  const aggregate = await seedDraftInterview();
  const captured = runtimeGuard.capture();
  runtimeGuard.invalidate();
  await localDataRepository.resetAll();
  expect(() => runtimeGuard.assertCurrent(captured)).toThrow(RevisionConflictError);
  await expect(
    interviewRepository.saveProgress(token(aggregate), SYNTHETIC_PROGRESS_INPUT),
  ).rejects.toBeInstanceOf(ConsentRequiredError);
  expect((await localDataRepository.countAll()).interviews).toBe(0);
});
```

abort test는 test factory의 `beforeClearStore` hook이 네 번째 store에서 throw하게 하고 seed count가 모두 유지되는지 확인한다. production export에는 hook을 노출하지 않는다.

- [x] **Step 2: repository 부재로 RED인지 확인한다**

```bash
npm run test:integration -- tests/integration/db/reset-revision-guard.test.ts
```

Expected: repository export 부재로 FAIL.

- [x] **Step 3: generation guard와 reset transaction을 구현한다**

```ts
export function createRuntimeRevisionGuard() {
  let generation = 0;
  return {
    capture: () => generation,
    invalidate: () => { generation += 1; },
    assertCurrent: (captured: number) => {
      if (captured !== generation) throw new RevisionConflictError();
    },
  };
}
```

`resetAll`은 `database.transaction(STORE_NAMES, "readwrite")` 하나에서 모든 store를 `clear()`한다. request 하나라도 실패하면 abort하고 `complete` 전에 resolve하지 않는다.

- [x] **Step 4: reset suite를 GREEN으로 만든다**

```bash
npm run test:integration -- tests/integration/db/reset-revision-guard.test.ts
```

Expected: clear, abort rollback, late response test 모두 PASS.
