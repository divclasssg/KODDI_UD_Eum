# Representative Interview Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 393×852 고정 iPhone 프레임 안에서 전체 문진 대화, 질문·입력, 명시적 제출, 9개 결정론적 상태 fixture를 제공하는 `/interview/new`를 구현한다.

**Architecture:** App Router page는 async `searchParams`와 서버 전용 flag로 fixture ID를 검증하고 직렬화 가능한 초기 모델만 Client Component에 전달한다. Client 화면은 실제 상태와 같은 reducer·command interface를 사용하며 fixture adapter만 저장·AI 결과를 결정론적으로 반환한다. SCSS Module과 기존 의미 토큰·아이콘을 사용하고 제공된 PNG를 `next/image` 장식 오버레이로 렌더링한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript strict, SCSS Modules, Pretendard Variable, Vitest, Testing Library, Playwright Chromium

## Global Constraints

- 작업 폴더는 `/Users/seikpark/Desktop/projects/KODDI_UD_Eum`이다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 앱 화면은 393×852 고정이며 반응형·320px reflow를 구현하지 않는다.
- iPhone 17 프레임과 iOS 상태바를 항상 표시한다.
- 다크 모드, Effect Style, Grid Style, iOS 소프트웨어 키보드 모사는 제외한다.
- SCSS와 기존 semantic token만 사용하고 Tailwind를 추가하지 않는다.
- Next.js 기본 Autoprefixer를 유지하며 `postcss`, `autoprefixer`, 별도 PostCSS 설정을 추가하지 않는다.
- 자체 호스팅 Pretendard와 기존 아이콘 컴포넌트를 사용한다.
- fixture는 `INTERVIEW_FIXTURE_MODE=1`과 allowlist query가 모두 있을 때만 활성화한다.
- fixture는 실제 IndexedDB, MedGemma, 전화, 외부 공유를 호출하지 않는다.
- 구현 완료 전 lint, typecheck, unit, E2E, build를 검증한다.
- 사용자가 별도로 요청하기 전까지 commit과 push를 실행하지 않는다.

## Approved Sources

- [최종 프로토타입 필수 UI 목록](../specs/2026-07-19-final-prototype-ui-inventory.md)
- [대표 문진 화면 설계](../specs/2026-07-19-interview-screen-design.md)
- [대표 문진 상태 fixture 설계](../specs/2026-07-19-interview-state-fixture-design.md)
- [디자인 토큰 구현 명세](../specs/2026-07-16-design-token-foundation-design.md)
- [아이콘 시스템 설계](../specs/2026-07-17-icon-system-design.md)

## Next.js 16.2.10 적용 메모

- page의 `searchParams`는 Promise이므로 Server Component에서 반드시 `await`한다.
- `searchParams` 사용은 request-time dynamic rendering을 선택한다.
- 서버 전용 env는 `NEXT_PUBLIC_` 접두사 없이 page에서만 읽고 Client Component에 boolean을 넘기지 않는다.
- 상호작용·브라우저 API가 필요한 `InterviewScreen` 경계에만 `"use client"`를 둔다.
- 로컬 PNG는 `public` 경로와 명시적 1350×2760 크기로 `next/image`에 전달한다.
- Playwright는 production build와 `webServer`로 실행한다.

## Planned File Map

```text
public/device-frames/iphone-17-black-portrait.png
src/app/interview/new/page.tsx
src/app/interview/new/page.module.scss
src/features/interview/model/interview-ui.types.ts
src/features/interview/fixtures/{fixture.types,fixture-registry,resolve-fixture}.ts
src/features/interview/components/{device-preview,ios-status-bar,interview-header}.tsx
src/features/interview/components/{conversation-viewport,conversation-turn,question-card}.tsx
src/features/interview/components/{response-composer,choice-input,text-input,async-status}.tsx
src/features/interview/interview-route-screen.tsx
src/features/interview/interview-screen.tsx
src/features/interview/interview-screen.module.scss
src/features/interview/use-interview-controller.ts
src/features/interview/fixture-interview-commands.ts
tests/unit/interview/*.test.tsx
tests/e2e/interview-layout.spec.ts
```

## Task Index

1. [x] [테스트 기반과 실행 계약](./2026-07-19-interview-screen-implementation-plan/01-test-foundation.md)
2. [x] [상태 모델과 fixture registry](./2026-07-19-interview-screen-implementation-plan/02-fixture-contract.md)
3. [x] [고정 디바이스 프레임과 상단 셸](./2026-07-19-interview-screen-implementation-plan/03-device-shell.md)
4. [x] [대화·질문·입력 화면](./2026-07-19-interview-screen-implementation-plan/04-conversation-input.md)
5. [x] [비동기·오류·안전 전환](./2026-07-19-interview-screen-implementation-plan/05-state-transitions.md)
6. [x] [시각·접근성 E2E와 문서](./2026-07-19-interview-screen-implementation-plan/06-verification-docs.md)

## Completion Gate

- 9개 fixture 직접 진입과 승인 전환이 모두 동작한다.
- 저장 명령 1회 후에만 AI 명령이 실행되고 실패 시 draft·확정 답변이 보존된다.
- 393×852 앱 viewport와 프레임 정렬이 Figma 대표 node와 일치한다.
- keyboard-only, live status, focus, 48px 조작 영역이 통과한다.
- 실제 브라우저 200% 확대에서 바깥·내부 scroll로 모든 조작에 접근한다.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`가 통과한다.

## Execution Note

각 task 끝에는 diff와 테스트 결과만 검토한다. 사용자 요청 전에는 계획의 어느 단계에서도 commit·push하지 않는다.
