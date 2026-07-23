# U7 Record Profile Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완료 기록 상세에서 현재 프로필을 수정하고 같은 기록으로 돌아오되, 과거 snapshot은 보존하고 이후 문진에만 변경값을 적용한다.

**Architecture:** Next.js 16 page의 Promise `searchParams`에서 raw `returnTo`를 읽고 순수 allowlist 함수로 정규화해 기존 client profile 화면에 전달한다. 프로필 화면은 기준 draft와 현재 draft를 비교해 clean·dirty·discard-confirm·saving·save-error 상태를 관리하며 기존 atomic `ProfileRepository.saveBundle()`을 재사용한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, SCSS Modules, IndexedDB, Vitest, Testing Library, Playwright Chromium

## Global Constraints

- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 과거 `interviews[*].profileSnapshot`은 읽기 전용이며 수정하지 않는다.
- `returnTo`는 `/records/{encodedInterviewId}` 한 단계만 허용한다.
- profile·medical content, record ID, raw database error를 로그에 남기지 않는다.
- 외부 AI·media·STT와 Modal GPU를 호출하지 않는다.
- production code보다 실패하는 focused test를 먼저 작성하고 RED를 확인한다.
- U5 speech, U8 photo, 공유·내보내기는 추가하지 않는다.
- 기존 사용자 소유 `.gitignore` 변경은 stage하거나 수정하지 않는다.

---

## File Map

- Create: `src/features/profile/profile-navigation.ts` — 기록 상세 복귀 경로 정규화
- Modify: `src/app/profile/page.tsx` — Promise `searchParams` 처리
- Modify: `src/features/profile/profile-draft.ts` — draft 변경 감지
- Modify: `src/features/profile/profile-screen.tsx` — 복귀·폐기 확인·비동기 lifecycle
- Modify: `src/features/profile/profile-screen.module.scss` — section·확인 panel·mobile target
- Modify: `src/features/records/record-detail.tsx` — 현재 프로필 수정 진입
- Test: `tests/unit/profile/profile-navigation.test.ts`
- Test: `tests/unit/profile/profile-draft.test.ts`
- Test: `tests/unit/profile/profile-screen.test.tsx`
- Test: `tests/unit/records/record-detail.test.tsx`
- Test: `tests/integration/db/interview-repository.test.ts`
- Modify: `tests/e2e/manual-profile-reset.spec.ts`
- Modify: U7 체크리스트·worklog·README evidence

## Task Index

1. [복귀 경로와 Next.js page 계약](./2026-07-23-u7-record-profile-edit-implementation-plan/01-return-navigation.md)
2. [프로필 draft 변경 감지](./2026-07-23-u7-record-profile-edit-implementation-plan/02-draft-dirty-state.md)
3. [프로필 저장·취소·폐기 확인 화면](./2026-07-23-u7-record-profile-edit-implementation-plan/03-profile-screen-flow.md)
4. [기록 상세 진입과 snapshot 통합 계약](./2026-07-23-u7-record-profile-edit-implementation-plan/04-record-link-and-snapshot.md)
5. [공개 Chromium 경로·문서·최종 gate](./2026-07-23-u7-record-profile-edit-implementation-plan/05-e2e-docs-gates.md)

## Dependency Order

Task 1과 Task 2는 독립적이다. Task 3은 두 task의 interface를 사용한다. Task 4는 Task 1의 URL builder를 사용한다. Task 5는 Task 1~4가 모두 GREEN인 뒤 실행한다.

## Milestone Evidence

- Focused unit: profile navigation, draft, screen, record detail
- Affected integration: consent/profile repository와 interview snapshot
- Targeted Chromium: `manual-profile-reset.spec.ts`
- Final gate: lint, typecheck, full unit, full integration, production build 포함 전체 E2E
- `git diff --check`, 민감정보 로그 scan, `.gitignore` unstaged 보존
