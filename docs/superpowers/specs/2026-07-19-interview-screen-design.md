---
title: "Representative Interview Screen"
date: 2026-07-19
type: design
status: approved
figma: "https://www.figma.com/design/8HVgkA1i3ujI5Eg2kNSI68/Prototype?node-id=538-5661"
---

# 대표 문진 화면 설계

## 목적

`/interview/new`에서 Figma의 모바일 문진 화면을 재현하면서 전체 대화 확인, 명시적 답변 제출, 질문별 복구 가능한 저장, 비동기·안전 상태 접근성을 제공한다. 이 문서는 질문 카드·입력·동작 상태·주요 행동의 구현 계약이며 상태별 fixture 데이터는 후속 단계에서 정의한다.

## 승인 결정

- 전체 문진 대화는 하나의 스크롤 영역에서 확인할 수 있다.
- 기본 시각 우선순위는 직전 답변 1개와 현재 질문에 둔다.
- 모든 답변은 선택·작성 후 `다음`을 눌러 명시적으로 제출한다.
- 질문 수가 가변적이므로 번호, 단계, 진행률 막대를 표시하지 않는다.
- 선택형 질문에도 선택지와 텍스트·음성 자유 입력을 함께 제공한다.
- 확정 답변은 질문마다 `다음`을 누를 때 IndexedDB에 한 번 저장한다.
- 화면은 반응형으로 만들지 않고 393×852 고정 앱 화면으로 제공한다.
- 제공된 iPhone 17 프레임과 웹으로 구현한 iOS 상태바를 항상 표시한다.

## Figma 기준

| 역할 | Figma node | 구현 기준 |
|---|---|---|
| 입력 방식 선택 | Chat_01_Entry `173:2872` | 음성·텍스트·증상 선택 진입 |
| 선택형 질문 | Chat_04 `173:2916` | 이전 답변, 현재 질문, 다중 선택, `다음` |
| 기간 질문 | Chat_06 `173:3122` | 단일 선택과 자유 입력 |
| 예·아니오 질문 | Chat_08 `173:3008`, Chat_09 `173:3040` | 예·아니오·모르겠음 |
| 통증 강도 | Chat_10 `173:3072` | 단계 선택 |
| 전체 문진 범위 | [필수 UI 목록](./2026-07-19-final-prototype-ui-inventory.md) | 후속 상태의 시각 참조 |

Figma의 React·Tailwind 출력은 참고만 한다. 구현은 Next.js·TypeScript·SCSS, 기존 의미 토큰과 아이콘 컴포넌트에 맞춘다. 42dot Sans와 임시 원격 SVG는 사용하지 않는다.

## 고정 디바이스 프레임

제공 자산:

- 원본: `/Users/seikpark/Desktop/frames/iphone17/iPhone 17/iPhone 17 - Black - Portrait.png`
- 크기: 1350×2760 PNG, alpha 포함
- SHA-256: `d764eef3dea74910c02ad1c0cef2da6150964c422e1ccc16bb63f75cb8a03dde`
- 투명 화면 개구부: 약 1206×2622로 393×852 화면 비율과 거의 일치

구현 시 원본을 프로젝트 정적 자산으로 복사하고 변형하지 않는다. `DevicePreview`는 약 440×900 고정 외곽을 가지며 `AppViewport` 393×852와 PNG 오버레이를 중앙 정렬한다. 정확한 inset은 브라우저 캡처로 보정한다.

`DeviceFrameOverlay`는 `pointer-events: none`이고 대체 텍스트 없는 장식 이미지다. `AppViewport`는 투명 개구부에 맞춰 둥글게 자르며 PNG의 Dynamic Island와 카메라는 앱 위에 표시된다.

## 화면 구조

```text
DevicePreview
├── AppViewport (393×852)
│   ├── IOSStatusBar (48)
│   ├── InterviewHeader (62)
│   └── InterviewScreen
│       ├── ConversationViewport
│       │   ├── ConversationTurn*
│       │   └── QuestionCard
│       ├── JumpToLatestButton
│       ├── AsyncStatus
│       └── ResponseComposer
│           ├── ChoiceInput
│           ├── TextInput + VoiceInput
│           └── PrimaryAction
└── DeviceFrameOverlay
```

