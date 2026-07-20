> [상위 계획](../2026-07-20-simulated-voice-input-implementation-plan.md)

### Task 2: 상태 hook과 접근 가능한 UI

**Files:**
- Create: `src/features/interview/use-simulated-voice-input.ts`
- Create: `src/features/interview/components/simulated-voice-status.tsx`
- Modify: `src/features/interview/components/text-input.tsx`
- Modify: `src/features/interview/components/response-composer.tsx`
- Modify: `src/features/interview/interview-screen.tsx`
- Modify: `src/features/interview/interview-screen.module.scss`
- Test: `tests/unit/interview/simulated-voice-input.test.tsx`

**State contract:**

```ts
export type SimulatedVoiceState =
  | { phase: "idle" }
  | { phase: "listening"; message: "듣고 있어요" }
  | { phase: "transcribing"; message: "말씀을 글자로 바꾸고 있어요" }
  | { phase: "ready"; message: "가상 인물의 답변을 입력했어요" }
  | { phase: "unavailable"; message: "이 질문은 직접 입력해 주세요" };
```

- [ ] **Step 1: fake timer 상태 테스트를 작성한다**

클릭 직후 listening, 900ms 뒤 transcribing, 추가 700ms 뒤 textarea transcript와 ready를 검증한다. `commands.submit`은 0회이며 사용자가 `다음`을 누른 뒤에만 1회다. 진행 중 재클릭은 timer를 추가하지 않는다.

- [ ] **Step 2: cleanup과 fallback 테스트를 작성한다**

질문 ID 변경·unmount 뒤 timer를 진행해도 이전 transcript가 생기지 않아야 한다. fixture가 없으면 unavailable 후 text mode로 돌아가며 textarea는 유지한다. 사용자가 transcript를 수정하면 수정값이 제출된다.

- [ ] **Step 3: 실패를 확인한다**

Run: `npm run test:unit -- tests/unit/interview/simulated-voice-input.test.tsx`

Expected: hook/component not found와 기존 즉시 voice mode 동작으로 FAIL.

- [ ] **Step 4: timer hook을 구현한다**

hook은 question ID·persona ID·slot을 입력받고 `start`, `cancel`, `state`를 반환한다. 두 timeout ID를 ref에 보관해 중복 시작을 무시하고 dependency 변경·unmount에서 모두 clear한다. ready 직전에 현재 request token을 비교해 stale transcript를 버린다.

- [ ] **Step 5: UI를 연결한다**

마이크 버튼 accessible name은 `모의 음성 입력 시작, 실제로 녹음하지 않음`으로 한다. listening/transcribing 중 `aria-pressed=true`, `aria-disabled=true`로 중복 동작을 막는다. `SimulatedVoiceStatus`는 `role=status`, `aria-live=polite`, `aria-atomic=true`를 사용한다.

textarea 근처에는 항상 `실제 음성을 녹음하지 않으며 가상 인물의 예시 답변을 입력합니다.`를 표시한다. ready 때 textarea로 focus를 옮기고 전체 text를 강제 선택하지 않는다.

- [ ] **Step 6: SCSS state를 구현한다**

기존 semantic token만 사용해 활성 버튼, 16px spinner, 상태 문구를 추가한다. 버튼 hit area는 48×48을 유지하고 `prefers-reduced-motion: reduce`에서는 spinner 회전만 제거한다. 시간 기반 상태 의미는 그대로 유지한다.

- [ ] **Step 7: 좁은 검증 후 멈춘다**

Run: `npm run test:unit -- tests/unit/interview && npm run lint && npm run typecheck`

Expected: 모두 PASS. commit·push하지 않는다.
