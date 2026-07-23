# Task 2 · 프로필 draft 변경 감지

**Files:**
- Modify: `src/features/profile/profile-draft.ts`
- Test: `tests/unit/profile/profile-draft.test.ts`

**Interfaces:**
- Produces: `isProfileDraftDirty(baseline: ProfileDraft, current: ProfileDraft): boolean`
- Consumes: existing `ProfileDraft`

- [ ] **Step 1: Write failing tests**

```ts
import {
  isProfileDraftDirty,
  profileBundleToDraft,
} from "@/features/profile/profile-draft";

it("동일 draft는 clean이다", () => {
  const baseline = profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE);
  expect(isProfileDraftDirty(baseline, structuredClone(baseline))).toBe(false);
});

it.each([
  ["displayName", "수정한 사용자"],
  ["conditions", "합성 변경 질환"],
  ["conditionsUnknown", true],
  ["smokingStatus", "yes"],
  ["heightCm", "171"],
] as const)("%s 변경을 dirty로 판정한다", (key, value) => {
  const baseline = profileBundleToDraft(SYNTHETIC_PROFILE_BUNDLE);
  expect(
    isProfileDraftDirty(baseline, { ...baseline, [key]: value }),
  ).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run tests/unit/profile/profile-draft.test.ts
```

Expected: FAIL because `isProfileDraftDirty` is not exported.

- [ ] **Step 3: Implement explicit field comparison**

```ts
const PROFILE_DRAFT_KEYS = [
  "displayName",
  "birthDate",
  "sex",
  "conditions",
  "conditionsUnknown",
  "medications",
  "medicationsUnknown",
  "allergies",
  "allergiesUnknown",
  "familyHistory",
  "familyHistoryUnknown",
  "medicalHistory",
  "medicalHistoryUnknown",
  "surgicalHistory",
  "surgicalHistoryUnknown",
  "smokingStatus",
  "smokingDetails",
  "alcoholStatus",
  "alcoholDetails",
  "heightCm",
  "weightKg",
] as const satisfies readonly (keyof ProfileDraft)[];

export function isProfileDraftDirty(
  baseline: ProfileDraft,
  current: ProfileDraft,
): boolean {
  return PROFILE_DRAFT_KEYS.some((key) => baseline[key] !== current[key]);
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npx vitest run tests/unit/profile/profile-draft.test.ts
```

Expected: all profile draft tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/profile-draft.ts tests/unit/profile/profile-draft.test.ts
git commit -m "feat(profile): track unsaved profile changes"
```
