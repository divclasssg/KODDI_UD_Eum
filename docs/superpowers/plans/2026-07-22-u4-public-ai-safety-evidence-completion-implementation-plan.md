# U4 Public AI Safety, Evidence, and Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 전송에 동의한 공개 사용자가 온보딩부터 실제 MedGemma 질문과 실제 MedGemma 요약을 거쳐 안전하게 문진을 완료 저장하게 한다.

**Architecture:** 기존 U3 pure machine과 IndexedDB version 1 aggregate를 확장한다. Persona 없는 public AI V2 contract, 공통 deterministic validator, AI application repository port를 추가하고 generated question은 기존 V2 question-set snapshot에 append-only로 저장한다. 답변 commit 뒤 AI 대기 상태는 마지막 message pair와 현재 question snapshot으로 복원한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, IndexedDB, Vitest 4, Testing Library, Playwright 1.61, Python/Pydantic Modal runtime

## Global Constraints

- 기준 설계: `docs/superpowers/specs/2026-07-22-u4-public-ai-safety-evidence-completion-design.md`
- 코드 전 Next 문서: server/client components, Route Handlers, `useRouter` 관련 절을 읽는다.
- 새 코드 주석은 한글로 적는다.
- 공개 UI와 V2 payload에 Persona, fixture, 역할극, 이름, 생년월일, profile 전체를 넣지 않는다.
- AI 비동의 manual flow는 외부 AI operation 0회를 유지한다.
- 실제 환자 정보·실제 음성·마이크·STT·사진을 사용하지 않는다.
- IndexedDB version 1과 기존 8개 store를 유지한다.
- Modal actual, GPU, 배포는 사용자의 별도 비용 승인이 있어야 실행한다.
- 사용자 소유 `.gitignore`와 `stash@{0}`를 건드리지 않는다.
- milestone 전에는 관련 test만, 마지막에는 full gate를 한 번 실행한다.
- plan 수행 자체는 commit, push, main merge를 승인하지 않는다.

## Stable Interfaces

```ts
export type AiInterviewContextV2 = {
  version: "2";
  interviewId: string;
  currentSlot?: InterviewSlotId;
  filledSlots: Partial<Record<InterviewSlotId, string>>;
  recentTurns: { id: string; question: string; answer: string }[];
};

export type QuestionValidationResult =
  | { status: "valid"; question: InterviewQuestion }
  | { status: "invalid"; reasons: QuestionSafetyReason[] };

export type EvidenceValidationResult = {
  accepted: InterviewSummary;
  rejectedItemIds: string[];
  usedFallback: boolean;
};

export type AiContinuationSnapshot =
  | { phase: "waiting-for-question"; interview: InterviewIdentity; history: AiTurnSnapshot[] }
  | { phase: "waiting-for-summary"; interview: InterviewIdentity; history: AiTurnSnapshot[] }
  | { phase: "safety-review"; interview: InterviewIdentity; notice: SafetyNoticeSnapshot };
```

## Task Order

| Task | Deliverable | Detailed plan |
|---|---|---|
| 1 | Persona 없는 public AI V2 wire contract | [01-public-ai-contract](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/01-public-ai-contract.md) |
| 2 | 질문 안전·품질 validator | [02-safety-evidence-validators](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/02-safety-evidence-validators.md) |
| 3 | 요약 evidence·contradiction validator | [02-safety-evidence-validators](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/02-safety-evidence-validators.md) |
| 4 | generated question·safety 원자 저장 | [03-storage-and-ai-service](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/03-storage-and-ai-service.md) |
| 5 | public AI service·reload·fallback | [03-storage-and-ai-service](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/03-storage-and-ai-service.md) |
| 6 | U3 pure machine·application effect 확장 | [04-machine-and-public-ui](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/04-machine-and-public-ui.md) |
| 7 | home 분기와 `/interview/ai` 화면 | [04-machine-and-public-ui](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/04-machine-and-public-ui.md) |
| 8 | credential-free E2E와 opt-in actual harness | [05-e2e-docs-and-gates](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/05-e2e-docs-and-gates.md) |
| 9 | 문서 동기화와 milestone gates | [05-e2e-docs-and-gates](./2026-07-22-u4-public-ai-safety-evidence-completion-implementation-plan/05-e2e-docs-and-gates.md) |

## Key File Map

**Create:** `question-safety-validator.ts`, `summary-evidence-validator.ts`, `safety-preflight.ts`, `ai-interview-service.ts`, `ai-interview-application-adapter.ts`, `ai-interview-screen.tsx`, `app/interview/ai/page.tsx`와 대응 tests.

**Modify:** AI contracts/provider/Route/Modal schema·prompt, DB contracts/repository, U3 machine/application service, home screen, E2E·actual config, checklist·worklog.

## Verification Strategy

1. 각 task에서 관련 test file만 RED→GREEN으로 실행한다.
2. 논리 단위 끝에 관련 unit/integration/Modal tests만 실행한다.
3. milestone 끝에 lint, typecheck, 전체 unit, 전체 integration을 병렬로 한 번 실행한다.
4. targeted Chromium 후 최종 통합 지점에서 `npm run test:e2e`를 한 번 실행한다.
5. actual은 별도 승인 후 질문 1회·요약 1회로 시작하고 mock/fallback 증거와 분리한다.

## Definition of Done

- AI 동의 사용자는 onboarding→home→실제 AI 질문→실제 AI summary→review→completed를 통과한다.
- AI 비동의 사용자는 manual flow와 외부 AI 0회를 유지한다.
- unsafe 질문, injection, JSON/HTML, 근거 없는 literal fact와 명백한 contradiction은 표시·저장되지 않는다.
- 위험 신호는 AI 호출보다 먼저 safety-review로 저장되고 사용자 확인 뒤 terminal이 된다.
- reload, stale, reset, 저장 실패가 기존 draft/history를 손상하지 않는다.
- IndexedDB version 1과 8개 store가 유지된다.
- actual 증거는 별도 비용 승인 뒤 통과한 경우에만 완료로 기록한다.
