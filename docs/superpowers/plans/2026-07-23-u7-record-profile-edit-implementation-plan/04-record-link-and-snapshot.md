# Task 4 · 기록 상세 진입과 snapshot 통합 계약

**Files:**
- Modify: `src/features/records/record-detail.tsx`
- Test: `tests/unit/records/record-detail.test.tsx`
- Test: `tests/integration/db/interview-repository.test.ts`

**Interfaces:**
- Consumes: `buildProfileEditHref(interviewId)`
- Preserves: `CompletedProfileSnapshotV1`

- [ ] **Step 1: Write the failing record link test**

```ts
expect(
  screen.getByRole("link", { name: "내 정보 수정" }),
).toHaveAttribute(
  "href",
  "/profile?returnTo=%2Frecords%2Fcompleted-record",
);
```

Add assertions that not-found, corrupt, and error states do not render the link.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run tests/unit/records/record-detail.test.tsx
```

Expected: FAIL because the link is absent.

- [ ] **Step 3: Add the ready-only link**

Import `buildProfileEditHref` and render after clinician action:

```tsx
<Link
  className={styles.secondaryLink}
  href={buildProfileEditHref(record.id)}
>
  내 정보 수정
</Link>
```

- [ ] **Step 4: Verify record component GREEN**

Run:

```bash
npx vitest run tests/unit/records/record-detail.test.tsx tests/unit/profile/profile-navigation.test.ts
```

Expected: both files PASS.

- [ ] **Step 5: Add the snapshot integration characterization**

Extend the existing “profile 수정 뒤 과거 완료 snapshot을 바꾸지 않는다” test:

```ts
const second = await repository.create({
  ...SYNTHETIC_INTERVIEW_INPUT,
  id: "interview-after-profile-edit",
});
const secondProgress = await repository.saveProgress(
  token(second),
  SYNTHETIC_PROGRESS_INPUT,
);
const secondReview = await repository.saveSummary(
  token(secondProgress),
  SYNTHETIC_SUMMARY_INPUT,
);
const secondCompleted = await repository.complete(token(secondReview));

expect(stored?.profileSnapshot?.profile.displayName).toBe("김테스트");
expect(secondCompleted.interview.profileSnapshot?.profile.displayName).toBe(
  "이테스트",
);
```

The assertion documents existing repository behavior and may pass immediately. Retain it as characterization evidence and do not modify production storage code unless the assertion exposes a real regression.

- [ ] **Step 6: Run affected integration**

Run:

```bash
npx vitest run --config vitest.integration.config.ts tests/integration/db/interview-repository.test.ts tests/integration/db/consent-profile-repositories.test.ts
```

Expected: profile atomicity and old/new snapshot assertions PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/records/record-detail.tsx tests/unit/records/record-detail.test.tsx tests/integration/db/interview-repository.test.ts
git commit -m "feat(records): open current profile from record detail"
```