- `DevicePreview`: 고정 프레임과 앱의 좌표·겹침만 담당한다.
- `IOSStatusBar`: `9:41`, 통신·Wi-Fi·배터리를 장식으로 표시한다.
- `InterviewScreen`: 현재 질문, 초안, 제출 상태를 조합한다.
- `ConversationViewport`: 전체 확정 대화를 시간순으로 스크롤한다.
- `ConversationTurn`: 과거 질문과 확정 답변을 표시한다.
- `QuestionCard`: 현재 질문 하나만 강조한다.
- `ResponseComposer`: 질문 유형별 선택지와 공용 자유 입력을 조합한다.
- `PrimaryAction`: 모든 입력을 `다음`으로 제출한다.
- `AsyncStatus`: 저장·AI·오류·안전·요약 전환만 알린다.
- `JumpToLatestButton`: 과거 내용을 읽는 사용자에게 최신 질문 복귀를 제공한다.

## 시각 계약

- 상태바 48px와 헤더 62px을 합친 110px 상단 구조를 유지한다.
- 대화 영역 좌우 여백은 16px, 말풍선 최대 폭은 337px, 대화 간격은 24px이다.
- 이전 답변은 브랜드 보조 배경, 현재 질문은 중립 배경·테두리를 사용한다.
- 응답 영역은 화면 하단에 고정하고 대화 영역에 같은 높이의 scroll padding을 둔다.
- 선택지와 주요 행동은 사용 가능 폭 361px을 채우고 최소 높이 48px을 유지한다.
- 선택 상태는 색상뿐 아니라 체크 표시와 텍스트 관계로 전달한다.
- `다음`은 유효한 답변이 없을 때 비활성화하고 이유를 보조 문장으로 표시한다.
- 질문·답변·의료 선택지는 18px 이상, 보조 제어 문구는 16px 이상이다.
- 모든 앱 텍스트는 자체 호스팅 Pretendard와 승인된 typography token을 사용한다.
- 상태바 시스템 문자는 장식 예외이며 앱의 읽기 크기 기준에 포함하지 않는다.

## 토큰 매핑

| UI | 배경 | 텍스트·아이콘 | 테두리·형태 |
|---|---|---|---|
| 현재 질문 | `--color-bg-secondary` | `--color-text-primary` | `--color-border-default`, `--radius-xl` |
| 확정 답변 | `--color-bg-brand-secondary` | `--color-text-secondary` | `--radius-xl` |
| 기본 선택지 | `--color-bg-primary` | `--color-text-primary` | `--color-border-brand`, `--radius-lg` |
| 선택된 선택지 | `--color-bg-brand-secondary` | `--color-text-primary` | `--color-border-brand`, `--radius-lg` |
| 자유 입력 | `--color-bg-secondary` | `--color-text-primary` | `--color-border-default`, `--radius-rounded` |
| 주요 행동 | `--color-bg-brand-primary` | `--color-text-on-primary` | `--radius-lg` |
| 비활성 행동 | `--color-bg-disabled` | `--color-text-disabled` | `--radius-lg` |
| 오류·안전 | 기존 error·warning·info semantic 묶음 | 같은 상태의 text·icon | 같은 상태의 border |

간격·크기·글꼴은 기존 `--space-*`, `--size-touch-target-min`, `--type-*` token만 소비한다. 두 개 이상의 소비자가 같은 상태 교체 조합을 공유하는 것이 구현에서 확인될 때만 component token을 추가한다.

## 원본과 확장 UI 소유 범위

Figma가 소유하는 시각 기준은 상태바·헤더·말풍선·선택지·입력·주요 행동의 배치와 형태다. 코드는 Figma node 이름과 임시 컴포넌트 구조를 복제하지 않고 이 시각 의도를 기존 token과 아이콘으로 번역한다.

제품 요구사항이 소유하는 확장 범위는 전체 대화 스크롤, 조건부 자동 이동, 최신 질문 복귀, 질문별 저장, 저장·AI 오류, 안전 안내, 요약 전환, focus·live status다. 확장 UI는 Figma 원본으로 표시하지 않으며 같은 semantic token과 크기 규칙으로 설계한다.

