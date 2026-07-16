> [상위 설계](../2026-07-16-design-token-foundation-design.md)

# Color Token Reference

상태: approved. 이 문서는 Figma Color를 CSS Custom Property로 옮기는 승인된 구현 명세다.

## Figma 위치

- [Style Guide / color](https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2009-2601)
- Variable collections: Primitive: Color, Sementic: Color
- Sementic은 Figma 원본 이름의 오탈자이며 코드 이름에는 사용하지 않는다.

## Primitive: Teal

| CSS token | Figma variable | Value |
|---|---|---:|
| --color-teal-100 | Teal/100 | #e5f3f4 |
| --color-teal-200 | Teal/200 | #a1cdcf |
| --color-teal-300 | Teal/300 | #73b3b7 |
| --color-teal-400 | Teal/400 | #449a9f |
| --color-teal-500 | Teal/500 | #158187 |
| --color-teal-600 | Teal/600 | #11676c |
| --color-teal-700 | Teal/700 | #0d4d51 |
| --color-teal-800 | Teal/800 | #083436 |
| --color-teal-900 | Teal/900 | #041a1b |

## Primitive: Neutral

| CSS token | Figma variable | Value |
|---|---|---:|
| --color-white | Sementic: Color/White | #ffffff |
| --color-neutral-100 | Neutral/100 | #fbfbfb |
| --color-neutral-200 | Neutral/200 | #f1f1f2 |
| --color-neutral-300 | Neutral/300 | #c2c4cd |
| --color-neutral-400 | Neutral/400 | #878b9b |
| --color-neutral-500 | Neutral/500 | #7a7e8e |
| --color-neutral-600 | Neutral/600 | #626572 |
| --color-neutral-700 | Neutral/700 | #3f424e |
| --color-neutral-800 | Neutral/800 | #2a2c34 |
| --color-neutral-900 | Neutral/900 | #15161a |

## Primitive: Status extension

| CSS token | Value | Source |
|---|---:|---|
| --color-red-100 | #fff1f0 | 승인된 접근성 확장안 |
| --color-red-700 | #a61b1b | 승인된 접근성 확장안 |
| --color-amber-100 | #fff7e0 | 승인된 접근성 확장안 |
| --color-amber-600 | #a65f00 | 승인된 접근성 확장안 |
| --color-amber-700 | #704000 | 승인된 접근성 확장안 |

Red와 Amber는 Figma 원본에 없으며 사용자가 선택한 최소 확장안이다.

## Semantic: Text

| CSS token | Figma alias | 구현 초안 | 비고 |
|---|---|---|---|
| --color-text-brand | Teal/500 | Teal/500 | 4.64:1 on white |
| --color-text-primary | Neutral/800 | Neutral/800 | 유지 |
| --color-text-secondary | Neutral/600 | Neutral/700 | 계층 보정 제안 |
| --color-text-tertiary | Neutral/700 | Neutral/600 | 계층 보정 제안 |
| --color-text-on-primary | White | White | Teal/600 이상 배경 |
| --color-text-disabled | Neutral/300 | Neutral/300 | 비활성 전용 |
| --color-text-placeholder | Neutral/400 | Neutral/600 | 3.39:1 실패 보정, 승인 완료 |

Figma secondary와 tertiary는 밝기 순서가 뒤집혀 있어 코드에서 alias를 교환한다. 이 변경은 사용자 승인을 받았다.

## Semantic: Background

| CSS token | Alias |
|---|---|
| --color-bg-brand-primary | Teal/500 |
| --color-bg-brand-secondary | Teal/100 |
| --color-bg-brand-disabled | Teal/200 |
| --color-bg-primary | White |
| --color-bg-secondary | Neutral/100 |
| --color-bg-disabled | Neutral/200 |

## Semantic: Border

| CSS token | Figma alias | 구현 초안 | 비고 |
|---|---|---|---|
| --color-border-brand | Teal/500 | Teal/500 | 유지 |
| --color-border-brand-subtle | Teal/200 | Teal/200 | 장식 전용 |
| --color-border-default | Neutral/300 | Neutral/400 | 필수 UI 경계 3:1 보정, 승인 완료 |
| --color-border-secondary | Neutral/600 | Neutral/600 | 유지 |
| --color-border-subtle | Neutral/200 | Neutral/300 | 장식 전용 |

subtle border는 컴포넌트 식별이나 상태 전달에 사용하지 않는다.

## Semantic: Icon

| CSS token | Alias |
|---|---|
| --color-icon-brand | Teal/500 |
| --color-icon-primary | Neutral/800 |
| --color-icon-secondary | Neutral/600 |
| --color-icon-tertiary | Neutral/400 |
| --color-icon-on-primary | White |
| --color-icon-disabled | Neutral/300 |

## Semantic: Status

| 상태 | Background | Text/Icon | Border |
|---|---|---|---|
| Error | Red/100 | Red/700 | Red/700 |
| Warning | Amber/100 | Amber/700 | Amber/600 |
| Success | Teal/100 | Teal/700 | Teal/500 |
| Neutral info | Neutral/100 | Neutral/800 | Neutral/600 |

즉시 위험·문진 중단은 Error, 주의·확인은 Warning, 일반 안내는 Neutral info를 사용한다. 모든 상태는 아이콘·제목·설명 문구를 함께 제공한다.

## 구현 전 승인 항목

승인 완료:

- secondary와 tertiary alias 교환
- placeholder를 Neutral/600으로 강화
- 필수 UI border를 Neutral/400으로 강화
- Red·Amber 신규 primitive 최소 구성

Color 토큰의 구현 전 승인 항목은 모두 완료되었다.
