# Task 2: 방향·기본 도형 아이콘

**Files:**
- Create: `tests/icon-directional-contract.test.mjs`
- Create: `src/components/icons/{CaretDown,CaretUp,CaretLeft,ChevronUp,ChevronDown,ChevronLeft,ChevronRight,ArrowUp,Close,Circle,Triangle,UndoUpRight}Icon.tsx`
- Create: `src/components/icons/index.ts`

**Interfaces:**
- Consumes: `IconBase`, `IconProps`, `WeightedIconProps`
- Produces: 12 named icon exports
- Defaults: `weight="regular"` except fixed-weight `CaretLeftIcon`

- [ ] **Step 1: Export the approved Figma variants read-only**

Load `figma-use` and its required references, then call `use_figma` with `skillNames: "figma-use"` and this code:

```js
const page = await figma.getNodeByIdAsync("2025:3718");
if (!page || page.type !== "PAGE") throw new Error("Icons 페이지가 없습니다.");
await figma.setCurrentPageAsync(page);

const setIds = [
  "2009:3567", "2009:3570", "2009:3579", "2009:3576",
  "2009:3573", "2009:3582", "2009:3595", "2016:2187",
  "2009:8470", "2009:8698", "2009:8695", "2009:8718",
];
const exported = [];

for (const id of setIds) {
  const set = await figma.getNodeByIdAsync(id);
  if (!set || set.type !== "COMPONENT_SET") {
    throw new Error(`컴포넌트 세트가 없습니다: ${id}`);
  }
  const variants = [];
  for (const component of set.children) {
    if (component.type !== "COMPONENT") continue;
    variants.push({
      id: component.id,
      name: component.name,
      svg: await component.exportAsync({
        format: "SVG_STRING",
        contentsOnly: true,
        svgIdAttribute: false,
        svgOutlineText: true,
        svgSimplifyStroke: false,
      }),
    });
  }
  exported.push({ id, name: set.name, variants });
}
return exported;
```

Expected: 12 sets. Save nothing to Figma and use the returned SVG strings only as implementation input.

- [ ] **Step 2: Write the failing group contract**

Create `tests/icon-directional-contract.test.mjs`:

```js
import test from "node:test";
import { assertIconGroup } from "./icon-contract-helpers.mjs";

const icons = [
  ["Caret_Down_MD", "2009:3567", "CaretDownIcon"],
  ["Caret_Up_MD", "2009:3570", "CaretUpIcon"],
  ["Chevron_Up", "2009:3579", "ChevronUpIcon"],
  ["Chevron_Down", "2009:3576", "ChevronDownIcon"],
  ["Chevron_Left_MD", "2009:3573", "CaretLeftIcon"],
  ["Arrow", "2009:3582", "ChevronLeftIcon"],
  ["Chevron_Right", "2009:3595", "ChevronRightIcon"],
  ["Arrow_Up", "2016:2187", "ArrowUpIcon"],
  ["Close_LG", "2009:8470", "CloseIcon"],
  ["Circle", "2009:8698", "CircleIcon"],
  ["Triangle", "2009:8695", "TriangleIcon"],
  ["Arrow_Undo_Up_Right", "2009:8718", "UndoUpRightIcon"],
].map(([figmaName, nodeId, component]) => ({
  component,
  file: component,
  mappingLine: `| ${figmaName} | \`${nodeId}\` | \`${component}\` |`,
}));

