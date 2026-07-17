# Task 4: 내비게이션 아이콘

**Files:**
- Create: `tests/icon-navigation-contract.test.mjs`
- Create: `src/components/icons/{Clock,User,Message}Icon.tsx`
- Modify: `src/components/icons/index.ts`

**Interfaces:**
- Consumes: `IconBase` and `IconProps`
- Produces: `ClockIcon`, `UserIcon`, `MessageIcon`
- Collapses: selected/default paint variants into parent-controlled `currentColor`

- [ ] **Step 1: Export navigation geometry read-only**

After loading `figma-use`, run:

```js
const page = await figma.getNodeByIdAsync("2025:3718");
if (!page || page.type !== "PAGE") throw new Error("Icons 페이지가 없습니다.");
await figma.setCurrentPageAsync(page);

const setIds = ["2009:8530", "2009:8533", "2009:8536"];
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

Expected: each pair has the same geometry and only paint differences.

- [ ] **Step 2: Write the failing navigation contract**

Create `tests/icon-navigation-contract.test.mjs`:

```js
import test from "node:test";
import { assertIconGroup } from "./icon-contract-helpers.mjs";

const icons = [
  ["History", "2009:8530", "ClockIcon"],
  ["Profile", "2009:8533", "UserIcon"],
  ["Home", "2009:8536", "MessageIcon"],
].map(([figmaName, nodeId, component]) => ({
  component,
  file: component,
  mappingLine: `| ${figmaName} | \`${nodeId}\` | \`${component}\` |`,
}));

test("내비게이션 아이콘은 색상 상태를 부모에게 위임한다", async () => {
  await assertIconGroup(icons);
});
```

Run: `npm run test:icons`

Expected: FAIL for missing `ClockIcon.tsx`.

- [ ] **Step 3: Add exact Korean usage comments**

Use these complete TSDoc comments:

```ts
/**
 * 시각적인 시간 또는 기록을 나타내는 24px 시계 아이콘입니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 선택 상태는 부모의 색상 토큰으로 표현하고 접근 가능한 이름도 부모가 제공합니다.
 */

/**
 * 사용자 또는 프로필을 나타내는 24px 아이콘입니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 선택 상태는 부모의 색상 토큰으로 표현하고 접근 가능한 이름도 부모가 제공합니다.
 */

/**
 * 대화 또는 문진 메시지를 나타내는 24px 아이콘입니다.
 *
 * 부모 요소의 color를 상속하는 장식용 SVG입니다.
 * 선택 상태는 부모의 색상 토큰으로 표현하고 접근 가능한 이름도 부모가 제공합니다.
 */
```

- [ ] **Step 4: Implement the three icons**

1. Use `IconProps` and `IconBase` with 24×24.
2. Keep one geometry per icon and replace selected/default paints with `currentColor`.
3. Remove the erroneous `_default` text node from the Home default variant.
4. Do not expose `selected`, `active`, or Figma `Property 1` props.
5. Preserve the exported path, ellipse, stroke cap, join, and width values.

- [ ] **Step 5: Extend exports and verify**

Append:

```ts
export { ClockIcon } from "./ClockIcon";
export { MessageIcon } from "./MessageIcon";
export { UserIcon } from "./UserIcon";
```

Run: `npm run test:icons && npm run typecheck`

Expected: PASS, 4 Node tests and TypeScript exit code 0.

- [ ] **Step 6: Commit the navigation group**

```bash
git add tests/icon-navigation-contract.test.mjs src/components/icons
git commit -m "feat(icons): add navigation icons"
```

