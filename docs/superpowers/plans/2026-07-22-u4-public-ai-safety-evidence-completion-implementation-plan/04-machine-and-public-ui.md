# Tasks 6–7 · Machine and Public UI

> [상위 계획](../2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan.md)

## Task 6: Pure Machine and Application Effects

**Files:** modify U3 `interview-machine.ts`, `interview-application-service.ts`와 tests; create `ai-interview-application-adapter.ts`와 test.

**Produces:** exact token을 가진 `waiting-for-question`, `waiting-for-summary`, `safety-review`, `safety-stopped` states/effects.

- [ ] **Step 1: machine RED를 작성한다**

```ts
expect(transitionInterview(submitting, {
  type: "SUBMIT_SUCCEEDED",
  token: submitToken,
  snapshot: waitingForQuestion,
  continuationToken: aiToken,
})).toMatchObject({
  state: { phase: "waiting-for-question", operation: aiToken },
  effects: [{ kind: "request-ai-question", token: aiToken }],
});
```

question complete→waiting summary, summary success→review, urgent→safety-review, allowed action→safety-stopped, stale success/failure 무시, reset/dispose 무시, AI 대기 중 navigation 차단을 검증한다.

- [ ] **Step 2: application effect RED를 작성한다**

```ts
requestAiQuestion(input: {
  token: OperationToken;
  history: AiTurnSnapshot[];
}): Promise<SessionSnapshot | AiContinuationSnapshot>;

requestAiSummary(input: {
  token: OperationToken;
  history: AiTurnSnapshot[];
}): Promise<SessionSnapshot>;

acknowledgeSafety(input: {
  token: OperationToken;
  action: "call-119" | "show-to-bystander" | "view-summary";
}): Promise<void>;
```

- [ ] **Step 3: RED를 확인한다**

```bash
npx vitest run tests/unit/interview/interview-machine.test.ts tests/unit/interview/interview-application-service.test.ts tests/unit/interview/ai-interview-application-adapter.test.ts
```

Expected: 신규 states/effects/adapter 부재로 FAIL.

- [ ] **Step 4: transition과 effect runner를 구현한다**

application service가 새 request ID의 `continuationToken`을 event에 넣는다. machine은 이전 token이 exact match일 때만 다음 AI effect를 낸다. `SAFETY_ACTION_REQUESTED`는 세 action만 허용한다. adapter는 AbortController를 runtime coordinator에 등록하고 dispose/reset에서 abort한다.

- [ ] **Step 5: manual regression을 확인한다**

```bash
npx vitest run tests/unit/interview/manual-interview-application-adapter.test.ts tests/unit/interview/manual-interview-service.test.ts tests/unit/interview/interview-machine.test.ts tests/unit/interview/interview-application-service.test.ts
```

Expected: manual flow PASS, 외부 AI call 0회.

## Task 7: Public Home and AI Screen

**Files:** modify home screen/styles/test; create `ai-interview-screen.tsx`, styles, unit test, `src/app/interview/ai/page.tsx`.

**Produces:** onboarding consent에서 이어지는 Persona 없는 public AI UX.

- [ ] **Step 1: home 분기 RED를 작성한다**

```ts
expect(screen.getByRole("button", { name: "AI 문진 시작하기" })).toBeEnabled();
await user.click(screen.getByRole("button", { name: "AI 문진 시작하기" }));
expect(navigate).toHaveBeenCalledWith("/interview/ai");
```

declined는 manual만 주 행동이며 `/interview/ai` navigation이 없다. Persona·fixture·역할극 text도 없다.

- [ ] **Step 2: screen state RED를 작성한다**

- answering: 질문/input/`답변 저장`
- waiting-for-question: `다음 질문을 준비하고 있어요`, input locked
- waiting-for-summary: `문진 내용을 정리하고 있어요`, input locked
- review: AI summary와 `문진 저장 완료`
- fallback review: deterministic 정리 안내
- safety-review: 기존 승인 문구와 세 허용 action만 표시
- completed/safety-stopped: terminal navigation만 표시
- completion failure: review와 retry 유지

- [ ] **Step 3: RED를 확인한다**

```bash
npx vitest run tests/unit/home/home-screen.test.tsx tests/unit/interview/ai-interview-screen.test.tsx
```

Expected: AI button/route/screen 부재로 FAIL.

- [ ] **Step 4: route와 UI를 구현한다**

server `page.tsx`는 `PUBLIC_AI_MAX_FOLLOW_UPS`를 1..3으로 읽어 client screen prop에 전달하고 기본 3을 사용한다. browser factory는 manual `withRepository` pattern에 V2 HTTP client와 AI adapter를 주입한다. `useRouter`는 client component에서만 사용한다.

- [ ] **Step 5: accessibility와 primary action을 GREEN으로 만든다**

Step 3 명령을 재실행한다. busy, role, disabled, primary action assertions가 모두 PASS해야 한다.

- [ ] **Step 6: checkpoints를 기록한다**

별도 승인 시 `feat(interview): orchestrate AI continuation states`, `feat(interview): expose public AI journey` commit을 만든다.
