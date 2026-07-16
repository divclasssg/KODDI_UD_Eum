> [상위 설계](../2026-07-16-design-token-foundation-design.md)

# Measurement, Radius, Typography Reference

상태: approved. 이 문서는 Figma 수치 토큰을 SCSS로 옮기는 승인된 구현 명세다.

## Figma 위치

- [Style Guide / Spacing](https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2009-3400)
- [Style Guide / Radius](https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2009-3532)
- [Style Guide / Typography](https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2025-3390)
- Collections: Primitive: Measurement, Semantic: Measurement, Primitive: Typo, Semantic: Typo

## Primitive: Measurement

모든 값의 단위는 px이다.

| CSS token | Values |
|---|---|
| --measure-{n} | 0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64 |

실제 변수는 --measure-0부터 --measure-64까지 값별로 하나씩 만든다. primitive는 컴포넌트에서 직접 사용하지 않는다.

## Semantic: Spacing

| CSS token | Primitive alias |
|---|---|
| --space-0 | --measure-0 |
| --space-2 | --measure-2 |
| --space-4 | --measure-4 |
| --space-6 | --measure-6 |
| --space-8 | --measure-8 |
| --space-10 | --measure-10 |
| --space-12 | --measure-12 |
| --space-16 | --measure-16 |
| --space-20 | --measure-20 |
| --space-24 | --measure-24 |
| --space-32 | --measure-32 |
| --space-40 | --measure-40 |
| --space-48 | --measure-48 |
| --space-64 | --measure-64 |

32·40·48·64는 Figma semantic spacing에는 없지만 페이지와 섹션 레이아웃에 필요하므로 spacing으로 노출한다. 이 확장안은 사용자 승인을 받았다.

## Semantic: Radius

| CSS token | Primitive alias | Value |
|---|---|---:|
| --radius-sm | --measure-2 | 2px |
| --radius-md | --measure-4 | 4px |
| --radius-lg | --measure-8 | 8px |
| --radius-xl | --measure-12 | 12px |
| --radius-2xl | --measure-16 | 16px |
| --radius-rounded | 직접값 | 9999px |

rounded는 Figma와 동일하게 9999px로 유지한다.

## Semantic: Sizing

Figma에 없는 의미 이름이지만 U1 접근성 계약을 표현하기 위해 alias만 추가한다.

| CSS token | Alias | 용도 |
|---|---|---|
| --size-touch-target-min | --measure-48 | 최소 포인터 조작 영역 |
| --size-control-min-height | --measure-48 | 버튼·입력 최소 높이 |

48px보다 작은 시각 아이콘은 최소 48px 조작 영역 안에 배치한다. 48px 기준과 두 sizing alias는 사용자 승인을 받았다.

## Primitive: Typography

| Category | Values |
|---|---|
| Font family | Pretendard Variable |
| Font weight | 400, 500, 600 |
| Font size | 12, 14, 16, 18, 20, 22, 24, 28px |
| Line-height source | 22, 24, 26, 28, 30, 34, 38, 46px |
| Letter spacing | 0 |

Figma line-height source는 기록만 보존하고 코드에서는 아래 단위 없는 semantic 비율을 사용한다. 이 비율은 사용자 승인을 받았다.

## Semantic: Typography

| CSS 역할 | Size | Weight options | Line-height |
|---|---:|---|---:|
| --type-h1-* | 28px | 400, 500, 600 | 1.35 |
| --type-h2-* | 24px | 400, 500, 600 | 1.4 |
| --type-sub-01-* | 22px | 400, 500, 600 | 1.45 |
| --type-sub-02-* | 20px | 400, 500, 600 | 1.45 |
| --type-body-01-* | 18px | 400, 500, 600 | 1.6 |
| --type-body-02-* | 16px | 400, 500, 600 | 1.6 |
| --type-caption-01-* | 14px | 400, 500, 600 | 1.5 |
| --type-caption-02-* | 12px | 400, 500, 600 | 1.5 |

각 역할의 실제 Custom Property는 font-size, font-weight, line-height를 분리한다. 예시는 --type-body-01-size, --type-body-01-line-height이다.

## Pretendard

- source: orioncactus/pretendard v1.3.9
- asset: PretendardVariable.woff2
- loading: Next.js next/font/local, display swap
- runtime weights: 400, 500, 600
- fallback: system-ui, Apple SD Gothic Neo, Noto Sans KR, Malgun Gothic, sans-serif
- CDN과 GitHub main을 런타임에서 호출하지 않는다.

폰트 파일과 SIL Open Font License는 구현 커밋에 함께 포함한다.

## 현재 코드와의 차이

현재 globals.scss에는 Arial과 다크 모드 media query가 남아 있다. 구현 시 Pretendard fallback stack으로 교체하고 다크 모드 분기를 제거한다.

## 구현 전 승인 항목

승인 완료:

- spacing 32·40·48·64를 spacing으로 노출
- 최소 조작 영역과 컨트롤 높이를 48px로 적용
- 역할별 단위 없는 line-height 적용
- Pretendard 자체 호스팅과 fallback 순서

Measurement·Radius·Typography 토큰의 구현 전 승인 항목은 모두 완료되었다.
