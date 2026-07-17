# Task 6: 전체 시각 검증

**Files:**
- Create then delete: `src/app/icon-verification/page.tsx`
- Create then delete: `src/app/icon-verification/page.module.scss`
- Modify: `docs/worklogs/2026-07-17.md`

**Interfaces:**
- Consumes: all 23 icon exports and `Logo`
- Produces: Figma comparison evidence with no product verification route

- [ ] **Step 1: Create the temporary gallery page**

Create `src/app/icon-verification/page.tsx`:

```tsx
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import {
  ArrowUpIcon, CaretDownIcon, CaretLeftIcon, CaretUpIcon,
  ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon,
  CircleIcon, ClockIcon, CloseIcon, EditIcon, EditPencilIcon,
  FileTextIcon, ImageAddIcon, LockIcon, LockOpenIcon, MessageIcon,
  MicrophoneIcon, SearchIcon, TriangleIcon, UndoUpRightIcon, UserIcon,
} from "@/components/icons";
import styles from "./page.module.scss";

type SampleProps = Readonly<{ children: ReactNode; name: string }>;

function Sample({ children, name }: SampleProps) {
  return (
    <article className={styles.sample}>
      <h2>{name}</h2>
      <div className={styles.icons}>{children}</div>
    </article>
  );
}

export default function IconVerificationPage() {
  return (
    <main className={styles.page}>
      <h1>아이콘 시각 검증</h1>
      <section className={styles.grid}>
        <Sample name="Caret Down"><CaretDownIcon /><CaretDownIcon weight="bold" /></Sample>
        <Sample name="Caret Up"><CaretUpIcon /><CaretUpIcon weight="bold" /></Sample>
        <Sample name="Caret Left"><CaretLeftIcon /></Sample>
        <Sample name="Chevron Up"><ChevronUpIcon /><ChevronUpIcon weight="bold" /></Sample>
        <Sample name="Chevron Down"><ChevronDownIcon /><ChevronDownIcon weight="bold" /></Sample>
        <Sample name="Chevron Left"><ChevronLeftIcon /><ChevronLeftIcon weight="bold" /></Sample>
        <Sample name="Chevron Right"><ChevronRightIcon /><ChevronRightIcon weight="bold" /></Sample>
        <Sample name="Arrow Up"><ArrowUpIcon /><ArrowUpIcon weight="bold" /></Sample>
        <Sample name="Close"><CloseIcon /><CloseIcon weight="bold" /></Sample>
        <Sample name="Circle"><CircleIcon /><CircleIcon weight="bold" /></Sample>
        <Sample name="Triangle"><TriangleIcon /><TriangleIcon weight="bold" /></Sample>
        <Sample name="Undo"><UndoUpRightIcon /><UndoUpRightIcon weight="bold" /></Sample>
        <Sample name="Lock Open"><LockOpenIcon /><LockOpenIcon weight="bold" /></Sample>
        <Sample name="Image Add"><ImageAddIcon /><ImageAddIcon variant="filled" /></Sample>
        <Sample name="Microphone"><MicrophoneIcon /><MicrophoneIcon size={32} /></Sample>
        <Sample name="File Text"><FileTextIcon /><FileTextIcon weight="bold" /></Sample>
        <Sample name="Edit"><EditIcon /><EditIcon weight="bold" /></Sample>
        <Sample name="Edit Pencil"><EditPencilIcon /><EditPencilIcon weight="bold" /></Sample>
        <Sample name="Lock"><LockIcon /><LockIcon weight="bold" /></Sample>
        <Sample name="Search"><SearchIcon /><SearchIcon weight="bold" /></Sample>
        <Sample name="Clock"><ClockIcon /></Sample>
        <Sample name="User"><UserIcon /></Sample>
        <Sample name="Message"><MessageIcon /></Sample>
        <Sample name="Logo"><Logo /></Sample>
      </section>
      <section className={styles.states}>
        <SearchIcon className={styles.brand} />
        <SearchIcon className={styles.disabled} />
        <ImageAddIcon className={styles.detail} variant="filled" />
      </section>
    </main>
  );
}
```

Create `src/app/icon-verification/page.module.scss`:

```scss
.page {
  min-height: 100vh;
  padding: var(--space-32);
  color: var(--color-icon-primary);
  background: var(--color-bg-primary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-16);
}
.sample {
  padding: var(--space-16);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
}
.icons, .states {
  display: flex;
  align-items: center;
  gap: var(--space-16);
}
.brand { color: var(--color-icon-brand); }
.disabled { color: var(--color-icon-disabled); }
.detail {
  color: var(--color-icon-primary);
  --image-add-detail-color: var(--color-icon-brand);
}
```

- [ ] **Step 2: Compare with Figma in a real browser**

Run `npm run dev`, load the in-app browser skill, then:

1. Open `http://127.0.0.1:3000/icon-verification`.
2. Compare every sample with Figma node `2025:3718` at 100% zoom.
3. Check direction, alignment, regular/bold, ImageAdd detail, Microphone 24/32, and Logo colors.
4. Repeat at 200% zoom and 393px viewport.
5. Check crop, blur, baseline shift, hydration warning, and console errors.

Expected: all checks pass. On failure, add a regression assertion and fix the owning component before continuing.

- [ ] **Step 3: Remove the temporary route**

Delete both temporary files with `apply_patch`.

Run: `test ! -e src/app/icon-verification/page.tsx`

Expected: exit code 0.

- [ ] **Step 4: Record and commit visual evidence**

Append:

```markdown
## 아이콘 시스템

- 임시 갤러리에서 아이콘 23개와 Logo를 Figma 원본과 비교했다.
- 100%·200% 확대와 393px viewport에서 방향·선 굵기·색상·잘림을 확인했다.
- 브라우저 콘솔 오류가 없음을 확인하고 임시 갤러리를 제거했다.
```

Run: `git diff --check`

Expected: exit code 0 and no `src/app/icon-verification` files in `git status --short`.

```bash
git add docs/worklogs/2026-07-17.md
git commit -m "docs: record icon visual verification"
```
