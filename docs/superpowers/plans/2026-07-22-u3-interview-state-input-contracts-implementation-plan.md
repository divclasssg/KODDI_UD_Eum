# U3 Interview State and Input Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** 구현 완료 — 전체 검증 결과는 체크리스트와 작업일지에 기록한다.

**Goal:** 공개 manual 문진을 pure state machine과 versioned common draft에 연결해 chip·measurement·mode switching·reload 복원·stale response 폐기를 검증한다.

**Architecture:** UI는 domain event만 dispatch하고 application service가 machine effect를 repository/router/runtime ports에 실행한다. IndexedDB database version 1과 기존 8 stores/index는 유지하며 interview/draft record V1을 읽고 신규 V2 payload로 점진 정규화한다. requestId는 UI effect identity, revision은 durable concurrency token, runtime generation은 reset/consent invalidation token으로 분리한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript strict, SCSS Modules, IndexedDB, Vitest 4.1.10, Testing Library, Playwright Chromium

## Global Constraints

- 기준 commit은 `2f69911ad97f8feb277bd236d03cf7037064cc7b`이다.
- 작업 브랜치는 `codex/u3-interview-state-input-contracts`이고 격리 worktree에서만 작업한다.
- database 이름 `koddi-ud-eum`, database version `1`, 기존 8개 object store와 index를 유지한다.
- 공개 사용자 흐름에 Persona, fixture ID, 역할극 확인을 노출하지 않는다.
- 만 14세 미만은 사용할 수 없다.
- 질문 단계 번호, 전체 질문 수, 고정 진행률을 표시하지 않는다.
- 실제 환자 정보나 실제 payload를 사용하지 않고 합성·비식별 fixture만 사용한다.
- 실제 음성, 마이크, STT, 사진 upload, 외부 AI operation을 구현하거나 호출하지 않는다.
- AI 동의 거부 manual flow의 application factory에는 AI/media port를 주입하지 않는다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 구현 전 관련 `node_modules/next/dist/docs/`의 Server/Client Component, navigation, Vitest, Playwright 문서를 다시 확인한다.
- root `.gitignore`와 `stash@{0}: codex-transfer-u1-plans`를 수정·stage·stash·apply·drop·폐기하지 않는다.
- 기존 `.worktrees/modal-contracts`를 사용하지 않는다.
- 별도 요청 전 commit, push, main merge를 하지 않는다.
- Modal actual, 배포, GPU 호출, credential 출력은 금지한다.

---

## File Map

- `src/features/interview/domain/interview-machine.ts`: pure state/event/effect transition
- `src/features/interview/domain/interview-state.ts`: domain state와 operation token
- `src/features/interview/domain/interview-draft.ts`: V2 common draft와 pure validation
- `src/features/interview/application/interview-application-service.ts`: effect runner와 직렬 write lane
- `src/features/interview/application/interview-ports.ts`: repository/router/runtime 및 후속 AI/media port 경계
- `src/features/interview/application/interview-record-mapper.ts`: DB V1/V2와 domain snapshot 변환
- `src/features/inputs/input-switcher.tsx`: 허용 input mode 전환
- `src/features/inputs/text-input.tsx`: text adapter
- `src/features/inputs/choice-input.tsx`: choice adapter
- `src/features/inputs/chip-input.tsx`: symptom/duration/severity chip adapter
- `src/features/inputs/measurement-input.tsx`: known/unknown measurement adapter
- `src/features/interview/manual/manual-question-set.ts`: V2 question-set snapshot과 승인된 공개 mode
- `src/features/interview/manual/manual-interview-screen.tsx`: machine state renderer와 event dispatch
- `src/lib/db/contracts.ts`: Interview/Draft V2 record types
- `src/lib/db/interview-repository.ts`: V1/V2 parser, `persistDraft`, snapshot invariant
- `tests/unit/interview/interview-machine.test.ts`: pure transition matrix
- `tests/unit/interview/interview-draft.test.ts`: input validation
- `tests/unit/interview/interview-application-service.test.ts`: effect runner stale/serialization
- `tests/unit/inputs/*.test.tsx`: adapter accessibility와 보존
- `tests/integration/interview/input-switching.test.tsx`: UI→service→machine→fake port
- `tests/integration/db/interview-repository.test.ts`: V1/V2, revision, immutable snapshot
- `tests/integration/db/reset-revision-guard.test.ts`: reset late response/write
- `tests/e2e/manual-profile-reset.spec.ts`: 공개 chip switching·reload·AI/media 0건
- 체크리스트, `docs/README.md`, 작업일지: 실제 검증 결과 동기화

## Task Index

1. [Record·질문·draft V2 pure 계약](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/01-versioned-draft-contracts.md)
2. [Pure domain machine](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/02-pure-domain-machine.md)
3. [IndexedDB V1/V2 repository와 revision guard](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/03-repository-versioning-and-guards.md)
4. [Application service·ports·stale 폐기](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/04-application-service-and-stale-results.md)
5. [Input adapters와 switching integration](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/05-input-adapters-and-switching.md)
6. [Manual 공개 화면 연결](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/06-manual-screen-integration.md)
7. [E2E·문서·전체 gate](./2026-07-22-u3-interview-state-input-contracts-implementation-plan/07-e2e-docs-and-full-gates.md)

## 승인 시 고정할 선택

- 권장 Gate 1: 공개 증상 preset chip은 의료 콘텐츠 승인 전 추가하지 않고 기간·강도만 기존 문구로 chip 전환한다.
- 권장 Gate 2: measurement는 공통 component·integration fixture까지 구현하고 공개 manual 질문에는 임의 항목을 추가하지 않는다.
- 위 권장안이 아닌 대안을 선택하면 Task 5·6의 question fixture와 공개 E2E assertion을 승인된 문구로 먼저 개정한다.

## Execution Gate

사용자 승인 뒤 Task 1의 RED부터 시작한다. 각 task 끝에 관련 test와 `git diff --check`를 실행하고 결과를 보고하지만 stage·commit하지 않는다. 실패한 baseline이나 새 차단이 발견되면 다음 task로 넘어가기 전에 원인과 선택지를 보고한다.
