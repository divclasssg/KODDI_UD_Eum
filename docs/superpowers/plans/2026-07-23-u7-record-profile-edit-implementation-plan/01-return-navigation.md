# Task 1 · 복귀 경로와 Next.js page 계약

**Files:**
- Create: `src/features/profile/profile-navigation.ts`
- Modify: `src/app/profile/page.tsx`
- Test: `tests/unit/profile/profile-navigation.test.ts`

**Interfaces:**
- Produces: `normalizeProfileReturnTo(value: string | string[] | undefined): string`
- Produces: `buildProfileEditHref(interviewId: string): string`
- Default destination: `/home`

- [ ] **Step 1: Write the failing navigation tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildProfileEditHref,
  normalizeProfileReturnTo,
} from "@/features/profile/profile-navigation";

describe("profile navigation", () => {
  it.each([
    ["/records/completed-record", "/records/completed-record"],
    ["/records/record%2F한글", "/records/record%2F한글"],
  ])("허용된 기록 상세 %s를 유지한다", (value, expected) => {
    expect(normalizeProfileReturnTo(value)).toBe(expected);
  });

  it.each([
    undefined,
    ["/records/one", "/records/two"],
    "",
    "/records/",
    "/records/id/clinician",
    "/records/id?tab=profile",
    "//example.com/records/id",
    "https://example.com/records/id",
    String.raw`\records\id`,
    "/records/%E0%A4%A",
  ])("허용되지 않은 복귀 경로는 홈으로 보낸다", (value) => {
    expect(normalizeProfileReturnTo(value)).toBe("/home");
  });

  it("인코딩된 동일 기록 profile href를 만든다", () => {
    expect(buildProfileEditHref("record/한글")).toBe(
      "/profile?returnTo=%2Frecords%2Frecord%252F%25ED%2595%259C%25EA%25B8%2580",
    );
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run tests/unit/profile/profile-navigation.test.ts
```

Expected: FAIL because `profile-navigation` does not exist.

- [ ] **Step 3: Implement the allowlist and URL builder**

```ts
const HOME_PATH = "/home";
const RECORD_DETAIL_PATTERN = /^\/records\/([^/?#\\]+)$/;

export function normalizeProfileReturnTo(
  value: string | string[] | undefined,
): string {
  if (typeof value !== "string") return HOME_PATH;
  const match = RECORD_DETAIL_PATTERN.exec(value);
  if (!match || match[1].length === 0) return HOME_PATH;
  try {
    if (decodeURIComponent(match[1]).length === 0) return HOME_PATH;
  } catch {
    return HOME_PATH;
  }
  return value;
}

export function buildProfileEditHref(interviewId: string): string {
  const recordPath = `/records/${encodeURIComponent(interviewId)}`;
  return `/profile?returnTo=${encodeURIComponent(recordPath)}`;
}
```

Update `src/app/profile/page.tsx`:

```tsx
import { ProfileScreenWithRouter } from "@/features/profile/profile-screen";
import { normalizeProfileReturnTo } from "@/features/profile/profile-navigation";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <ProfileScreenWithRouter
      returnTo={normalizeProfileReturnTo(returnTo)}
    />
  );
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npx vitest run tests/unit/profile/profile-navigation.test.ts
npm run typecheck
```

Expected: navigation tests and typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/profile-navigation.ts src/app/profile/page.tsx tests/unit/profile/profile-navigation.test.ts
git commit -m "feat(profile): validate record return navigation"
```
