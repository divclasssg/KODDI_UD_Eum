# Task 7: 문서와 최종 검증 게이트

**Files:**
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md`
- Modify: `docs/worklogs/2026-07-17.md`

**Interfaces:**
- Consumes: completed icon library, contracts, and visual evidence
- Produces: final verification evidence and completed icon checklist item

- [ ] **Step 1: Run focused icon and token tests**

```bash
npm run test:icons
npm run test:tokens
```

Expected: icon tests 6/6 and token tests 4/4 pass.

- [ ] **Step 2: Run repository quality gates**

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: every command exits 0. The production build includes no `/icon-verification` route.

- [ ] **Step 3: Confirm final inventory and comment contract**

Run:

```bash
find src/components/icons -maxdepth 1 -name '*Icon.tsx' | sort
rg -n '/\*\*|aria-hidden|focusable|currentColor' src/components/icons src/components/brand/Logo.tsx
git status --short
```

Expected:

- Exactly 23 public `*Icon.tsx` files.
- Every public component has Korean TSDoc.
- Every SVG is decorative.
- Only ImageAdd detail and Logo use the approved color exceptions.
- No temporary route or unrelated file is present.

- [ ] **Step 4: Update the implementation checklist**

Change only this existing item:

```markdown
- [x] 아이콘 23개와 Logo 구현·계약 테스트·Figma 시각 비교
```

Do not mark the broader U9 Figma or persona tasks complete.

- [ ] **Step 5: Append exact final evidence to the worklog**

Add under `## 아이콘 시스템`:

```markdown
- 아이콘 23개와 Logo 1개를 승인된 이름과 variant 계약으로 구현했다.
- 모든 공개 컴포넌트에 형태·속성·색상·접근성 사용법을 설명하는 한글 TSDoc을 추가했다.
- `test:icons` 6/6, `test:tokens` 4/4, lint, typecheck, production build가 통과했다.
```

- [ ] **Step 6: Commit the final evidence**

```bash
git add docs src/components tests package.json
git commit -m "docs: complete icon system implementation record"
```

Do not push unless the user explicitly requests it.
