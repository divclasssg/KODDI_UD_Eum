> [상위 계획](../2026-07-19-interview-screen-implementation-plan.md)

### Task 2: 상태 모델과 fixture registry

**Files:**
- Create: `src/features/interview/model/interview-ui.types.ts`
- Create: `src/features/interview/fixtures/fixture.types.ts`
- Create: `src/features/interview/fixtures/fixture-registry.ts`
- Create: `src/features/interview/fixtures/resolve-fixture.ts`
- Create: `tests/unit/interview/fixture-registry.test.ts`

**Interfaces:**
- Produces: `InterviewUiState`, `InterviewViewModel`, `InterviewFixtureId`, `INTERVIEW_FIXTURES`, `resolveFixtureId(raw, enabled)`
- Consumers: Task 4의 화면과 Task 5의 controller·page

- [x] **Step 1: 실패하는 allowlist 테스트를 작성한다**

```ts
import { describe, expect, it } from "vitest";
import { resolveFixtureId } from "@/features/interview/fixtures/resolve-fixture";

describe("fixture ID 해석", () => {
  it("서버 flag가 없으면 query를 거절한다", () => {
    expect(resolveFixtureId("save-error", false)).toEqual({ ok: false });
  });

  it("allowlist ID만 허용한다", () => {
    expect(resolveFixtureId("save-error", true)).toEqual({ ok: true, id: "save-error" });
    expect(resolveFixtureId("../../secret", true)).toEqual({ ok: false });
    expect(resolveFixtureId(["save-error"], true)).toEqual({ ok: false });
  });
});
```

- [x] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm run test:unit -- tests/unit/interview/fixture-registry.test.ts`

Expected: module not found로 FAIL.

- [x] **Step 3: 화면 상태 타입을 작성한다**

```ts
export type InterviewUiState =
  | "answering" | "saving" | "waiting-for-ai" | "save-error"
  | "ai-error" | "caution" | "urgent" | "summary-transition" | "safe-ended";

export type InterviewTurn = { id: string; question: string; answer: string };
export type InterviewQuestion = {
  id: string;
  text: string;
  selection: "single" | "multiple";
  options: { id: string; label: string }[];
};
export type InterviewDraft = { selectedOptionIds: string[]; text: string; inputMode: "choice" | "text" | "voice" };
export type InterviewViewModel = {
  interviewId: string;
  state: InterviewUiState;
  history: InterviewTurn[];
  question?: InterviewQuestion;
  draft: InterviewDraft;
};
```

- [x] **Step 4: 9개 fixture ID와 공통 데이터 registry를 작성한다**

```ts
export const INTERVIEW_FIXTURE_IDS = [
  "answering-default", "history-review", "saving-delayed", "waiting-for-ai",
  "save-error", "ai-error", "safety-caution", "safety-urgent", "summary-transition",
] as const;

export type InterviewFixtureId = (typeof INTERVIEW_FIXTURE_IDS)[number];
```

`INTERVIEW_FIXTURES`는 승인 명세의 공통 질문·답변, 상태 문구, 예상 focus·role·busy·action을 9개 ID 각각에 명시한다. `history-review`만 5개 turn을 사용한다.

- [x] **Step 5: 순수 allowlist resolver를 구현한다**

```ts
export function resolveFixtureId(raw: string | string[] | undefined, enabled: boolean) {
  if (!enabled || typeof raw !== "string") return { ok: false } as const;
  return INTERVIEW_FIXTURE_IDS.includes(raw as InterviewFixtureId)
    ? ({ ok: true, id: raw as InterviewFixtureId } as const)
    : ({ ok: false } as const);
}
```

- [x] **Step 6: 전체 registry 계약을 검증한다**

테스트에 ID 9개, 실제 정의 9개, 실제 식별정보·질문 번호 필드 부재 assertion을 추가한다.

Run: `npm run test:unit -- tests/unit/interview/fixture-registry.test.ts`

Expected: fixture tests PASS.

- [x] **Step 7: 정적 검증 후 멈춘다**

Run: `npm run lint && npm run typecheck`

Expected: 종료 코드 0. commit·push는 하지 않는다.
