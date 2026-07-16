---
title: "Icon System"
date: 2026-07-17
type: design
status: approved
figma: "https://www.figma.com/design/tR3uxRqbnaF6IRUQDg2Fr2/Design-System?node-id=2025-3718"
---

# Icon System

## 목적

Figma Icons 페이지의 아이콘을 React 인라인 SVG 컴포넌트로 구현한다. Figma의 불규칙한 이름과 variant 구조는 코드에 복제하지 않고, 형태 중심의 타입 안전한 API로 정규화한다.

## 승인된 범위

- Figma의 컴포넌트 세트 24개와 단독 Logo를 모두 검토한다.
- 완전히 같은 두 File 세트는 하나로 통합한다.
- 최종 공개 범위는 아이콘 23개와 Logo 1개다.
- regular·bold, outline·filled, Voice 크기 variant를 구현한다.
- Figma node ID와 코드 컴포넌트의 대응표를 유지한다.
- 정적 계약 테스트와 전체 시각 비교를 수행한다.

## 제외 범위

- Figma 원본 이름·variant·컴포넌트 수정
- 문자열 이름을 받는 범용 Icon 컴포넌트
- SVG 자동 생성기와 Figma 자동 동기화
- 외부 아이콘 패키지와 SVGR 의존성
- 아이콘별 SCSS와 신규 전역 component token
- 제품에서 접근 가능한 아이콘 갤러리 경로

## 원본 관리 정책

Figma와 코드는 서로 다른 목적에 맞는 구조를 허용한다. Figma는 시각 원본으로 유지하고 코드는 명시적인 수동 매핑을 사용한다.

- Figma 오탈자·대소문자·중복을 코드에 유지하지 않는다.
- 코드 이름은 화면 역할보다 실제 도형을 설명한다.
- Figma node ID를 변경 추적의 기준으로 사용한다.
- Figma 변경은 자동 반영하지 않고 대응표와 시각 비교를 거쳐 반영한다.

## 코드 구조

```text
src/components/icons/
├── _internal/
│   ├── IconBase.tsx
│   └── icon.types.ts
├── <Name>Icon.tsx
└── index.ts

src/components/brand/
└── Logo.tsx
```

- 아이콘마다 SVG 도형을 소유하는 별도 컴포넌트를 둔다.
- `IconBase`는 공통 SVG 껍데기와 접근성 속성만 담당한다.
- 모든 아이콘은 `index.ts`에서 named export한다.
- Logo는 아이콘 API와 분리한다.
- 클라이언트 상태가 없으므로 `"use client"`를 사용하지 않는다.

## 공개 API

공통 공개 속성은 `className`만 제공한다. React SVG 속성 전체, 임의 `color`, 임의 `size`, `title`, `aria-label`은 노출하지 않는다. ImageAdd의 보조 색상만 CSS 변수로 재정의할 수 있다.

아이콘별 속성은 실제 지원 범위에 한정한다.

```tsx
<ChevronDownIcon weight="bold" />
<ImageAddIcon variant="filled" />
<MicrophoneIcon size={32} />
```

| 역할 | 속성 | 값 | 기본값 |
|---|---|---|---|
| 선 굵기 | `weight` | `regular \| bold` | `regular` |
| Image 형태 | `variant` | `outline \| filled` | `outline` |
| Microphone 크기 | `size` | `24 \| 32` | `24` |

## Figma와 코드 대응표

| Figma | Node ID | 코드 |
|---|---|---|
| Caret_Down_MD | `2009:3567` | `CaretDownIcon` |
| Caret_Up_MD | `2009:3570` | `CaretUpIcon` |
| Chevron_Up | `2009:3579` | `ChevronUpIcon` |
| Chevron_Down | `2009:3576` | `ChevronDownIcon` |
| Chevron_Left_MD | `2009:3573` | `CaretLeftIcon` |
| Arrow | `2009:3582` | `ChevronLeftIcon` |
| Chevron_Right | `2009:3595` | `ChevronRightIcon` |
| Arrow_Up | `2016:2187` | `ArrowUpIcon` |
| Close_LG | `2009:8470` | `CloseIcon` |
| Circle | `2009:8698` | `CircleIcon` |
| Triangle | `2009:8695` | `TriangleIcon` |
| Arrow_Undo_Up_Right | `2009:8718` | `UndoUpRightIcon` |
| Lock_Open | `2009:8732` | `LockOpenIcon` |
| Image | `2009:8744` | `ImageAddIcon` |
| Voice | `2009:8756` | `MicrophoneIcon` |
| File | `2009:8768` | `FileTextIcon` |
| Edit | `2009:8782` | `EditIcon` |
| Edit_pencile | `2009:8796` | `EditPencilIcon` |
| File 중복 | `2016:2201` | `FileTextIcon`으로 통합 |
| Lock | `2016:2215` | `LockIcon` |
| search | `2025:3699` | `SearchIcon` |
| History | `2009:8530` | `ClockIcon` |
| Profile | `2009:8533` | `UserIcon` |
| Home | `2009:8536` | `MessageIcon` |
| Logo | `2009:8683` | `Logo` |

