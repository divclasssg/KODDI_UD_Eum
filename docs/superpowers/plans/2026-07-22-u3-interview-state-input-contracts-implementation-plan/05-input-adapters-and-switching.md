> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 5: Input Adapters와 Switching Integration

**Files:**
- Create: `src/features/inputs/input-switcher.tsx`
- Create: `src/features/inputs/text-input.tsx`
- Create: `src/features/inputs/choice-input.tsx`
- Create: `src/features/inputs/chip-input.tsx`
- Create: `src/features/inputs/measurement-input.tsx`
- Create: `src/features/inputs/input-adapters.module.scss`
- Create: `tests/unit/inputs/input-switcher.test.tsx`
- Create: `tests/unit/inputs/chip-input.test.tsx`
- Create: `tests/unit/inputs/measurement-input.test.tsx`
- Create: `tests/integration/interview/input-switching.test.tsx`

**Interfaces:**
- Consumes: Task 1 `QuestionSnapshotV2`, `CommonDraftV2`, validation issue paths
- Produces: controlled input components that emit only `DRAFT_EDITED` and `INPUT_MODE_SWITCHED`

- [ ] **Step 1: switcher와 chip RED 작성**

```tsx
it("text와 chip을 왕복해도 각 controlled value가 남는다", async () => {
  render(<SyntheticInputHarness question={SYNTHETIC_SWITCHING_QUESTION} />);
  await user.type(screen.getByLabelText("직접 입력"), "합성 두통");
  await user.click(screen.getByRole("tab", { name: "기간 선택" }));
  await user.click(screen.getByRole("checkbox", { name: "며칠 전" }));
  await user.click(screen.getByRole("tab", { name: "직접 입력" }));
  expect(screen.getByLabelText("직접 입력")).toHaveValue("합성 두통");
});
```

chip single/multiple, unknown 상호배타, keyboard Space/Arrow 접근, minimum 48px class contract를 검증한다.

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/inputs/input-switcher.test.tsx tests/unit/inputs/chip-input.test.tsx`

Expected: FAIL because input adapter files do not exist.

- [ ] **Step 3: controlled switcher·text·choice·chip 최소 구현**

switcher는 허용 mode가 둘 이상일 때만 `tablist`를 표시한다. 각 panel은 current draft branch만 읽고 전체 draft를 복사해 event payload로 보낸다. option label과 ID는 snapshot에서만 읽는다.

- [ ] **Step 4: measurement RED 작성**

known value/unit/time 입력, unknown 토글, validation error focus/aria-describedby, unknown→known 복귀 값 보존을 검증한다. test fixture는 합성 온도 contract를 사용하지만 공개 manual route에는 노출하지 않는다.

```tsx
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
  values: expect.objectContaining({
    measurement: {
      state: "known",
      rawValue: "37.2",
      unitId: "celsius",
      measuredAtLocal: "2026-07-22T10:30",
    },
  }),
}));
```

- [ ] **Step 5: measurement 최소 구현**

`inputMode="decimal"`, snapshot unit select/radio, `datetime-local`, unknown checkbox를 controlled로 렌더링한다. 정상범위·진단 문구를 표시하지 않는다. unknown은 field를 disabled할 수 있지만 값을 삭제하지 않는다.

- [ ] **Step 6: 실제 application service integration RED 작성**

fake repository port와 real machine/service/input components를 연결한다. text→chip→text, measurement known→unknown→reload snapshot load를 검증하고 UI가 repository를 직접 호출하지 않는지 spy로 확인한다.

- [ ] **Step 7: GREEN과 접근성 확인**

Run: `npm run test:unit -- tests/unit/inputs tests/unit/interview/interview-draft.test.ts && npm run test:integration -- tests/integration/interview/input-switching.test.tsx`

Expected: adapter unit and switching integration PASS.

Run: `npm run lint && npm run typecheck && git diff --check`

Expected: exit 0.
