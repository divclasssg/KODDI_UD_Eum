# Task 1: 계약 테스트와 공통 SVG 기반

**Files:**
- Create: `tests/icon-contract-helpers.mjs`
- Create: `tests/icon-foundation-contract.test.mjs`
- Create: `src/components/icons/_internal/icon.types.ts`
- Create: `src/components/icons/_internal/IconBase.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `IconProps`, `WeightedIconProps`, `ImageAddIconProps`, `MicrophoneIconProps`
- Produces: `IconBase({ children, className, width, height, viewBox })`
- Produces: `assertIconGroup(entries)` for later contract tests

- [ ] **Step 1: Read the installed Next.js guide**

Run:

```bash
sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
```

Expected: static components do not need a `"use client"` boundary.

- [ ] **Step 2: Write the failing foundation tests**

Create `tests/icon-contract-helpers.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fromProjectRoot = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fromProjectRoot(path), "utf8");

export const assertIconGroup = async (entries) => {
  const [indexSource, designSpec] = await Promise.all([
    read("src/components/icons/index.ts"),
    read("docs/superpowers/specs/2026-07-17-icon-system-design.md"),
  ]);

  for (const entry of entries) {
    const source = await read(`src/components/icons/${entry.file}.tsx`);
    assert.match(source, /\/\*\*[\s\S]*[가-힣][\s\S]*\*\//u);
    assert.match(
      indexSource,
      new RegExp(`export \\{ ${entry.component} \\} from "\\./${entry.file}";`),
    );
    assert.ok(designSpec.includes(entry.mappingLine));
    assert.doesNotMatch(source, /["']use client["']/);
    assert.doesNotMatch(source, /<title\b|aria-label\s*=/);
    assert.doesNotMatch(source, /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\s*\(/i);
    if (entry.currentColor !== false) assert.match(source, /currentColor/);
  }
};
```

Create `tests/icon-foundation-contract.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("공통 아이콘 기반은 크기와 접근성 정책을 고정한다", async () => {
  const [base, types] = await Promise.all([
    read("src/components/icons/_internal/IconBase.tsx"),
    read("src/components/icons/_internal/icon.types.ts"),
  ]);

  assert.match(base, /aria-hidden="true"/);
  assert.match(base, /focusable="false"/);
  assert.doesNotMatch(base, /\.\.\.[a-zA-Z]/);
  assert.doesNotMatch(base, /["']use client["']/);
  assert.match(types, /weight\?: "regular" \| "bold"/);
  assert.match(types, /variant\?: "outline" \| "filled"/);
  assert.match(types, /size\?: 24 \| 32/);
  assert.match(types, /[가-힣]/u);
});
```

- [ ] **Step 3: Run the test and confirm the expected failure**

Run: `node --test tests/icon-foundation-contract.test.mjs`

Expected: FAIL with `ENOENT` for `_internal/IconBase.tsx`.

- [ ] **Step 4: Implement the shared types**

Create `src/components/icons/_internal/icon.types.ts`:

```ts
/** 모든 공개 아이콘이 공통으로 받는 배치용 속성입니다. */
export type IconProps = Readonly<{ className?: string }>;

/** regular와 bold 선 굵기를 지원하는 아이콘 속성입니다. */
export type WeightedIconProps = IconProps &
  Readonly<{ weight?: "regular" | "bold" }>;

/** 이미지 추가 아이콘의 외곽선과 채움 형태를 선택합니다. */
export type ImageAddIconProps = IconProps &
  Readonly<{ variant?: "outline" | "filled" }>;

/** 마이크 아이콘의 승인된 24px와 32px 크기를 선택합니다. */
export type MicrophoneIconProps = IconProps &
  Readonly<{ size?: 24 | 32 }>;
```

- [ ] **Step 5: Implement the non-interactive SVG shell**

Create `src/components/icons/_internal/IconBase.tsx`:

```tsx
import type { ReactNode } from "react";

type IconBaseProps = Readonly<{
  children: ReactNode;
  className?: string;
  width: number;
  height: number;
  viewBox: string;
}>;

/** 공개 아이콘의 크기와 장식용 접근성 속성을 고정하는 내부 SVG입니다. */
export function IconBase({
  children,
  className,
  width,
  height,
  viewBox,
}: IconBaseProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={height}
      viewBox={viewBox}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}
```

- [ ] **Step 6: Add and run the icon test script**

Add to `package.json` scripts:

```json
"test:icons": "node --test tests/icon-*-contract.test.mjs"
```

Run: `npm run test:icons`

Expected: PASS, 1 test.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json tests/icon-contract-helpers.mjs tests/icon-foundation-contract.test.mjs src/components/icons/_internal
git commit -m "test(icons): establish typed SVG contracts"
```

