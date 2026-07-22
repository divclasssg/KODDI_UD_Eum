> [상위 계획](../2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)

# Task 4: 완료 Snapshot 불변성

## Files

- Modify: `src/lib/db/interview-repository.ts`
- Modify: `tests/integration/db/interview-repository.test.ts`

## Interfaces

- `complete(token): Promise<InterviewAggregateV1>`
- profile·medical profile snapshot과 confirmed summary가 같은 commit에 속함

- [x] **Step 1: 과거 snapshot 보존 RED test를 작성한다**

```ts
it("profile 수정 뒤 과거 완료 snapshot은 바뀌지 않는다", async () => {
  const first = await seedReviewInterview();
  const completed = await repository.complete(token(first));

  await profileRepository.saveBundle(SYNTHETIC_UPDATED_PROFILE_BUNDLE);
  const stored = (await repository.listCompleted()).find(
    ({ id }) => id === completed.interview.id,
  );

  expect(stored?.profileSnapshot?.profile.displayName).toBe("김테스트");
  expect((await profileRepository.getBundle())?.profile.displayName).toBe("이테스트");
  await expect(repository.complete(token(completed))).rejects
    .toBeInstanceOf(ImmutableInterviewError);
});
```

- [x] **Step 2: complete 미구현으로 RED인지 확인한다**

```bash
npm run test:integration -- tests/integration/db/interview-repository.test.ts -t snapshot
```

Expected: complete 결과에 snapshot이 없어 FAIL.

- [x] **Step 3: 완료 transaction을 최소 구현한다**

`consents`, `profiles`, `medicalProfiles`, `interviews`, `summaries`, `interviewDrafts`를 한 transaction으로 연다. review status와 summary를 검사하고 `structuredClone`으로 snapshot을 만든다. summary를 confirmed, interview를 completed로 쓰고 draft를 삭제한 뒤 complete를 기다린다.

- [x] **Step 4: snapshot과 interview suite를 GREEN으로 만든다**

```bash
npm run test:integration -- tests/integration/db/interview-repository.test.ts
```

Expected: snapshot, terminal immutability, restore test 모두 PASS.
