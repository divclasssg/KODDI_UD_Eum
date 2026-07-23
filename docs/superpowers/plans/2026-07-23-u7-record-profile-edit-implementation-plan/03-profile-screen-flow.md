# Task 3 · 프로필 저장·취소·폐기 확인 화면
**Files:**
- Modify: `src/features/profile/profile-screen.tsx`
- Modify: `src/features/profile/profile-screen.module.scss`
- Test: `tests/unit/profile/profile-screen.test.tsx`
**Interfaces:**
- Consumes: `isProfileDraftDirty()`
- Consumes: normalized `returnTo: string`
- Changes: `ProfileScreenProps` adds `returnTo?: string`
- [ ] **Step 1: Write failing component tests**
Add tests that render `returnTo="/records/completed-record"`:

```tsx
it("기록에서 진입하면 과거 기록 불변 안내를 표시한다", async () => {
  render(<ProfileScreen {...props} returnTo="/records/completed-record" />);
  expect(
    await screen.findByText("과거 기록은 변경되지 않아요."),
  ).toBeVisible();
});

it("clean 취소는 같은 기록으로 즉시 복귀한다", async () => {
  const navigate = vi.fn();
  render(
    <ProfileScreen
      {...props}
      returnTo="/records/completed-record"
      navigate={navigate}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "취소하고 돌아가기" }));
  expect(navigate).toHaveBeenCalledWith("/records/completed-record");
});

it("dirty 취소는 계속 수정하거나 변경사항을 버릴 수 있다", async () => {
  const navigate = vi.fn();
  render(<ProfileScreen {...props} navigate={navigate} />);
  fireEvent.change(await screen.findByLabelText("이름"), {
    target: { value: "수정한 사용자" },
  });
  fireEvent.click(screen.getByRole("button", { name: "취소하고 돌아가기" }));
  expect(screen.getByRole("heading", { name: "변경사항을 버릴까요?" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "계속 수정" }));
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "취소하고 돌아가기" }));
  fireEvent.click(screen.getByRole("button", { name: "변경사항 버리기" }));
  expect(navigate).toHaveBeenCalledWith("/home");
});

it("저장 성공은 같은 기록으로 복귀한다", async () => {
  const navigate = vi.fn();
  render(
    <ProfileScreen
      {...props}
      returnTo="/records/completed-record"
      navigate={navigate}
    />,
  );
  fireEvent.change(await screen.findByLabelText("이름"), {
    target: { value: "수정한 사용자" },
  });
  fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/records/completed-record"),
  );
});
```

Also add focused tests for duplicate submit, save rejection draft retention, `beforeunload`, and unmount-before-save-resolution.

- [ ] **Step 2: Verify RED**
Run:

```bash
npx vitest run tests/unit/profile/profile-screen.test.tsx
```

Expected: FAIL because return navigation and discard confirmation do not exist.

- [ ] **Step 3: Implement baseline and lifecycle state**
Add baseline state and mounted guard:

```tsx
const [baseline, setBaseline] = useState<ProfileDraft>();
const [discardConfirm, setDiscardConfirm] = useState(false);
const mounted = useRef(true);
const destination = returnTo ?? "/home";
const dirty = Boolean(
  baseline && draft && isProfileDraftDirty(baseline, draft),
);

useEffect(() => {
  mounted.current = true;
  return () => {
    mounted.current = false;
  };
}, []);
```

When load succeeds:

```tsx
const nextDraft = profileBundleToDraft(bundle);
setBaseline(nextDraft);
setDraft(structuredClone(nextDraft));
setLoadState("ready");
```

Register unload protection:

```tsx
useEffect(() => {
  if (!dirty || pending) return;
  const warn = (event: BeforeUnloadEvent) => {
    event.preventDefault();
  };
  window.addEventListener("beforeunload", warn);
  return () => window.removeEventListener("beforeunload", warn);
}, [dirty, pending]);
```

After save:

```tsx
const bundle = await save(validation.value);
if (!mounted.current) return;
const nextDraft = profileBundleToDraft(bundle);
setBaseline(nextDraft);
setDraft(structuredClone(nextDraft));
setSaved(true);
navigate(destination);
```

In `catch` and `finally`, call `setSaveError` and `setPending` only when
`mounted.current` is still true.

Implement cancel handlers:

```tsx
const cancel = () => {
  if (pending) return;
  if (dirty) {
    setDiscardConfirm(true);
    return;
  }
  navigate(destination);
};

const discard = () => {
  setDiscardConfirm(false);
  navigate(destination);
};
```

- [ ] **Step 4: Implement sections and confirmation panel**
Wrap basic fields and medical fields in labeled sections. Add the record-entry notice when `destination !== "/home"`. Add buttons:

```tsx
<button type="button" disabled={pending} onClick={cancel}>
  취소하고 돌아가기
</button>
```

Render:

```tsx
{discardConfirm && (
  <section className={styles.confirmPanel} aria-labelledby="discard-title">
    <h2 id="discard-title">변경사항을 버릴까요?</h2>
    <p>저장하지 않은 내용은 복구할 수 없어요.</p>
    <button type="button" onClick={() => setDiscardConfirm(false)}>
      계속 수정
    </button>
    <button type="button" onClick={discard}>
      변경사항 버리기
    </button>
  </section>
)}
```

Add `.formSection`, `.notice`, `.confirmPanel` grid styles and keep all buttons at `var(--size-touch-target-min)`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npx vitest run tests/unit/profile/profile-screen.test.tsx tests/unit/profile/profile-draft.test.ts
npx eslint src/features/profile tests/unit/profile
npm run typecheck
```

Expected: focused tests, lint, and typecheck PASS without act warnings.

- [ ] **Step 6: Commit**

```bash
git add src/features/profile/profile-screen.tsx src/features/profile/profile-screen.module.scss tests/unit/profile/profile-screen.test.tsx
git commit -m "feat(profile): confirm and return from record edits"
```
