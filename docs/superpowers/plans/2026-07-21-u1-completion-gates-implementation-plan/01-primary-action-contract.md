> [상위 계획](../2026-07-21-u1-completion-gates-implementation-plan.md)

### Task 1: 상태별 primary CTA 계약

**Files:**
- Create: `tests/unit/interview/interview-primary-action.test.tsx`
- Modify: `src/features/interview/interview-screen.tsx`
- Modify: `src/features/interview/components/response-composer.tsx`
- Modify: `src/features/interview/components/error-notice.tsx`
- Modify: `src/features/interview/components/safety-notice.tsx`
- Modify: `src/features/interview/components/text-input.tsx`
- Modify: `src/features/interview/components/conversation-viewport.tsx`
- Modify: `src/features/interview/interview-screen.module.scss`

**Interfaces:**
- Consumes: `InterviewViewModel.state`, 기존 notice callback, fixture registry
- Produces: DOM 계약 `data-action-emphasis="primary|secondary|utility"`, `ResponseComposer.submitEmphasis: "primary" | "secondary"`

- [x] **Step 1: primary 수와 보조 행동의 실패 테스트를 작성한다**

`tests/unit/interview/interview-primary-action.test.tsx`에 fixture별 계약을 추가한다.

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createFixtureInterviewCommands } from "@/features/interview/fixture-interview-commands";
import { INTERVIEW_FIXTURES } from "@/features/interview/fixtures/fixture-registry";
import { InterviewControllerScreen } from "@/features/interview/interview-route-screen";

afterEach(cleanup);

function renderFixture(id: keyof typeof INTERVIEW_FIXTURES) {
  return render(
    <InterviewControllerScreen
      commands={createFixtureInterviewCommands(id)}
      initialModel={INTERVIEW_FIXTURES[id].model}
    />,
  );
}

describe("문진 핵심 행동 강조", () => {
  for (const id of [
    "answering-default",
    "history-review",
    "save-error",
    "ai-error",
    "safety-caution",
    "safety-urgent",
  ] as const) {
    it(`${id}에는 primary CTA가 하나다`, () => {
      const { container } = renderFixture(id);
      expect(
        container.querySelectorAll('[data-action-emphasis="primary"]'),
      ).toHaveLength(1);
    });
  }

  for (const id of [
    "saving-delayed",
    "waiting-for-ai",
    "summary-transition",
  ] as const) {
    it(`${id}에는 primary CTA가 없다`, () => {
      const { container } = renderFixture(id);
      expect(
        container.querySelectorAll('[data-action-emphasis="primary"]'),
      ).toHaveLength(0);
    });
  }
});
```

AI 오류의 `수동 문진으로 계속`과 긴급 안내의 두 보조 행동이 `secondary`, 음성·최신 이동이 `utility`인지 이름으로 찾는 assertion도 같은 파일에 추가한다.

- [x] **Step 2: RED를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/interview-primary-action.test.tsx`

Expected: 현재 버튼에 `data-action-emphasis`가 없어 행동 가능한 fixture의 개수 assertion이 `0`으로 FAIL.

- [x] **Step 3: 최소 강조 계약을 구현한다**

`InterviewScreen`은 답변 상태에서만 submit을 primary로 전달한다.

```tsx
submitEmphasis={
  initialModel.state === "answering" ? "primary" : "secondary"
}
```

이 prop을 기존 `ResponseComposer` 호출에 추가하고 다른 명시 props는 유지한다. `ResponseComposer`의 submit button, notice button, 음성 button, 최신 이동 button에 각각 literal `data-action-emphasis`를 지정한다. AI 오류는 retry만 primary, 긴급 안내는 119만 primary다.

notice 스타일은 공통 button 규칙 뒤에 다음 variant를 둔다.

```scss
.notice-primary-action {
  color: var(--color-text-on-primary);
  background: var(--color-bg-brand-primary);
  border-color: var(--color-border-brand);
}

.notice-secondary-action {
  color: inherit;
  background: var(--color-bg-primary);
}
```

- [x] **Step 4: GREEN과 기존 전환 회귀를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/interview-primary-action.test.tsx tests/unit/interview/interview-transitions.test.tsx tests/unit/interview/interview-screen.test.tsx`

Expected: 신규 primary 계약과 기존 클릭·focus·전환 테스트 모두 PASS.

- [x] **Step 5: 정적 검증을 실행한다**

Run: `npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: 사용자 요청이 있을 때만 커밋한다**

```text
git add src/features/interview tests/unit/interview/interview-primary-action.test.tsx
git commit -m "fix(interview): enforce one primary action per state"
```
