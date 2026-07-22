> [상위 계획](../2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)

# Task 6: Migration·전체 검증·문서 동기화

## Files

- Modify: `src/lib/db/database.ts`
- Modify: `tests/integration/db/schema.test.ts`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/03-day-2-u2-u3.md`
- Modify: `docs/worklogs/2026-07-22.md`

## Guarantees

- migration failure가 기존 DB를 삭제하지 않는다.
- U2 data-layer evidence만 사실대로 기록한다.

- [x] **Step 1: migration failure RED test를 작성한다**

```ts
it("migration 실패 시 기존 database를 삭제하지 않는다", async () => {
  const v1 = await openMedicalInterviewDatabase();
  await seedSyntheticProfile(v1);
  v1.close();

  await expect(openDatabaseWithMigrations({
    targetVersion: 2,
    migrations: { 2: () => { throw new Error("synthetic failure"); } },
  })).rejects.toBeInstanceOf(DatabaseMigrationError);

  const reopened = await openMedicalInterviewDatabase();
  expect(await readSyntheticProfile(reopened)).toEqual(SYNTHETIC_PROFILE);
});
```

`VersionError`, `blocked`, `versionchange` connection close도 typed error 또는 종료 assertion으로 검증한다.

- [x] **Step 2: migration policy test를 RED로 확인한다**

```bash
npm run test:integration -- tests/integration/db/schema.test.ts -t migration
```

Expected: migration injection/error mapping 부재로 FAIL.

- [x] **Step 3: destructive fallback 없는 error mapping을 구현한다**

open과 migration 경로에서 `deleteDatabase`를 호출하지 않는다. migration throw는 versionchange transaction을 abort하고 `DatabaseMigrationError`를 반환한다. `VersionError`, `blocked`는 전용 error로 변환한다.

- [x] **Step 4: 전체 자동 gate를 실행한다**

```bash
git diff --check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Expected: diff-check, lint, typecheck, integration, E2E, build exit 0. unit은 기존 13 files·101 tests 이상 PASS한다. actual config는 실행하지 않는다.

- [x] **Step 5: 체크리스트와 작업일지를 동기화한다**

schema 결정 gate, repository 구현, repository 복원·snapshot·reset·late write test만 완료 표시한다. onboarding/profile UI, `ConsentBlocked` 화면, manual flow UI, onboarding/reset E2E는 완료 표시하지 않고 상위 진행률도 `2/9`로 올리지 않는다. 명령과 test 수만 기록하고 fixture 본문·credential은 남기지 않는다.

- [x] **Step 6: 최종 diff를 확인한다**

```bash
git status --short
git diff --stat
git diff --check
```

Expected: U2 데이터 계층·test·문서만 변경된다. commit·push·main 병합은 수행하지 않는다.
