> [상위 계획](../2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)

# Task 1: Record·질문·Draft V2 Pure 계약

**Files:**
- Create: `src/features/interview/domain/interview-draft.ts`
- Create: `src/features/interview/domain/interview-state.ts`
- Modify: `src/lib/db/contracts.ts`
- Modify: `src/features/interview/manual/manual-question-set.ts`
- Create: `tests/unit/interview/interview-draft.test.ts`
- Modify: `tests/unit/interview/manual-question-set.test.ts`

**Interfaces:**
- Produces: `QuestionSetSnapshotV2`, `QuestionSnapshotV2`, `CommonDraftV2`, `DraftValidationResult`, `validateDraft()`, `createEmptyDraft()`, `switchInputMode()`
- Consumes: existing `UtcTimestamp`, `manual-intake-v1` approved copy

- [ ] **Step 1: 질문 snapshot과 mode별 draft RED 작성**

```ts
it("mode 전환은 다른 mode의 draft를 지우지 않는다", () => {
  const draft = {
    ...createEmptyDraft(SYNTHETIC_SWITCHING_QUESTION),
    activeMode: "text" as const,
    values: {
      ...createEmptyDraft(SYNTHETIC_SWITCHING_QUESTION).values,
      text: { value: "합성 두통" },
      chip: { selectedOptionIds: ["duration-days"] },
    },
  };

  expect(switchInputMode(switchInputMode(draft, "chip"), "text")).toEqual(draft);
});

it("measurement unknown 전환 뒤에도 known 입력을 복구한다", () => {
  const draft = syntheticMeasurementDraft({
    state: "known",
    rawValue: "37.2",
    unitId: "celsius",
    measuredAtLocal: "2026-07-22T10:30",
  });
  const unknown = { ...draft, values: { ...draft.values, measurement: { ...draft.values.measurement, state: "unknown" as const } } };
  expect({ ...unknown.values.measurement, state: "known" }).toEqual(draft.values.measurement);
});
```

- [ ] **Step 2: RED 확인**

Run: `npm run test:unit -- tests/unit/interview/interview-draft.test.ts tests/unit/interview/manual-question-set.test.ts`

Expected: FAIL because domain draft exports and V2 question snapshot are absent.

- [ ] **Step 3: V2 types와 empty/switch pure helper 최소 구현**

```ts
export type CommonDraftV2 = {
  contractVersion: 2;
  questionId: string;
  activeMode: "text" | "choice" | "chip" | "measurement";
  values: {
    text: { value: string };
    choice: { selectedOptionIds: string[] };
    chip: { selectedOptionIds: string[] };
    measurement: {
      state: "empty" | "known" | "unknown";
      rawValue: string;
      unitId: string;
      measuredAtLocal: string;
    };
  };
};

export function switchInputMode(draft: CommonDraftV2, mode: CommonDraftV2["activeMode"]): CommonDraftV2 {
  return { ...structuredClone(draft), activeMode: mode };
}
```

`QuestionSnapshotV2`에는 `contractVersion`, `allowedModes`, `defaultMode`, mode별 contract를 넣는다. `QuestionSetSnapshotV2`는 `manual-intake-v1` ID와 질문 전체 deep snapshot을 가진다.

- [ ] **Step 4: validation RED 작성**

measurement `empty`, invalid decimal, unit allowlist 위반, required measuredAt 누락, unknown 허용/금지와 text/choice/chip allowlist·상호배타를 각각 assertion한다.

```ts
expect(validateDraft(SYNTHETIC_MEASUREMENT_QUESTION, invalidNumberDraft("37,2"))).toMatchObject({
  status: "invalid",
  issues: [{ code: "invalid-number", path: "measurement.value" }],
});
expect(validateDraft(SYNTHETIC_MEASUREMENT_QUESTION, unknownMeasurementDraft())).toEqual({
  status: "valid",
  answer: { mode: "measurement", value: { state: "unknown" } },
});
```

- [ ] **Step 5: pure validation 최소 구현**

raw decimal은 `/^[+-]?(?:\d+\.?\d*|\.\d+)$/`와 `Number.isFinite`를 모두 통과해야 한다. measuredAtLocal은 유효한 local datetime을 clock/timezone adapter 없이 validation하고, application mapper가 UTC로 변환한다. option ID는 snapshot allowlist만 허용한다.

- [ ] **Step 6: manual question V2 snapshot 개정**

`onset`은 `chip + text`, `pattern`은 `choice + text`, `severity`는 `chip + text`, `additional`은 `text + choice`를 허용한다. chief complaint는 text를 유지한다. 공개 measurement와 신규 증상 preset은 추가하지 않는다.

- [ ] **Step 7: GREEN과 정적 확인**

Run: `npm run test:unit -- tests/unit/interview/interview-draft.test.ts tests/unit/interview/manual-question-set.test.ts && npm run typecheck && git diff --check`

Expected: new tests PASS, existing max-five/question-number assertions PASS, typecheck and diff check exit 0.