두 File 세트는 regular·bold의 vector path가 각각 완전히 같으므로 하나로 통합한다. 색상만 다른 Navigation variant도 하나의 도형으로 통합한다.

## 도형과 variant 보존

- Figma의 `path`, `viewBox`, `fillRule`, `clipRule`을 보존한다.
- line cap, line join과 1.4px·1.6px·2px 선 굵기를 임의로 통일하지 않는다.
- path가 같은 굵기 variant만 `strokeWidth` 전환으로 공유한다.
- path가 다르면 variant별 path를 각각 보관한다.
- 좌표 반올림과 자동 path 단순화를 하지 않는다.
- 선택·기본 상태가 색상만 다르면 React variant로 만들지 않는다.
- Figma variant 오류가 있으므로 variant 속성 자동 추출에 의존하지 않는다.

## 크기

- 일반 아이콘: `24×24`
- Microphone: `24×24`, `32×32`
- ImageAdd: `30.23×27.06`
- Logo: `48×32`
- 아이콘 버튼의 조작 영역은 소비자가 최소 `48×48`로 제공한다.

ImageAdd의 추가 기호는 Figma에서 텍스트 노드지만, 코드에서는 같은 모양의 SVG path로 변환해 폰트 의존성을 제거한다.

## 색상과 접근성

- 단색 아이콘의 `stroke`와 `fill`은 `currentColor`를 사용한다.
- 소비자는 기존 `--color-icon-*` 의미 토큰으로 `color`를 지정한다.
- ImageAdd filled의 본체는 `currentColor`를 사용한다.
- ImageAdd filled의 세부 도형은 `var(--image-add-detail-color, var(--color-icon-disabled))`를 사용한다.
- `--image-add-detail-color`는 ImageAdd 내부 기본값을 재정의하는 CSS API이며 전역 token으로 선언하지 않는다.
- Logo만 Figma의 고유 색상을 유지한다.
- 아이콘 SVG는 항상 `aria-hidden="true"`, `focusable="false"`다.
- 버튼·링크·상태 메시지가 접근 가능한 이름과 설명을 담당한다.
- SVG에는 `<title>`과 접근성 이름을 추가하지 않는다.
- 상태는 색상만으로 전달하지 않고 제목과 설명을 함께 제공한다.

## 통합 규칙

- 이벤트, 클릭 동작과 UI 상태는 소비자가 담당한다.
- 선택·비활성·오류 상태는 부모 CSS의 `color`로 표현한다.
- `vector-effect`로 선 굵기를 고정하지 않는다.
- 배치 조정은 소비자가 `className`으로 처리한다.
- 지원하지 않는 variant와 크기는 TypeScript에서 차단한다.
- 런타임 문자열 조회와 존재하지 않는 아이콘 fallback은 만들지 않는다.

## 검증

- 예상한 아이콘 23개와 Logo 파일 존재 검사
- public named export 누락 검사
- Figma node ID 대응표의 누락·중복 검사
- `aria-hidden`, `focusable`, `currentColor` 계약 검사
- `<title>`, `aria-label`, 하드코딩 단색 금지 검사
- ImageAdd filled의 보조 CSS 변수와 fallback 계약 검사
- 임시 갤러리에서 전체 variant와 의미 토큰 상속 비교
- Figma Icons 페이지와 방향·형태·선 굵기 시각 비교
- 확대 시 잘림과 흐림 확인 후 임시 갤러리 제거
- `npm run lint`, `npm run typecheck`, `npm run build`

## 구현 전 상태

이 문서는 구현 기준을 확정하며 아이콘 코드는 아직 작성하지 않는다. 구현은 별도 계획 승인 후 시작한다.