## 답변 초안

하나의 질문 초안은 선택값, 자유 입력, 입력 출처, 최초 음성 인식문을 함께 가진다. 음성 인식 결과는 자유 입력에 반영하고 사용자가 제출 전에 수정할 수 있다.

- 선택 또는 공백을 제거한 텍스트 중 하나가 유효하면 제출할 수 있다.
- 선택형에서 자유 입력을 추가해도 기존 선택을 지우지 않는다.
- 입력 방식 전환은 초안을 지우지 않는다.
- `다음` 제출 전에는 영구 답변 레코드를 만들지 않는다.

## 상태 흐름

1. `answering`: 입력과 `다음`을 사용할 수 있다.
2. `saving`: 확정 초안을 한 transaction으로 한 번 저장하고 중복 제출을 차단한다.
3. `waiting-for-ai`: 저장된 답변을 근거로 다음 질문 또는 완료를 요청한다.
4. `answering | summary-transition | save-error | ai-error | caution | urgent`로 이동한다.

저장 성공 전에는 AI를 호출하지 않는다. 저장은 짧게 끝나면 별도 시각 상태를 번쩍이지 않고, 지연 임계값을 넘을 때만 `답변을 저장하고 있어요`를 표시한다. 정확한 임계값과 fixture는 다음 단계에서 확정한다.

저장 오류는 현재 초안을 유지하고 `다시 저장하기`를 제공한다. AI 오류는 이미 저장된 답변을 다시 쓰지 않고 `다시 질문 받기` 또는 수동 문진을 제공한다.

주의 안내는 문진을 계속할 수 있다. 긴급 안전 안내는 일반 입력을 잠그고 확인 후 안전 종료 또는 현재 계획에서 허용한 수동 요약으로만 이동한다. 질문 수·단계·잔여량은 어떤 상태에서도 표시하지 않는다.

## 스크롤과 초점

- 새 질문이 추가될 때 사용자가 최신 영역 근처에 있으면 아래로 이동한다.
- 과거 대화를 읽는 중이면 위치를 유지하고 `최신 질문으로 이동`을 표시한다.
- 새 질문은 전체 기록이 아니라 새 내용만 `aria-live`로 알린다.
- 상태 전환 뒤 초점은 현재 질문, 오류 제목 또는 안전 안내 제목으로 명시적으로 이동한다.
- 프레임과 상태바는 화면 낭독과 탭 순서에서 제외한다.
- 모든 조작은 키보드로 가능하고 visible focus와 최소 48px 영역을 가진다.

## 확대와 제외 범위

320px reflow와 반응형 레이아웃은 구현하지 않는다. 200% 확대에서도 고정 프레임을 유지하며 바깥 페이지와 내부 대화 스크롤로 모든 내용과 조작에 접근할 수 있어야 한다.

iOS 소프트웨어 키보드와 네이티브 미디어 선택 창은 웹 UI로 모사하지 않는다. 사진 입력은 기존 Conditional P0 gate를 통과한 빌드에서만 노출한다.

## 검증 계약

- 393×852에서 Chat_01_Entry, Chat_04, Chat_06과 시각 비교
- 프레임 개구부 정렬, Dynamic Island safe area, 앱 잘림 확인
- 전체 대화 스크롤, 조건부 자동 이동, 최신 질문 복귀 검증
- 선택·텍스트·음성 초안 보존과 명시적 `다음` 검증
- 질문당 저장 1회, 중복 제출 차단, 저장 후 AI 호출 순서 검증
- 저장 지연·저장 오류·AI 대기·AI 오류·주의·긴급·요약 전환 검증
- 키보드 전용 조작, focus, live status, 48px 조작 영역 검증
- 200% 확대에서 바깥·내부 스크롤 접근 검증
- 구현 완료 후 관련 테스트와 lint, typecheck, production build 통과

## 다음 단계

기본·저장 지연·AI 대기·저장 오류·AI 오류·주의·긴급 안전·요약 전환 fixture의 데이터와 전환 조건을 정의한다.
