> [상위 계획](../2026-07-20-simulated-voice-input-implementation-plan.md)

### Task 3: 금지 API·E2E·문서 검증

**Files:**
- Modify: `tests/unit/interview/simulated-voice-input.test.tsx`
- Modify: `tests/e2e/interview-layout.spec.ts`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md`
- Modify: `docs/plans/2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md`
- Modify: `docs/worklogs/2026-07-20.md`

- [ ] **Step 1: 금지 브라우저 API 테스트를 작성한다**

`navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `SpeechRecognition`, `webkitSpeechRecognition`, `fetch`를 spy/stub하고 모의 음성 완료까지 모두 0회인지 검증한다. provider 질문 fetch와 혼동하지 않도록 음성 클릭 전후 호출 수 delta를 비교한다.

- [ ] **Step 2: keyboard-only E2E를 추가한다**

Tab으로 모의 음성 버튼에 이동해 Enter, 상태 문구 두 단계, transcript 입력, textarea 수정, `다음` 제출을 수행한다. 단계 번호가 표시되지 않고 실제 브라우저 permission prompt가 없으며 새 질문에 이전 transcript가 섞이지 않는지 검증한다.

- [ ] **Step 3: 실패를 확인하고 필요한 최소 수정만 한다**

Run: `npm run test:unit -- tests/unit/interview/simulated-voice-input.test.tsx && npm run test:e2e -- tests/e2e/interview-layout.spec.ts`

Expected: 새 assertion이 먼저 FAIL한 뒤 component/hook만 수정해 PASS.

- [ ] **Step 4: 체크리스트와 작업일지를 갱신한다**

speech state 완료는 unit+E2E+금지 API 0회 증거가 모두 있을 때만 체크한다. 실제 STT 구현으로 표현하지 않고 “모의 음성 입력”이라고 기록한다. 세 persona 검증을 실제 실행하지 않았다면 해당 항목은 미완료로 둔다.

- [ ] **Step 5: 전체 검증 후 멈춘다**

Run: `git diff --check && npm run lint && npm run typecheck && npm run test:unit && npm run test:e2e && npm run build`

Expected: 모두 PASS. `git status --short`에서 의도한 문서·코드만 검토하고 commit·push하지 않는다.
