# Task 5 · 공개 Chromium 경로·문서·최종 gate

**Files:**
- Modify: `tests/e2e/manual-profile-reset.spec.ts`
- Modify: `docs/README.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
- Modify: `docs/worklogs/2026-07-22.md`

**Interfaces:**
- Consumes: completed U7 public flow
- Produces: same-ID browser evidence and final gate counts

- [ ] **Step 1: Rewrite the profile snapshot E2E path**

Keep the existing synthetic onboarding and first completed record. Read its actual ID from IndexedDB, then drive public UI:

```ts
const firstRecordId = await page.evaluate(async () => {
  const request = indexedDB.open("koddi-ud-eum", 1);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = database.transaction("interviews", "readonly");
  const records = transaction.objectStore("interviews").getAll();
  const result = await new Promise<string>((resolve, reject) => {
    transaction.oncomplete = () => {
      const completed = records.result.find(({ status }) => status === "completed");
      completed ? resolve(completed.id) : reject(new Error("completed record missing"));
    };
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return result;
});

await page.getByRole("link", { name: "기록 보기" }).click();
await page.getByRole("link", { name: /기록 열기/ }).first().click();
await expect(page).toHaveURL(
  new RegExp(`/records/${encodeURIComponent(firstRecordId)}$`),
);
await page.getByRole("link", { name: "내 정보 수정" }).click();
await page.getByLabel("이름").fill("수정한 테스트 사용자");
await page.getByRole("button", { name: "변경사항 저장" }).click();
await expect(page).toHaveURL(
  new RegExp(`/records/${encodeURIComponent(firstRecordId)}$`),
);
```

Complete a second manual interview and retain the existing IndexedDB assertion:

```ts
expect(names).toEqual({
  current: "수정한 테스트 사용자",
  snapshots: ["테스트 사용자", "수정한 테스트 사용자"],
});
```

Track `/api/ai/*`, media, and STT requests and assert zero. Set viewport to `393x852`; assert profile and returned detail `scrollWidth <= innerWidth`.

- [ ] **Step 2: Run targeted Chromium**

Run:

```bash
npx playwright test tests/e2e/manual-profile-reset.spec.ts --project=chromium
```

Expected: all manual/profile/reset tests PASS. If localhost bind returns `EPERM`, rerun only Playwright with sandbox approval after the successful build remains current.

- [ ] **Step 3: Update evidence documents**

Record exact focused unit/integration/E2E counts, same-ID return, old/new snapshot values, external request count 0, U5/U8 deferral, and remaining scroll restoration or provider-failure work. Mark only evidence-backed U7 checkboxes complete.

- [ ] **Step 4: Run final milestone gate once**

Run independent commands in parallel:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
git diff --check
```

Then run the single integration point:

```bash
npm run test:e2e
```

Do not run Modal actual or GPU. `npm run test:e2e` already builds production, so do not run `npm run build` separately.

- [ ] **Step 5: Review privacy and scope**

Run:

```bash
rg -n "console\\.(log|debug|info)|dangerouslySetInnerHTML" src/features/profile src/features/records
git status --short
```

Expected: no sensitive logging or raw HTML injection; only intended U7 files plus the pre-existing unstaged `.gitignore`.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/manual-profile-reset.spec.ts docs/README.md docs/plans docs/worklogs
git commit -m "test(u7): verify record profile edit journey"
```

- [ ] **Step 7: Stop at git integration boundary**

Report implementation, tests, deferred scope, and remaining risks. Do not push or merge without a new explicit user request.
