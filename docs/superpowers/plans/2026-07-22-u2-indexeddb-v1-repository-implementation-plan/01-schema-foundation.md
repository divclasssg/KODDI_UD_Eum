> [상위 계획](../2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)

# Task 1: Integration harness와 schema RED

## Files

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.integration.config.ts`
- Create: `tests/integration/db/setup.ts`
- Create: `tests/integration/db/schema.test.ts`
- Create: `src/lib/db/contracts.ts`
- Create: `src/lib/db/errors.ts`
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/database.ts`

## Interfaces

- `openMedicalInterviewDatabase(factory?: IDBFactory): Promise<IDBDatabase>`
- `DATABASE_NAME`, `DATABASE_VERSION`, `STORE_NAMES`, `StoreNameV1`
- typed database open·migration errors

- [x] **Step 1: integration dependency와 command를 추가한다**

```bash
npm install --save-dev fake-indexeddb
```

`package.json`에는 다음 script를 추가한다.

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

integration config는 `tests/integration/**/*.test.ts`만 포함한다. setup은 `fake-indexeddb/auto`를 import하고 각 test 뒤 `indexedDB.deleteDatabase(DATABASE_NAME)` 완료를 기다린다.

- [x] **Step 2: store와 index 계약 test를 작성한다**

```ts
it("v1 store와 index를 정확히 만든다", async () => {
  const database = await openMedicalInterviewDatabase();
  expect([...database.objectStoreNames]).toEqual([
    "attachments", "consents", "interviewDrafts", "interviews",
    "medicalProfiles", "messages", "profiles", "summaries",
  ]);

  const transaction = database.transaction(STORE_NAMES, "readonly");
  expect([...transaction.objectStore("interviews").indexNames]).toEqual([
    "byStatus", "byStatusUpdatedAt", "byUpdatedAt",
  ]);
  expect(
    transaction.objectStore("messages").index("byInterviewSequence").unique,
  ).toBe(true);
});
```

- [x] **Step 3: schema export 부재로 RED인지 확인한다**

```bash
npm run test:integration -- tests/integration/db/schema.test.ts
```

Expected: `@/lib/db/database` 또는 export를 찾을 수 없어 FAIL.

- [x] **Step 4: v1 migration 최소 구현을 작성한다**

`STORE_NAMES`는 설계의 8개 이름 tuple이다. `onupgradeneeded`에서 oldVersion 0의 keyPath와 index를 생성한다. 오류는 versionchange transaction을 abort하고 typed error로 바꾼다.

```ts
export function openMedicalInterviewDatabase(
  factory: IDBFactory = indexedDB,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => migrateToV1(request.result, request.transaction);
    request.onerror = () => reject(mapDatabaseOpenError(request.error));
    request.onblocked = () => reject(new DatabaseUpgradeBlockedError());
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
```

- [x] **Step 5: schema test를 GREEN으로 만든다**

```bash
npm run test:integration -- tests/integration/db/schema.test.ts
```

Expected: schema test PASS.
