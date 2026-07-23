# Task 1 · Public AI V2 Wire Contract

> [상위 계획](../2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan.md)

## Files

- Modify: `src/lib/ai/contracts.ts`, `validators.ts`, `provider.ts`, `modal-medgemma-adapter.ts`, `mock-medgemma-adapter.ts`, `prompt.ts`
- Modify: `src/lib/demo/request-guards.ts`
- Modify: `inference/modal_medgemma/schemas.py`, `prompts.py`, `medgemma_app.py`
- Test: `tests/unit/ai/contracts.test.ts`, `route-handler.test.ts`, `modal-medgemma-adapter.test.ts`
- Test: `tests/modal/test_schemas.py`, `test_prompts.py`, `test_runtime_contracts.py`

**Produces:** `AiInterviewContextV1 | AiInterviewContextV2`를 명시적으로 파싱하는 Route/provider contract와 V2 public prompt.

- [ ] **Step 1: Next.js 경계 문서를 읽는다**

```text
node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md
```

Route Handler는 Node runtime·server-only provider를 유지하고 client에는 직렬화 가능한 public contract만 전달한다.

- [ ] **Step 2: V2 RED를 작성한다**

```ts
expect(parseAiInterviewContext({
  version: "2",
  interviewId: "ai-public-001",
  filledSlots: { "chief-complaint": "두통" },
  recentTurns: [],
})).toMatchObject({ version: "2", interviewId: "ai-public-001" });

expect(() => parseAiInterviewContext({
  version: "2",
  interviewId: "ai-public-001",
  personaId: "persona-kim",
  filledSlots: {},
  recentTurns: [],
})).toThrowError(expect.objectContaining({ code: "unknown-field" }));
```

Python에는 V2의 `personaId`, `displayName`, `birthDate`가 `extra_forbidden`인 table test를 추가한다. V1 request에 V2 response 또는 반대 조합도 거절한다.

- [ ] **Step 3: RED를 확인한다**

```bash
npx vitest run tests/unit/ai/contracts.test.ts tests/unit/ai/route-handler.test.ts tests/unit/ai/modal-medgemma-adapter.test.ts
.venv/bin/python -m pytest tests/modal/test_schemas.py tests/modal/test_prompts.py tests/modal/test_runtime_contracts.py -q
```

Expected: V2 parser/schema/public prompt 부재로 FAIL.

- [ ] **Step 4: discriminated union을 구현한다**

```ts
export const AI_PUBLIC_CONTRACT_VERSION = "2" as const;

export type AiInterviewContextV2 = {
  version: typeof AI_PUBLIC_CONTRACT_VERSION;
  interviewId: string;
  currentSlot?: InterviewSlotId;
  filledSlots: Partial<Record<InterviewSlotId, string>>;
  recentTurns: { id: string; question: string; answer: string }[];
};

export type AiInterviewContext = AiInterviewContextV1 | AiInterviewContextV2;
```

`parseAiInterviewContext()`는 `version`만 먼저 읽고 V1/V2 parser로 분기한다. V2는 Persona/profile 필드를 허용하지 않는다. provider와 Modal envelope는 union을 받고 response parser는 request version과 같은 version만 허용한다.

- [ ] **Step 5: public prompt를 분리한다**

```ts
export function getPromptPolicy(kind: AiPromptKind, version: "1" | "2") {
  return version === "1"
    ? SYNTHETIC_PERSONA_POLICIES[kind]
    : PUBLIC_INTERVIEW_POLICIES[kind];
}
```

V2 question policy는 공개 문진 보조, 한 문장, 한 의도, 쉬운 한국어, 진단·치료·복약 지시 금지를 요구한다. summary policy는 evidence ID와 원문 수치·날짜·단위 보존을 요구한다.

- [ ] **Step 6: request guard와 provider를 연결한다**

- `hasDirectIdentifier`는 V1/V2 공통 answer·filled slot만 검사한다.
- Modal schema는 version별 context model을 discriminated union으로 둔다.
- raw provider error, prompt, payload는 response/log에 넣지 않는다.
- mock adapter는 요청 version과 같은 response version을 반환한다.

- [ ] **Step 7: GREEN을 확인한다**

Step 3의 두 명령을 재실행한다.

Expected: TypeScript/Python 관련 tests PASS, V1 actual harness contract 유지.

- [ ] **Step 8: checkpoint를 기록한다**

사용자가 commit을 요청한 경우에만:

```bash
git add src/lib/ai src/lib/demo/request-guards.ts inference/modal_medgemma tests/unit/ai tests/modal
git commit -m "feat(ai): add persona-free public interview contract"
```
