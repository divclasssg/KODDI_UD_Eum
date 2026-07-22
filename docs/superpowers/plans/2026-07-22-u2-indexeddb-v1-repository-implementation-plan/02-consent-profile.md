> [상위 계획](../2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)

# Task 2: UTC·Consent·Profile 경계

## Files

- Modify: `src/lib/db/contracts.ts`
- Modify: `src/lib/db/database.ts`
- Create: `src/lib/db/consent-repository.ts`
- Create: `src/lib/db/profile-repository.ts`
- Create: `src/lib/privacy/consent.ts`
- Create: `tests/integration/db/fixtures.ts`
- Create: `tests/integration/db/consent-profile-repositories.test.ts`

## Interfaces

- `toUtcTimestamp(value: string): UtcTimestamp`
- `createConsentRepository`, `createProfileRepository`
- `shouldOpenLocalDatabase`, `isAiTransferAllowed`
- `ConsentRequiredError`, `InvalidUtcTimestampError`

- [x] **Step 1: 합성 fixture와 실패 test를 작성한다**

```ts
export const SYNTHETIC_PROFILE: ProfileRecordV1 = {
  id: "default",
  schemaVersion: 1,
  displayName: "김테스트",
  ageYears: 68,
  sex: "male",
  updatedAt: utc("2026-07-22T01:00:00.000Z"),
};

it("local consent 없이 profile bundle을 쓰지 않는다", async () => {
  await expect(profileRepository.saveBundle(SYNTHETIC_PROFILE_BUNDLE)).rejects
    .toBeInstanceOf(ConsentRequiredError);
  expect(await countStore(database, "profiles")).toBe(0);
  expect(await countStore(database, "medicalProfiles")).toBe(0);
});

it("최초 local 거부와 AI 거부의 호출 경계를 분리한다", async () => {
  const openDatabase = vi.fn();
  const callProvider = vi.fn();
  if (shouldOpenLocalDatabase({ localStorage: "declined", aiTransfer: "granted" })) {
    await openDatabase();
  }
  if (isAiTransferAllowed(SYNTHETIC_DECLINED_AI_CONSENT)) {
    await callProvider();
  }
  expect(openDatabase).not.toHaveBeenCalled();
  expect(callProvider).not.toHaveBeenCalled();
});
```

invalid timestamp table은 offset, millisecond 누락, locale string, epoch string을 포함한다. AI declined consent를 저장한 뒤 profile local write 성공도 검증한다.

- [x] **Step 2: repository 부재로 RED인지 확인한다**

```bash
npm run test:integration -- tests/integration/db/consent-profile-repositories.test.ts
```

Expected: repository export 부재로 FAIL.

- [x] **Step 3: consent와 profile transaction 최소 구현을 작성한다**

`grant`만 consent record를 생성한다. local decision이 granted일 때만 DB open을 허용하고 local+AI grant일 때만 provider를 허용한다. `saveBundle`은 세 store transaction에서 consent를 확인한 후 두 profile을 쓴다.

```ts
const transaction = database.transaction(
  ["consents", "profiles", "medicalProfiles"],
  "readwrite",
);
const consent = await requestResult(
  transaction.objectStore("consents").get("current"),
);
if (!consent) {
  transaction.abort();
  throw new ConsentRequiredError();
}
transaction.objectStore("profiles").put(input.profile);
transaction.objectStore("medicalProfiles").put(input.medicalProfile);
await transactionComplete(transaction);
```

- [x] **Step 4: consent/profile test를 GREEN으로 만든다**

```bash
npm run test:integration -- tests/integration/db/consent-profile-repositories.test.ts
```

Expected: 모든 consent/profile integration test PASS.
