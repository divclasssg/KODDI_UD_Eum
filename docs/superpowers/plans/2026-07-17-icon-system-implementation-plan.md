# Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma Icons 페이지를 타입 안전한 React 인라인 SVG 아이콘 23개와 Logo 1개로 구현하고 한글 사용 주석·계약 테스트·시각 검증을 제공한다.

**Architecture:** 각 공개 아이콘은 자신의 SVG 도형을 별도 파일에서 소유하고 내부 `IconBase`만 공통 SVG 속성을 담당한다. 문자열 레지스트리나 생성기는 두지 않으며 Figma node ID는 승인된 설계 문서와 정적 계약 테스트로 추적한다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, SCSS, Node.js `node:test`, Figma Plugin API

## Global Constraints

- 기준 설계: [Icon System](../specs/2026-07-17-icon-system-design.md)
- 구현 전에 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`를 읽는다.
- Figma 조회 전마다 `figma-use` 스킬과 필수 참조 문서를 읽고 `skillNames: "figma-use"`를 전달한다.
- Figma 원본은 수정하지 않고 `2025:3718` Icons 페이지를 읽기 전용으로 사용한다.
- Figma 오탈자·variant 이름은 코드에 복제하지 않고 승인된 대응표를 따른다.
- 공개 범위는 아이콘 23개와 `Logo` 1개이며 두 File node는 `FileTextIcon` 하나로 통합한다.
- 단색 아이콘은 `currentColor`, ImageAdd filled 세부 도형은 `--image-add-detail-color`, Logo는 원본 고유 색상을 사용한다.
- SVG는 장식 요소이며 `aria-hidden="true"`, `focusable="false"`를 고정한다.
- 임의 `color`, 임의 `size`, `title`, `aria-label`, 전체 SVG 속성 전달을 공개 API로 제공하지 않는다.
- 일반 아이콘은 24px, Microphone은 24·32px, ImageAdd는 30.23×27.06px, Logo는 48×32px다.
- 외부 아이콘 패키지, SVGR, PostCSS, Autoprefixer 의존성을 추가하지 않는다.
- `"use client"`를 추가하지 않는다.
- 코드 주석은 모두 한글로 작성한다.
- 모든 공개 컴포넌트에는 형태·variant·색상 상속·접근성 책임을 설명하는 한글 TSDoc을 작성한다.
- 커밋과 푸시 여부에 대한 실행 시점의 사용자 지시가 이 계획의 커밋 단계보다 우선한다.

## File Structure

```text
src/components/icons/
├── _internal/IconBase.tsx
├── _internal/icon.types.ts
├── ArrowUpIcon.tsx
├── CaretDownIcon.tsx
├── CaretLeftIcon.tsx
├── CaretUpIcon.tsx
├── ChevronDownIcon.tsx
├── ChevronLeftIcon.tsx
├── ChevronRightIcon.tsx
├── ChevronUpIcon.tsx
├── CircleIcon.tsx
├── ClockIcon.tsx
├── CloseIcon.tsx
├── EditIcon.tsx
├── EditPencilIcon.tsx
├── FileTextIcon.tsx
├── ImageAddIcon.tsx
├── LockIcon.tsx
├── LockOpenIcon.tsx
├── MessageIcon.tsx
├── MicrophoneIcon.tsx
├── SearchIcon.tsx
├── TriangleIcon.tsx
├── UndoUpRightIcon.tsx
├── UserIcon.tsx
└── index.ts
src/components/brand/Logo.tsx
tests/icon-contract-helpers.mjs
tests/icon-foundation-contract.test.mjs
tests/icon-directional-contract.test.mjs
tests/icon-action-content-contract.test.mjs
tests/icon-navigation-contract.test.mjs
tests/icon-brand-contract.test.mjs
tests/icon-types.test.tsx
```

## Interface Contract

```ts
type IconProps = Readonly<{ className?: string }>;
type WeightedIconProps = IconProps & Readonly<{
  weight?: "regular" | "bold";
}>;
type ImageAddIconProps = IconProps & Readonly<{
  variant?: "outline" | "filled";
}>;
type MicrophoneIconProps = IconProps & Readonly<{
  size?: 24 | 32;
}>;
```

## Tasks

1. [계약 테스트와 공통 SVG 기반](./2026-07-17-icon-system-implementation-plan/01-contract-and-foundation.md)
2. [방향·기본 도형 아이콘](./2026-07-17-icon-system-implementation-plan/02-directional-shape-icons.md)
3. [동작·콘텐츠 아이콘](./2026-07-17-icon-system-implementation-plan/03-action-content-icons.md)
4. [내비게이션 아이콘](./2026-07-17-icon-system-implementation-plan/04-navigation-icons.md)
5. [Logo와 공개 API 타입 계약](./2026-07-17-icon-system-implementation-plan/05-logo-type-contracts.md)
6. [전체 시각 검증](./2026-07-17-icon-system-implementation-plan/06-visual-verification.md)
7. [문서와 최종 검증 게이트](./2026-07-17-icon-system-implementation-plan/07-docs-final-gate.md)

## Definition of Done

- 23개 아이콘과 Logo가 승인된 이름으로 named export된다.
- regular·bold, outline·filled, 24·32 크기 계약이 TypeScript로 제한된다.
- 모든 공개 컴포넌트의 한글 TSDoc이 IDE 사용법을 설명한다.
- 정적 계약 테스트가 파일·export·주석·접근성·색상 정책을 검증한다.
- 임시 갤러리에서 Figma와 전체 variant를 비교하고 갤러리를 제거한다.
- `npm run test:icons`, `npm run test:tokens`, `npm run lint`, `npm run typecheck`, `npm run build`가 통과한다.
- 체크리스트와 작업일지에 실제 검증 결과를 기록한다.