test("방향과 기본 도형 아이콘은 승인된 공개 계약을 따른다", async () => {
  await assertIconGroup(icons);
});
```

Run: `npm run test:icons`

Expected: FAIL because `src/components/icons/index.ts` does not exist.

- [ ] **Step 3: Add exact Korean usage comments**

각 파일의 TSDoc 첫 문장은 아래 표의 설명을 그대로 사용한다. 빈 줄 뒤에는 `부모 요소의 color를 상속하는 장식용 SVG입니다.`와 `접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.`를 그대로 추가한다.

| Component | 설명 |
|---|---|
| CaretDownIcon | 작은 영역에서 아래 방향을 나타내는 24px caret입니다. weight로 선 굵기를 선택합니다. |
| CaretUpIcon | 작은 영역에서 위 방향을 나타내는 24px caret입니다. weight로 선 굵기를 선택합니다. |
| CaretLeftIcon | 작은 영역에서 왼쪽 방향을 나타내는 고정 굵기 24px caret입니다. |
| ChevronUpIcon | 위 방향을 나타내는 24px chevron입니다. weight로 선 굵기를 선택합니다. |
| ChevronDownIcon | 아래 방향을 나타내는 24px chevron입니다. weight로 선 굵기를 선택합니다. |
| ChevronLeftIcon | 왼쪽 방향을 나타내는 24px chevron입니다. weight로 선 굵기를 선택합니다. |
| ChevronRightIcon | 오른쪽 방향을 나타내는 24px chevron입니다. weight로 선 굵기를 선택합니다. |
| ArrowUpIcon | 위로 이동하거나 올리는 동작을 나타내는 24px 화살표입니다. weight로 선 굵기를 선택합니다. |
| CloseIcon | 닫기 또는 제거 동작을 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| CircleIcon | 원형 상태 표시를 위한 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| TriangleIcon | 삼각형 상태 표시를 위한 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| UndoUpRightIcon | 이전 동작으로 되돌리는 흐름을 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |

- [ ] **Step 4: Implement the 12 SVG components**

For every exported SVG:

1. Keep `viewBox="0 0 24 24"`, path data, cap, join, fill rule, and clip rule.
2. Replace monochrome stroke and fill values with `currentColor`.
3. Remove Figma `id`, style, metadata, width, and height from inner nodes.
4. Use `IconBase` for the root. Do not spread remaining props.
5. Use `WeightedIconProps` and `weight === "bold"` for all except `CaretLeftIcon`.
6. Use regular stroke 1.4 and bold stroke 2; `UndoUpRightIcon` alone uses regular 1.6.
7. `CaretLeftIcon` uses `IconProps` and fixed stroke 2 because both Figma variants are identical.
8. `CircleIcon`은 사용자가 승인한 예외로 처리한다. 잘못 내보내진 Figma regular의 27×24 형상은 보존하지 않고, regular와 bold 모두 중앙에 정렬된 같은 24×24 원형 path를 공유하며 `strokeWidth`만 regular 1.4, bold 2로 전환한다.

The implementation shape for `CaretDownIcon.tsx` is:

```tsx
import { IconBase } from "./_internal/IconBase";
import type { WeightedIconProps } from "./_internal/icon.types";

/**
 * 작은 영역에서 아래 방향을 나타내는 24px caret입니다. weight로 선 굵기를 선택합니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.
 */
export function CaretDownIcon({
  className,
  weight = "regular",
}: WeightedIconProps) {
  return (
    <IconBase className={className} height={24} viewBox="0 0 24 24" width={24}>
      <path
        d="M8 10L12 14L16 10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={weight === "bold" ? 2 : 1.4}
      />
    </IconBase>
  );
}
```

- [ ] **Step 5: Export the group and verify**

Create `src/components/icons/index.ts` with one explicit export per component:

```ts
export { ArrowUpIcon } from "./ArrowUpIcon";
export { CaretDownIcon } from "./CaretDownIcon";
export { CaretLeftIcon } from "./CaretLeftIcon";
export { CaretUpIcon } from "./CaretUpIcon";
export { ChevronDownIcon } from "./ChevronDownIcon";
export { ChevronLeftIcon } from "./ChevronLeftIcon";
export { ChevronRightIcon } from "./ChevronRightIcon";
export { ChevronUpIcon } from "./ChevronUpIcon";
export { CircleIcon } from "./CircleIcon";
export { CloseIcon } from "./CloseIcon";
export { TriangleIcon } from "./TriangleIcon";
export { UndoUpRightIcon } from "./UndoUpRightIcon";
```

Run: `npm run test:icons && npm run typecheck`

Expected: PASS, 2 Node tests and TypeScript exit code 0.

- [ ] **Step 6: Commit the group**

```bash
git add tests/icon-directional-contract.test.mjs src/components/icons
git commit -m "feat(icons): add directional and shape icons"
```
