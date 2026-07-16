---
title: "Design Token Foundation"
date: 2026-07-16
type: design
status: review
figma: "https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2009-2592"
---

# Design Token Foundation

## 목적

Figma Design System을 U1의 SCSS 토큰 원천으로 사용한다. 단일 라이트 모드에서 의료 취약군이 읽기 쉬운 타이포그래피와 상태 표현을 제공하고, 코드에서는 primitive를 직접 소비하지 않고 semantic token을 통해 사용한다.

## 승인된 범위

- Figma의 color, measurement, spacing, radius, typography를 코드 토큰으로 변환한다.
- 기존 Teal과 Neutral은 성공·브랜드·일반 UI에 유지한다.
- 오류와 경고에 필요한 Red·Amber primitive만 최소 추가한다.
- line-height는 단위 없는 비율로 정의한다.
- Pretendard Variable을 프로젝트에서 자체 호스팅한다.
- class name은 기존 결정대로 하이픈 스타일을 사용한다.

## 제외 범위

- 다크 모드와 prefers-color-scheme 토큰
- Effect Style, shadow, elevation token
- Grid Style과 breakpoint token
- 별도 Info Blue와 Success Green
- Figma 원본 변수·스타일 수정

제외 항목은 필요가 생길 때 별도 설계 변경으로 추가한다.

## 토큰 계층

1. Primitive: 원본 색상·수치·폰트 값
2. Semantic: text, background, border, icon, spacing, radius, typography 역할
3. Component: 대표 문진 화면에서 공통 semantic 조합만 alias

컴포넌트는 primitive를 직접 참조하지 않는다. component token은 두 개 이상의 소비자가 있거나 상태별 교체가 필요한 경우에만 만든다.

### 이름 규칙

CSS Custom Property는 소문자 하이픈 형식을 사용한다.

- Primitive 예: --color-teal-500, --space-16
- Semantic 예: --color-text-primary, --color-bg-error
- Component 예: --interview-alert-background

Figma의 Sementic, secondeary, teritray 오탈자는 코드에서 각각 semantic, secondary, tertiary로 정규화하고 매핑 근거를 남긴다.

## 상태 색상

### 신규 primitive

| Token | Value | 용도 |
|---|---:|---|
| --color-red-100 | #fff1f0 | error 배경 |
| --color-red-700 | #a61b1b | error 텍스트·아이콘·테두리 |
| --color-amber-100 | #fff7e0 | warning 배경 |
| --color-amber-600 | #a65f00 | warning 테두리 |
| --color-amber-700 | #704000 | warning 텍스트·아이콘 |

### Semantic alias

| 상태 | Background | Text/Icon | Border |
|---|---|---|---|
| Error | Red 100 | Red 700 | Red 700 |
| Warning | Amber 100 | Amber 700 | Amber 600 |
| Success | Teal 100 | Teal 700 | Teal 500 |
| Neutral info | Neutral 100 | Neutral 800 | Neutral 600 |

의료 안전 상태는 별도 hue를 만들지 않고 심각도에 따라 alias한다.

- 즉시 도움·문진 중단: Error
- 주의·확인 필요: Warning
- 일반 안내: Neutral info

각 상태는 색상 외에 아이콘, 상태 제목, 설명 문구를 함께 제공한다. 동적 오류·안전 안내는 적절한 live region을 사용하되 같은 메시지를 반복 발표하지 않는다.

### 검증 대비

- Red 700 / Red 100: 6.83:1
- Amber 700 / Amber 100: 8.10:1
- Teal 700 / Teal 100: 8.40:1
- Neutral 800 / Neutral 100: 13.45:1

일반 텍스트는 4.5:1 이상, 의미 있는 아이콘·경계는 인접 배경과 3:1 이상을 유지한다.

## Typography

Pretendard를 사용하며 line-height는 em 길이 대신 상속에 안전한 단위 없는 값으로 정의한다.

| 역할 | Font size | Line-height |
|---|---:|---:|
| H1 | 28px | 1.35 |
| H2 | 24px | 1.4 |
| Sub heading 01 | 22px | 1.45 |
| Sub heading 02 | 20px | 1.45 |
| Body 01 | 18px | 1.6 |
| Body 02 | 16px | 1.6 |
| Caption 01 | 14px | 1.5 |
| Caption 02 | 12px | 1.5 |
| Button·input label | 역할별 크기 | 1.4~1.5 |

Figma Body01의 weight별 38px·26px·46px line-height 차이는 코드에서 1.6으로 통일한다. 레이아웃은 사용자가 line-height를 1.5 이상으로 덮어써도 콘텐츠나 기능이 잘리지 않아야 한다.

## Pretendard 공급

- 공식 orioncactus/pretendard v1.3.9를 원천으로 사용한다.
- PretendardVariable.woff2와 라이선스를 프로젝트에 고정한다.
- Next.js next/font/local로 자체 호스팅하고 display: swap을 사용한다.
- 가변 폰트 범위는 공식 안내대로 지정하되 UI에서 사용하는 굵기는 400, 500, 600으로 제한한다.
- CDN과 GitHub main 브랜치를 런타임 의존성으로 사용하지 않는다.

## 구현 경계

- 토큰 partial은 primitive, semantic, typography, component 책임으로 분리한다.
- 전역 SCSS는 token entrypoint만 불러오고 원시값을 반복 선언하지 않는다.
- 대표 문진 화면은 semantic 또는 필요한 component alias만 사용한다.
- 스타일 구현은 별도 구현 계획 승인 뒤 시작한다.

## 검증

- Sass compile, lint, typecheck, production build
- 토큰 이름·alias snapshot 또는 정적 검사
- 텍스트와 상태 조합의 WCAG 대비 검사
- 393px에서 line-height 1.5·letter spacing 0.12em·word spacing 0.16em override 시 잘림 없음
- 오류·경고·성공·안전을 grayscale에서도 아이콘·제목·문구로 구별
- Pretendard 실패 시 fallback font에서도 레이아웃과 기능 유지

## 근거

- [Figma Design System](https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2009-2592)
- [WCAG 2.2 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing)
- [WCAG 2.2 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [WCAG 2.2 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [Pretendard official repository](https://github.com/orioncactus/pretendard)
