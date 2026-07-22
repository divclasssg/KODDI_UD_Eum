# U2 Onboarding and Home Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 제품 형태의 온보딩에서 동의와 최소 프로필을 원자적으로 IndexedDB에 저장하고, 저장된 상태와 AI 동의에 맞는 홈을 복원한다.

**Architecture:** `/onboarding`은 IO를 모르는 reducer와 validation 위에 client screen을 둔다. 저장은 세 store를 한 transaction으로 다루는 `OnboardingRepository`만 호출하며, `/`와 `/home`은 별도 bootstrap 함수로 기존 database 상태를 읽는다. 공개 UI에는 Persona나 fixture 선택·주입 계약을 만들지 않는다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, native IndexedDB, SCSS modules, Vitest 4, Testing Library, fake-indexeddb, Playwright 1.61

## Global Constraints

- 코드 작성 전 Next.js 16.2.10의 client/server component, navigation, `use client` 문서를 읽는다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 공개 데모는 실제 제품 흐름으로 만들고 Persona 선택 또는 Persona 주입 기능을 추가하지 않는다.
- 테스트에는 합성·비식별 fixture만 사용하며 실제 환자 정보·실제 음성·마이크·STT를 사용하지 않는다.
- 질문 단계 번호와 고정 진행률을 표시하지 않는다.
- Modal actual, 배포, GPU 호출을 실행하지 않는다.
- credential 값이나 실제 payload를 출력·문서화·커밋하지 않는다.
- 사용자 소유의 root `.gitignore`와 `stash@{0}`을 건드리지 않는다.
- 별도 요청 전 commit, push, main 병합을 하지 않는다.
- 프로필 수정, reset UI, 실제 manual question set 실행은 후속 슬라이스다.

## File Map

- `src/lib/db/onboarding-repository.ts`: consent와 두 profile record의 원자적 완료 저장
- `src/lib/db/database-presence.ts`: database를 생성하지 않는 존재 확인
- `src/features/onboarding/*`: 순수 전이, validation, 실제 제품형 온보딩 UI
- `src/features/home/*`: consent/profile 기반 홈 bootstrap과 표현
- `src/app/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/home/page.tsx`: 공개 route
- `tests/integration/db/onboarding-repository.test.ts`: transaction과 rollback
- `tests/unit/onboarding/*`, `tests/unit/home/*`: 상태·화면 계약
- `tests/e2e/onboarding-home.spec.ts`: 합성 데이터 browser flow

## Task Index

1. [Repository와 순수 상태 머신](./2026-07-22-u2-onboarding-home-integration-plan/01-repository-and-machine.md)
2. [초기 진입과 온보딩 UI](./2026-07-22-u2-onboarding-home-integration-plan/02-entry-and-onboarding-ui.md)
3. [홈, E2E, 문서와 검증](./2026-07-22-u2-onboarding-home-integration-plan/03-home-e2e-and-verification.md)

## Acceptance Summary

- 로컬 저장 거부 시 IndexedDB open과 write가 0회다.
- consent, profile, medical profile은 한 transaction으로만 완료된다.
- 이전 화면 복귀 시 메모리 draft가 보존되고 새로고침 전에는 동의 전 기록을 남기지 않는다.
- AI 거부는 외부 요청 0건이며 홈에서 수동 경로만 기본 행동으로 보인다.
- 새로고침 뒤 저장된 홈을 복원한다.
- 공개 UI와 URL에 Persona 선택·주입 계약이 없다.
- manual 실행, profile 수정, reset UI는 완료로 표시하지 않는다.

## Self-Review

- 설계의 실제 제품형 공개 흐름, 동의 쓰기 경계, 원자적 저장, 복원, 접근성, 합성 E2E를 세 상세 문서의 Task 1~6에 대응했다.
- 타입 이름은 `CompleteOnboardingInputV1`, `OnboardingRepository.complete`, `OnboardingDraft`, `HomeState`로 통일했다.
- 문진 버튼을 기존 역할극 demo로 연결하지 않고 `준비 중`으로 표시해 구현 범위를 과장하지 않는다.
