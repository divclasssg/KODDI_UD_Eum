# U1 마무리 Gate 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대표 문진 화면의 primary CTA를 상태마다 최대 하나로 고정하고, 합성 Persona의 브라우저 요청이 인증된 Next.js→Modal 경로에서 성공한다는 증거로 U1을 완료한다.

**Architecture:** 기존 화면 컴포넌트가 `data-action-emphasis`와 SCSS variant로 각 행동의 강조 수준을 소유한다. 별도 Playwright actual config는 일반 E2E와 분리해 브라우저 질문 1회만 실행하며, 운영 kill switch 복구를 완료 조건으로 취급한다.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript strict, SCSS modules, Vitest, Testing Library, Playwright Chromium, Modal 1.5.2

## Global Constraints

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 실제 환자 정보·실제 음성·마이크·녹음·STT를 사용하지 않는다.
- 합성 Persona와 비식별 데모 데이터만 사용한다.
- 질문 단계 번호·총 질문 수·고정 진행률을 표시하지 않는다.
- 행동 가능한 상태는 primary CTA가 정확히 하나이고 대기·완료 상태는 0개다.
- 브라우저 actual은 질문 1회만 실행하고 응답 본문·endpoint·credential을 기록하지 않는다.
- 일반 단위·E2E·build는 credential 없이 결정론적으로 통과한다.
- T4 `min_containers=0`, `max_containers=1`, 60초 scale-down과 Workspace `$10` hard cap을 유지한다.
- actual 실행 뒤 kill switch `1`, 인증 503, 실행 container 0을 확인하기 전에는 완료 처리하지 않는다.
- 사용자 요청 전에는 commit·push하지 않는다.

## 승인 기준

- [U1 마무리 gate 설계](../specs/2026-07-21-u1-completion-gates-design.md)
- [대표 문진 화면 설계](../specs/2026-07-19-interview-screen-design.md)
- [Modal 외부 데모 설계](../specs/2026-07-20-modal-medgemma-external-demo-design.md)
- [U1 체크리스트](../../plans/2026-07-16-003-medical-interview-implementation-checklist/02-day-1-u1.md)

## 파일 지도

```text
src/features/interview/components/{response-composer,error-notice,safety-notice}.tsx
src/features/interview/components/{text-input,conversation-viewport}.tsx
src/features/interview/interview-{screen,screen.module}.scss|tsx
tests/unit/interview/interview-primary-action.test.tsx
tests/actual/modal-route.actual.spec.ts
playwright.actual.config.ts
package.json
docs/plans/2026-07-16-003-medical-interview-implementation-checklist*
docs/worklogs/2026-07-21.md
```

## 작업 순서

1. [x] [상태별 primary CTA 계약](./2026-07-21-u1-completion-gates-implementation-plan/01-primary-action-contract.md)
2. [x] [브라우저→Node Route actual gate](./2026-07-21-u1-completion-gates-implementation-plan/02-route-actual-gate.md)
3. [x] [운영 복구·전체 검증·문서 완료](./2026-07-21-u1-completion-gates-implementation-plan/03-verification-and-docs.md)

## 완료 Gate

- 행동 가능한 fixture는 `[data-action-emphasis="primary"]`가 정확히 하나다.
- 대기·완료 fixture는 primary CTA가 없다.
- AI 오류와 긴급 안내의 보조 행동은 secondary로 유지된다.
- 합성 Persona 브라우저 요청이 `/api/ai/question` HTTP 200과 새 질문 화면을 확인한다.
- kill switch `1` 재배포 뒤 인증 503과 실행 container 0을 확인한다.
- `git diff --check`, lint, typecheck, unit, 일반 E2E, build가 통과한다.
- U1 체크리스트가 `1/9 units`와 다음 단계 U2를 사실대로 표시한다.

## 실행 메모

각 task는 실패 테스트를 먼저 확인하고 최소 구현으로 통과시킨다. 외부 상태 변경은 Task 3에서만 수행한다. 계획의 commit 지점은 사용자가 별도로 요청한 경우에만 실행한다.

2026-07-22 첫 actual은 Node guard와 Modal proxy 인증을 통과하고 T4가 합성 질문 17토큰을 생성했지만, Next provider 75초 안에 웹 응답이 반환되지 않아 HTTP 502로 실패했다. 운영 기본·direct cold 기준 75초는 유지하고 browser harness만 기존 provider 상한 85초를 쓰도록 TDD 보정했다. 사용자 승인 뒤 합성 질문 1회 재검증이 58.7초에 HTTP 200과 새 질문 표시를 통과했다. 즉시 kill switch `1` 재배포, 인증 503과 container 0을 확인해 U1을 `1/9`로 완료했다.
