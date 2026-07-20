> [상위 계획](../2026-07-20-modal-medgemma-external-demo-implementation-plan.md)

### Task 1: 공유 command·DTO·validator 계약

**Files:**
- Create: `src/features/interview/interview-commands.ts`
- Create: `src/features/interview/model/interview-domain.types.ts`
- Create: `src/lib/ai/contracts.ts`
- Create: `src/lib/ai/validators.ts`
- Create: `src/lib/demo/direct-identifier.ts`
- Modify: `src/features/interview/fixture-interview-commands.ts`
- Modify: `src/features/interview/model/interview-ui.types.ts`
- Modify: `src/features/interview/fixtures/fixture-registry.ts`
- Modify: `src/features/interview/use-interview-controller.ts`
- Test: `tests/unit/ai/contracts.test.ts`
- Test: `tests/unit/demo/direct-identifier.test.ts`

**Interfaces:**

```ts
export const INTERVIEW_SLOT_IDS = [
  "chief-complaint", "onset", "duration", "severity", "pattern",
  "associated-symptoms", "medications", "allergies", "safety",
] as const;
export type InterviewSlotId = (typeof INTERVIEW_SLOT_IDS)[number];
export type DemoPersonaId = "persona-kim" | "persona-lee" | "persona-park";

export type AiInterviewContextV1 = {
  version: "1";
  interviewId: string;
  personaId: DemoPersonaId;
  currentSlot?: InterviewSlotId;
  filledSlots: Partial<Record<InterviewSlotId, string>>;
  recentTurns: { id: string; question: string; answer: string }[];
};

export type AiQuestionResponseV1 =
  | { version: "1"; kind: "question"; question: InterviewQuestion }
  | { version: "1"; kind: "complete" };

export type AiSummaryResponseV1 = {
  version: "1";
  kind: "summary";
  summary: {
    subjective: { id: string; text: string; evidenceTurnIds: string[] }[];
    objective: { id: string; text: string; evidenceTurnIds: string[] }[];
    verificationNeeded: { id: string; text: string; evidenceTurnIds: string[] }[];
  };
};
```

- [ ] **Step 1: 허용/거절 DTO와 식별정보 테스트를 작성한다**

정상 context, unknown field, 잘못된 version/slot, 10개 초과 turn, 존재하지 않는 summary evidence turn ID, 8,192 byte 초과, 전화번호·이메일·주민등록번호·주소/기관 표지어를 table test로 고정한다. 건강 서술 자체를 완전히 판별한다고 주장하지 않는 테스트 이름을 사용한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/ai/contracts.test.ts tests/unit/demo/direct-identifier.test.ts`

Expected: module not found로 FAIL.

- [ ] **Step 3: exact-object validator를 구현한다**

`JSON.parse` 결과가 plain object인지 확인하고 각 단계에서 `Object.keys` allowlist를 비교한다. 문자열은 trim 후 길이를 제한하며 unknown field를 버리지 않고 오류로 처리한다. `parseAiInterviewContextV1`, `parseAiQuestionResponseV1`, `parseAiSummaryResponseV1`는 실패 시 본문을 포함하지 않는 `AiContractError(code)`를 던진다.

- [ ] **Step 4: 직접 식별정보 탐지기를 구현한다**

`findDirectIdentifier(text): "phone" | "email" | "resident-id" | "named-place" | undefined`를 client와 server가 함께 사용한다. 정규식은 값 자체를 반환하거나 로그에 남기지 않는다. 코드 주석은 오탐·미탐 가능성과 실제 건강정보 판별기가 아님을 한글로 적는다.

- [ ] **Step 5: UI 질문·persona와 command port를 공유 계약으로 옮긴다**

slot·persona union은 feature-neutral domain type 파일에 두고 UI와 AI contract가 각각 import해 순환 의존을 피한다. `InterviewQuestion.slot`, `InterviewViewModel.personaId`, `InterviewViewModel.roleplayConfirmed`를 필수 필드로 추가하고 모든 fixture에 명시한다. `InterviewCommandsPort`에 `requestNext`, `requestSummary`, `saveAnswer`, `recordSafetyAction`을 옮기고 controller parameter를 port로 변경한다. fixture adapter의 외부 동작과 counters는 유지한다.

- [ ] **Step 6: 좁은 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/ai tests/unit/demo tests/unit/interview && npm run typecheck`

Expected: 모두 PASS. commit·push하지 않는다.
