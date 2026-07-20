> [상위 계획](../2026-07-20-modal-medgemma-external-demo-implementation-plan.md)

### Task 4: 실제 화면 연결과 fallback

**Files:**
- Create: `src/features/interview/http-interview-commands.ts`
- Create: `src/features/interview/components/roleplay-confirmation.tsx`
- Create: `src/features/interview/components/generated-summary.tsx`
- Modify: `src/features/interview/model/interview-ui.types.ts`
- Modify: `src/features/interview/fixtures/fixture-registry.ts`
- Modify: `src/features/interview/interview-route-screen.tsx`
- Modify: `src/features/interview/use-interview-controller.ts`
- Modify: `src/app/interview/new/page.tsx`
- Test: `tests/unit/interview/http-interview-commands.test.ts`
- Test: `tests/unit/interview/interview-transitions.test.tsx`

**UI model additions:**

```ts
export type InterviewQuestion = {
  id: string;
  slot: InterviewSlotId;
  text: string;
  selection: "single" | "multiple";
  options: { id: string; label: string }[];
};

export type InterviewViewModel = {
  personaId: DemoPersonaId;
  roleplayConfirmed: boolean;
  // 기존 필드 유지
};
```

- [ ] **Step 1: HTTP command와 전환 테스트를 작성한다**

fixture mode에서는 네트워크 0회, demo mode에서는 답변 저장 완료 뒤 `/api/ai/question` 1회, complete 뒤 `/api/ai/summary` 1회, 역할극 미확인 시 0회, abort/stale 응답 폐기, provider 실패 시 기존 history를 유지한 manual question·결정론적 summary 전환을 검증한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/http-interview-commands.test.ts tests/unit/interview/interview-transitions.test.tsx`

Expected: HTTP command 및 새 model field 부재로 FAIL.

- [ ] **Step 3: 질문 slot과 persona를 fixture 전체에 채운다**

현재 duration 질문은 `duration`, continuity 질문은 `pattern`, 안전 질문은 `safety`를 사용한다. 세 persona ID는 fixture와 actual context에서 같은 union을 공유한다. 알 수 없는 모델 slot은 validator에서 거절하며 UI가 임의 추론하지 않는다.

- [ ] **Step 4: HTTP commands를 구현한다**

`saveAnswer`는 현재 controller history에 확정 turn을 한 번 추가하고, `requestNext`와 `requestSummary`는 최소 context를 구성해 각 Route Handler를 호출한다. `AbortController`를 요청마다 생성하고 navigation/unmount/reset에서 abort한다. client는 식별정보 탐지 실패 시 fetch 전에 수정 안내용 typed error를 던진다. summary evidence ID가 현재 history에 없으면 표시하지 않는다.

- [ ] **Step 5: demo와 fixture adapter를 분리 연결한다**

page는 fixture query가 허용된 경우에만 fixture adapter를 선택하고, 일반 `/interview/new`에서는 HTTP adapter를 선택한다. `persona=kim|lee|park`를 allowlist로 해석하고 생략하면 `kim`, 알 수 없는 값은 404로 처리한다. `MEDGEMMA_ACTUAL_DISABLED=1` 또는 provider 오류일 때 저장된 답변을 유지하고 기존 `continueManually()` 경로를 보여 준다.

- [ ] **Step 6: 역할극·비진단 고지를 연결한다**

actual 요청 전에 `roleplayConfirmed`가 참이어야 한다. composer 앞에 `가상 인물로 체험하며 실제 정보를 입력하지 않겠습니다` checkbox를 두고 확인 전 입력·제출을 잠근다. 시작 영역과 자유 입력 가까이에 “가상 인물의 입장에서만 답하고 실제 개인정보·건강정보를 입력하지 마세요”를 표시한다. fixture는 확인 여부를 fixture model에 명시하고 자동으로 상태를 추론하지 않는다.

`GeneratedSummary`는 `주관적 정보`, `객관적 정보`, `확인이 필요한 정보` 세 heading과 plain text item만 렌더링한다. provider summary 실패 시 같은 history로 만든 versioned deterministic summary를 표시하며 raw provider 오류는 보여 주지 않는다.

- [ ] **Step 7: 좁은 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/interview tests/unit/ai tests/unit/demo && npm run lint && npm run typecheck`

Expected: 모두 PASS. commit·push하지 않는다.
