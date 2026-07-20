> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [구현 단위 U1~U3](./06-units-u1-u3.md)
> 다음: [구현 단위 U7~U9](./08-units-u7-u9.md)
### U4. Real MedGemma Questions, Safety, and Evidence-Linked Summary

**Goal:** 실제 MedGemma 질문과 S/O 요약을 생성하되 검증된 결과만 표시·저장한다.

**Dependencies:** U2, U3

**Requirements:** R11-R15

**Files:** `src/app/api/ai/question/route.ts`, `src/app/api/ai/summary/route.ts`, `src/lib/ai/provider.ts`, `src/lib/ai/mock-medgemma-adapter.ts`, `src/lib/ai/modal-medgemma-adapter.ts`, `src/lib/ai/prompt.ts`, `src/lib/ai/contracts.ts`, `src/lib/ai/validators.ts`, `src/lib/safety/safety-rules.ts`, `src/lib/safety/safety-copy.ts`, `src/lib/privacy/build-ai-context.ts`, `tests/unit/ai/validators.test.ts`, `tests/unit/ai/route-handler.test.ts`, `tests/actual/modal-medgemma.actual.test.ts`

**Approach:** `AiInterviewContextV1` allowlist context만 전송하고 Route Handler가 unknown field·식별정보·크기 초과를 거절한다. client와 server에서 위험 신호를 이중 검사한다. 시스템 지시와 untrusted 의료 텍스트를 구조적으로 분리하고 출력은 text로만 렌더링한다. 질문은 한 문장·한 의도·쉬운 용어를 검사한다. 요약 항목은 evidence ID를 검증하고 원문과 다른 수치·날짜·단위를 거절한다. 사용자가 요약 초안을 검토·수정·확정하고 transaction이 성공한 뒤에만 completed로 만든다. 오류는 한 번만 재시도한 뒤 manual flow로 전환한다.

**Test Scenarios:**

1. 김영수 fixture에서 짧고 쉬운 질문만 표시된다.
2. 이민정 fixture에서 복문·추상 표현·전문용어 응답을 거절한다.
3. 박성훈 fixture에서 짧은 답변만으로 다음 질문과 요약이 생성된다.
4. 진단, 치료, 복약 지시, 중복 질문, 두 질문 응답을 표시하지 않는다.
5. 위험 신호 fixture는 일반 AI 질문 전에 승인된 안전 안내를 표시한다.
6. 존재하지 않는 evidence ID와 원문에 없는 수치를 포함한 요약을 저장하지 않는다.
7. 401, 403, 429, timeout, invalid JSON이 typed error와 retry/manual action으로 매핑된다.
8. 한국어·영어 prompt injection, JSON 위장, HTML/script, 간접 복약 지시가 명령으로 실행되거나 markup으로 렌더링되지 않는다.
9. 위험 안내 확인 뒤 `StopAndSave` 또는 허용된 `ManualSummary`로 이동하며 뒤로가기·새로고침에도 안전 상태가 유지된다.
10. 요약 확인 전 clinician view가 차단되고, 저장 실패 시 수정 초안이 보존되며 재시도 성공 뒤 completed가 된다.

**Verification:** mock contract, Route Handler integration, actual Modal 세 fixture가 각각 통과한다.

### U5. Voice Input, TTS, and Async Accessibility

**Goal:** 말하기 부담과 읽기 어려움을 줄이면서 음성 기능 실패가 문진을 막지 않게 한다.

**Dependencies:** UI scaffold는 U1, U3; 최종 완료는 U4

**Requirements:** R4, R9-R10, R16

**Files:** `src/features/interview/use-simulated-voice-input.ts`, `src/features/interview/components/simulated-voice-status.tsx`, `src/features/interview/fixtures/persona-voice-fixtures.ts`, `src/features/speech/use-speech-synthesis.ts`, `src/features/speech/speech-button.tsx`, `src/features/interview/question-card.tsx`, `src/features/interview/safety-notice.tsx`, `src/features/summary/summary-card.tsx`, `tests/unit/interview/simulated-voice-input.test.tsx`, `tests/integration/speech/content-controls.test.tsx`, `tests/e2e/speech-controls.spec.ts`

**Approach:** 모의 음성은 마이크 권한·녹음·STT 없이 Persona와 질문 slot의 합성 transcript만 답변 draft에 넣는다. TTS는 화면에 표시된 승인 문장만 읽는다. AI 응답 완료에는 `aria-live`, 오류·안전에는 `role=alert`, 새 질문·요약에는 heading focus를 적용한다.

**Test Scenarios:**

1. 모의 음성 중 마이크·녹음·STT API와 외부 음성 요청이 발생하지 않는다.
2. listening·transcribing 뒤 합성 transcript가 입력되고 명시적 제출 전에는 저장되지 않는다.
3. user click 전 TTS가 재생되지 않고 새 발화 전 기존 발화를 취소한다.
4. navigation, `visibilitychange`, `pagehide`, reset에서 TTS와 모의 음성 timer가 중단된다.
5. 새 질문, 안전 안내, 요약 전환이 screen reader에 알리고 focus를 예측 가능한 위치로 이동한다.
6. hidden prompt와 direct identifier를 읽지 않는다.

**Verification:** hook·component tests, 금지 API 0회와 Chromium keyboard-only smoke가 통과한다.

### U6. Home, Records, and Clinician View

**Goal:** 오늘·과거 기록을 찾고 의료진에게 핵심 결과를 바로 보여 주는 상황 2를 완성한다.

**Dependencies:** UI scaffold는 U1, U2, U3; 최종 완료는 U4

**Requirements:** R17-R18

**Files:** `src/app/home/page.tsx`, `src/app/records/page.tsx`, `src/app/records/[id]/page.tsx`, `src/app/records/[id]/clinician/page.tsx`, `src/features/home/home-screen.tsx`, `src/features/records/record-list.tsx`, `src/features/records/record-detail.tsx`, `src/features/records/clinician-view.tsx`, `src/styles/_records.scss`, `tests/e2e/task-2-clinician-view.spec.ts`

**Approach:** AI 통합을 기다리지 않고 U3 fixture summary로 화면을 먼저 구현한 뒤 U4 completed record에 연결한다. 홈의 핵심 진입은 새 문진과 기록이다. 기록 목록은 `Asia/Seoul` 기준 completed 우선·같은 날 최신순으로 정렬하고 `오늘`, 시각, 상태, 주요 증상으로 식별한다. clinician view는 completed만 허용하고 요약과 안전 문구를 크게 표시하며 편집·설정 내비게이션을 숨긴다.

**Test Scenarios:**

1. 오늘과 과거 기록이 있을 때 오늘 완료 기록을 한 번의 기록 진입 뒤 찾는다.
2. 오늘 완료 기록 없음, 오늘 진행 중만 있음, 오늘 완료 기록 복수, 빈 기록, 로딩, 저장 손상 상태가 설명되고 dead end가 없다.
3. 기록 상세에서 AI/manual 출처와 원문 질문·답변을 확인한다.
4. clinician view에서 요약·안전 문구·원문 보기·닫기만 우선 노출된다.
5. 브라우저 뒤로 가기 뒤 같은 기록과 scroll context로 돌아온다.
6. draft·in-progress 기록은 clinician view에 진입할 수 없다.
7. 세 Persona가 큰 날짜·명시적 상태와 한 단계 흐름으로 Task 2를 완주한다.

**Verification:** 상황 2 Playwright E2E와 393px clinician view 검수가 통과한다.
