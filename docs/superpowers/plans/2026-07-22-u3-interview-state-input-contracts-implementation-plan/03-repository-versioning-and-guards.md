> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 3: IndexedDB V1/V2 Repository와 Revision Guard

**Files:**
- Modify: `src/lib/db/contracts.ts`
- Modify: `src/lib/db/interview-repository.ts`
- Create: `src/features/interview/application/interview-record-mapper.ts`
- Modify: `tests/integration/db/fixtures.ts`
- Modify: `tests/integration/db/interview-repository.test.ts`
- Modify: `tests/integration/db/schema.test.ts`
- Modify: `tests/integration/db/reset-revision-guard.test.ts`

**Interfaces:**
- Consumes: Task 1 V2 snapshot/draft
- Produces: `persistDraft(token, input)`, mixed V1/V2 load normalization, immutable `questionSetSnapshot`

- [ ] **Step 1: schema 불변과 V2 create RED 작성**

```ts
it("database version 1과 기존 8개 store/index를 유지한다", async () => {
  expect(database.version).toBe(1);
  expect(Array.from(database.objectStoreNames).sort()).toEqual(EXPECTED_STORE_NAMES);
});

it("새 interview는 immutable question set과 V2 draft를 함께 만든다", async () => {
  const created = await repository.create(SYNTHETIC_INTERVIEW_V2_INPUT);
  expect(created.interview).toMatchObject({ schemaVersion: 2, questionSetSnapshot: SYNTHETIC_QUESTION_SET_V2 });
  expect(created.draft).toMatchObject({ schemaVersion: 2, input: { contractVersion: 2 } });
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:integration -- tests/integration/db/schema.test.ts tests/integration/db/interview-repository.test.ts`

Expected: schema test stays PASS; V2 types/create assertions FAIL.

- [ ] **Step 3: mixed record types와 mapper 구현**

`InterviewRecordV2`와 `InterviewDraftRecordV2`를 추가하고 repository aggregate read type은 V1|V2를 받는다. mapper는 V1 input을 V2 common draft로 정규화하되 DB를 쓰지 않는다. 신규 create만 V2를 저장한다.

- [ ] **Step 4: persistDraft atomic RED 작성**

```ts
it("draft persist가 interview와 draft revision만 함께 증가시킨다", async () => {
  const created = await repository.create(SYNTHETIC_INTERVIEW_V2_INPUT);
  const saved = await repository.persistDraft(token(created), SYNTHETIC_PERSIST_DRAFT_INPUT);
  expect(saved.interview.revision).toBe(2);
  expect(saved.draft?.revision).toBe(2);
  expect(saved.messages).toEqual([]);
});
```

강제 abort hook 뒤 interview/draft 모두 원본 revision·payload인지 확인한다.

- [ ] **Step 5: V1 진행 record 점진 upgrade RED 작성**

기존 V1 fixture를 직접 store에 넣고 load adapter가 V2 domain snapshot을 반환하는지 확인한다. 첫 `persistDraft` transaction 뒤 interview와 draft가 모두 schemaVersion 2가 되고 database.version은 1인지 검증한다. completed V1 record는 쓰지 않고 그대로 유지한다.

- [ ] **Step 6: revision·snapshot invariant 구현**

`persistDraft` transaction 안에서 consent, interview existence, expected revision, non-terminal, question ID가 immutable question-set 안에 있는지 확인한다. success 때만 revision을 `+1`하고 `updatedAt`을 갱신한다. submit/complete도 V2 snapshot invariant를 공유한다.

- [ ] **Step 7: concurrent stale와 reset RED 작성**

같은 token으로 두 `persistDraft` 또는 persist+submit을 시작해 하나만 commit되고 다른 하나가 `RevisionConflictError`인지 확인한다. reset 뒤 old generation의 persist/submit/complete가 실패하고 8-store count가 0인지 확인한다.

- [ ] **Step 8: repository GREEN**

Run: `npm run test:integration -- tests/integration/db/schema.test.ts tests/integration/db/interview-repository.test.ts tests/integration/db/reset-revision-guard.test.ts`

Expected: version 1, 8 stores, V1 read/V2 write, atomic revision, reset late-write tests PASS.

Run: `npm run typecheck && git diff --check`

Expected: exit 0.
