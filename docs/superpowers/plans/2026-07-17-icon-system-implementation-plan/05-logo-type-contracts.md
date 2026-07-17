# Task 5: Logo와 공개 API 타입 계약

**Files:**
- Create: `tests/icon-brand-contract.test.mjs`
- Create: `tests/icon-types.test.tsx`
- Create: `src/components/brand/Logo.tsx`

**Interfaces:**
- Consumes: `IconProps`
- Produces: `Logo({ className })`
- Completes: compile-time rejection of unsupported public props

- [ ] **Step 1: Export Logo read-only**

After loading `figma-use`, run:

```js
const page = await figma.getNodeByIdAsync("2025:3718");
if (!page || page.type !== "PAGE") throw new Error("Icons 페이지가 없습니다.");
await figma.setCurrentPageAsync(page);
const logo = await figma.getNodeByIdAsync("2009:8683");
if (!logo || logo.type !== "COMPONENT") throw new Error("Logo가 없습니다.");
return {
  id: logo.id,
  name: logo.name,
  svg: await logo.exportAsync({
    format: "SVG_STRING",
    contentsOnly: true,
    svgIdAttribute: false,
    svgOutlineText: true,
    svgSimplifyStroke: false,
  }),
};
```

Expected: one 48×32 SVG containing two shapes and their original colors.

- [ ] **Step 2: Write the failing brand contract**

Create `tests/icon-brand-contract.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Logo는 브랜드 크기와 장식용 접근성 계약을 지킨다", async () => {
  const [source, designSpec] = await Promise.all([
    readFile(new URL("../src/components/brand/Logo.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../docs/superpowers/specs/2026-07-17-icon-system-design.md",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(source, /\/\*\*[\s\S]*[가-힣][\s\S]*\*\//u);
  assert.match(source, /width=\{48\}/);
  assert.match(source, /height=\{32\}/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /focusable="false"/);
  assert.doesNotMatch(source, /<title\b|aria-label\s*=|["']use client["']/);
  assert.ok(designSpec.includes("| Logo | `2009:8683` | `Logo` |"));
});
```

Run: `npm run test:icons`

Expected: FAIL with `ENOENT` for `Logo.tsx`.

- [ ] **Step 3: Implement Logo with Korean usage documentation**

Use this exact TSDoc:

```ts
/**
 * 48×32 크기의 브랜드 로고입니다.
 *
 * 고유 색상을 유지하는 장식용 SVG입니다.
 * 링크나 헤더에서 사용할 때 접근 가능한 이름은 사용하는 요소에 지정합니다.
 */
```

Implementation rules:

1. Create a direct 48×32 `svg` in `src/components/brand/Logo.tsx`.
2. Accept only `IconProps` and keep `aria-hidden="true"` and `focusable="false"` fixed.
3. Preserve the exported two-shape paths and exact Figma colors.
4. Do not import `IconBase` across the brand boundary.
5. Do not expose `title`, `aria-label`, arbitrary size, or paint props.

- [ ] **Step 4: Add compile-time usage tests**

Create `tests/icon-types.test.tsx`:

```tsx
import { Logo } from "@/components/brand/Logo";
import {
  ChevronDownIcon,
  ImageAddIcon,
  MicrophoneIcon,
  SearchIcon,
} from "@/components/icons";

const approvedUsage = [
  <ChevronDownIcon key="chevron" weight="bold" />,
  <ImageAddIcon key="image" variant="filled" />,
  <MicrophoneIcon key="microphone" size={32} />,
  <SearchIcon className="search-icon" key="search" />,
  <Logo className="brand-logo" key="logo" />,
];

// @ts-expect-error 임의 색상은 부모 CSS에서 지정해야 합니다.
const invalidColor = <SearchIcon color="red" />;
// @ts-expect-error 마이크는 승인된 두 크기만 지원합니다.
const invalidMicrophoneSize = <MicrophoneIcon size={20} />;
// @ts-expect-error chevron은 임의 크기 속성을 제공하지 않습니다.
const invalidChevronSize = <ChevronDownIcon size={32} />;
// @ts-expect-error 승인되지 않은 선 굵기 이름은 사용할 수 없습니다.
const invalidWeight = <ChevronDownIcon weight="semibold" />;
// @ts-expect-error 이미지 아이콘은 outline과 filled만 지원합니다.
const invalidVariant = <ImageAddIcon variant="solid" />;
// @ts-expect-error 접근 가능한 이름은 로고를 사용하는 요소에 지정합니다.
const invalidLogoLabel = <Logo aria-label="이음" />;

void [
  approvedUsage,
  invalidColor,
  invalidMicrophoneSize,
  invalidChevronSize,
  invalidWeight,
  invalidVariant,
  invalidLogoLabel,
];
```

- [ ] **Step 5: Verify and commit**

Run: `npm run test:icons && npm run lint && npm run typecheck`

Expected: PASS, 5 Node tests, then lint and TypeScript exit code 0.

```bash
git add tests/icon-brand-contract.test.mjs tests/icon-types.test.tsx src/components/brand
git commit -m "feat(icons): add brand logo and public type contracts"
```
