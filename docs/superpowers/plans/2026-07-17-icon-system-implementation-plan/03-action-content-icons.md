# Task 3: 동작·콘텐츠 아이콘

**Files:**
- Create: `tests/icon-action-content-contract.test.mjs`
- Create: `src/components/icons/{LockOpen,ImageAdd,Microphone,FileText,Edit,EditPencil,Lock,Search}Icon.tsx`
- Modify: `src/components/icons/index.ts`

**Interfaces:**
- Consumes: `IconBase` and all four public prop types
- Produces: 8 additional named icon exports
- Special cases: ImageAdd two-tone CSS variable, Microphone fixed size union, duplicate File collapse

- [ ] **Step 1: Export the source SVGs and prove the File duplicate**

After loading the `figma-use` skill, run this read-only `use_figma` script:

```js
const page = await figma.getNodeByIdAsync("2025:3718");
if (!page || page.type !== "PAGE") throw new Error("Icons 페이지가 없습니다.");
await figma.setCurrentPageAsync(page);

const setIds = [
  "2009:8732", "2009:8744", "2009:8756", "2009:8768",
  "2009:8782", "2009:8796", "2016:2201", "2016:2215", "2025:3699",
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

Expected: 9 sets. `2009:8768` and `2016:2201` must have identical regular and bold SVG geometry; create only `FileTextIcon`.

- [ ] **Step 2: Write the failing contract**

Create `tests/icon-action-content-contract.test.mjs`:

```js
import test from "node:test";
import { assertIconGroup } from "./icon-contract-helpers.mjs";

const icons = [
  ["Lock_Open", "2009:8732", "LockOpenIcon"],
  ["Image", "2009:8744", "ImageAddIcon"],
  ["Voice", "2009:8756", "MicrophoneIcon"],
  ["File", "2009:8768", "FileTextIcon"],
  ["Edit", "2009:8782", "EditIcon"],
  ["Edit_pencile", "2009:8796", "EditPencilIcon"],
  ["File 중복", "2016:2201", "FileTextIcon"],
  ["Lock", "2016:2215", "LockIcon"],
  ["search", "2025:3699", "SearchIcon"],
].map(([figmaName, nodeId, component]) => ({
  component,
  file: component,
  mappingLine: `| ${figmaName} | \`${nodeId}\` | \`${component}\`` +
    (figmaName === "File 중복" ? "으로 통합 |" : " |"),
}));

test("동작과 콘텐츠 아이콘은 승인된 공개 계약을 따른다", async () => {
  await assertIconGroup(icons);
});
```

Run: `npm run test:icons`

Expected: FAIL for missing `LockOpenIcon.tsx`.

- [ ] **Step 3: Add exact Korean usage comments**

각 파일의 TSDoc 첫 문장은 아래 표의 문장을 그대로 사용한다.

| Component | 첫 문단 |
|---|---|
| LockOpenIcon | 잠금이 해제된 상태를 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| ImageAddIcon | 이미지 추가 동작을 나타내는 아이콘입니다. variant로 outline과 filled를 선택합니다. |
| MicrophoneIcon | 음성 입력을 나타내는 마이크 아이콘입니다. size로 24px와 32px를 선택합니다. |
| FileTextIcon | 텍스트가 있는 문서를 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| EditIcon | 연필을 이용한 편집 동작을 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| EditPencilIcon | 밑선이 있는 연필 편집 동작을 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| LockIcon | 잠긴 상태를 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |
| SearchIcon | 검색 동작을 나타내는 24px 아이콘입니다. weight로 선 굵기를 선택합니다. |

모든 첫 문단 뒤에는 `부모 요소의 color를 상속하는 장식용 SVG입니다.`와 `접근 가능한 이름은 사용하는 버튼이나 링크에 지정합니다.`를 그대로 추가한다. ImageAdd에는 `filled 세부 색상은 --image-add-detail-color로 재정의합니다.`를, Microphone에는 `size를 생략하면 24px로 표시됩니다.`를 추가한다.

- [ ] **Step 4: Implement the eight components**

Use the exported SVG strings and these exact rules:

| Component | Props | Size | Variant mapping |
|---|---|---|---|
| LockOpenIcon | WeightedIconProps | 24 | 1.4 / 2 |
| ImageAddIcon | ImageAddIconProps | 30.23×27.06 | outline / filled |
| MicrophoneIcon | MicrophoneIconProps | 24 / 32 | sm / lg |
| FileTextIcon | WeightedIconProps | 24 | 1.4 / 2 |
| EditIcon | WeightedIconProps | 24 | 1.4 / 2 |
| EditPencilIcon | WeightedIconProps | 24 | 1.4 / 2 |
| LockIcon | WeightedIconProps | 24 | 1.4 / 2 |
| SearchIcon | WeightedIconProps | 24 | 1.4 / 2 |

Conversion requirements:

1. Preserve SVG path and geometry without rounding.
2. Replace monochrome paint with `currentColor`.
3. In ImageAdd filled only, use `currentColor` for the Neutral 800 body and `var(--image-add-detail-color, var(--color-icon-disabled))` for the Neutral 300 details.
4. Keep `svgOutlineText: true` output for the ImageAdd plus sign so no `<text>` or font dependency remains.
5. Microphone uses `size === 32` to select the lg geometry; do not scale the 24px path.
6. Do not create a second File component or expose the Figma variant names.

- [ ] **Step 5: Extend exports and verify**

Append exactly:

```ts
export { EditIcon } from "./EditIcon";
export { EditPencilIcon } from "./EditPencilIcon";
export { FileTextIcon } from "./FileTextIcon";
export { ImageAddIcon } from "./ImageAddIcon";
export { LockIcon } from "./LockIcon";
export { LockOpenIcon } from "./LockOpenIcon";
export { MicrophoneIcon } from "./MicrophoneIcon";
export { SearchIcon } from "./SearchIcon";
```

Run: `npm run test:icons && npm run typecheck`

Expected: PASS, 3 Node tests and TypeScript exit code 0.

- [ ] **Step 6: Commit the group**

```bash
git add tests/icon-action-content-contract.test.mjs src/components/icons
git commit -m "feat(icons): add action and content icons"
```
