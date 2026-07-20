> [상위 계획](../2026-07-19-interview-screen-implementation-plan.md)

### Task 4: 대화·질문·입력 화면

**Files:**
- Create: `src/features/interview/components/conversation-viewport.tsx`
- Create: `src/features/interview/components/conversation-turn.tsx`
- Create: `src/features/interview/components/question-card.tsx`
- Create: `src/features/interview/components/choice-input.tsx`
- Create: `src/features/interview/components/text-input.tsx`
- Create: `src/features/interview/components/response-composer.tsx`
- Create: `src/features/interview/interview-screen.tsx`
- Create: `src/features/interview/interview-screen.module.scss`
- Create: `tests/unit/interview/interview-screen.test.tsx`

**Interfaces:**
- Consumes: `InterviewViewModel`, `MicrophoneIcon`, `ArrowUpIcon`
- Produces: `InterviewScreen({ initialModel, commands })`, `InterviewCommands.submit(draft)`

- [x] **Step 1: 실패하는 기본 화면 테스트를 작성한다**

```tsx
it("전체 기록과 현재 질문을 표시하고 명시적으로 제출한다", async () => {
  const submit = vi.fn();
  render(<InterviewScreen initialModel={INTERVIEW_FIXTURES["answering-default"].model} commands={{ submit }} />);
  expect(screen.getByRole("log", { name: "문진 대화" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "증상이 시작된 지 얼마나 지났나요?" })).toBeVisible();
  expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  await userEvent.click(screen.getByRole("radio", { name: "며칠에 걸침" }));
  await userEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(submit).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/interview-screen.test.tsx`

Expected: `InterviewScreen` module not found로 FAIL.

- [x] **Step 3: 컴포넌트 계약을 구현한다**

```ts
export type InterviewCommands = {
  submit(draft: InterviewDraft): Promise<void> | void;
};
```

`ConversationViewport`는 `role="log"`, `aria-label="문진 대화"`와 history turn 전체를 가진다. `QuestionCard`는 현재 질문을 `h1`으로 표시한다. `ChoiceInput`은 single이면 radio, multiple이면 checkbox를 사용한다. `TextInput`과 음성 버튼은 같은 draft를 수정하며 음성 fixture는 텍스트 입력 경로만 사용한다.

- [x] **Step 4: ResponseComposer를 구현한다**

`selectedOptionIds` 또는 trim한 text가 있을 때만 `다음`을 활성화한다. 선택형에서도 text와 음성 입력을 항상 유지하며 입력 방식 전환은 기존 draft를 지우지 않는다. submit 중에는 모든 입력과 버튼을 잠근다.

- [x] **Step 5: 고정 화면 SCSS를 구현한다**

좌우 16px, 말풍선 최대 337px, 대화 간격 24px, 응답 폭 361px, 조작 높이 최소 48px을 적용한다. 질문·답변·의료 선택지는 `--type-body-01-*`, 보조 문구는 `--type-body-02-*`를 사용한다. 응답 영역 높이를 `scroll-padding-bottom`에 반영한다.

- [x] **Step 6: 초안 보존과 중복 제출 테스트를 추가한다**

선택 후 text 입력, text 수정, `다음` 빠른 두 번 클릭을 수행하고 선택·text가 함께 전달되며 `submit`은 1회임을 assertion한다.

- [x] **Step 7: 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/interview/interview-screen.test.tsx && npm run lint && npm run typecheck`

Expected: 모두 PASS. commit·push는 하지 않는다.
