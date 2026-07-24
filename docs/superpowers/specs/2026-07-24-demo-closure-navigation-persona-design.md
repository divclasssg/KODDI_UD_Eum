# 데모 마감: 기록 복원·현황 정합성·후순위 결정·Persona 검증 설계

- 작성일: 2026-07-24
- 상태: 사용자 설계 승인 완료
- 범위: 기록 목록 복귀, 요구사항 현황 정합성, U5/U8 범위 결정, credential-free Persona·접근성 검증

## 목표

공개 데모의 핵심 사용자 경로를 마감한다. 기록 상세·의료진 화면에서 목록으로 돌아왔을 때 사용자가 보던 기록을 다시 찾게 하고, 실제 구현·검증 증거와 체크리스트를 일치시키며, 음성·사진의 후순위 경계를 명확히 한다. 마지막으로 외부 AI·GPU 없이 세 Persona의 음성 비의존 Task 조합을 공개 UI에서 검증한다.

## 순서와 완료 경계

작업은 다음 네 milestone을 순서대로 수행한다.

1. 기록 목록 복귀·스크롤·focus 복원
2. R1~R20·U1~U9·Day 7 현황 정합성
3. U5 음성·TTS와 U8 사진의 후순위 결정
4. 3 Persona × 3 Task 중 음성 비의존 7개 조합 검증

앞 milestone의 결과는 다음 milestone 문서와 검증의 입력이 된다. 음성·사진은 이번 작업에서 구현하지 않으며, Persona 9개 조합 전체를 완료로 표시하지 않는다.

## 검토한 접근

### 브라우저 History + 기록 anchor

선택한 접근이다. 브라우저 Back은 기존 history entry의 scroll 복원을 사용한다. 앱이 제공하는 목록 복귀 링크는 현재 기록을 가리키는 URL fragment를 사용한다. 목록의 비동기 로드가 끝난 뒤 fragment 대상 record link를 화면 안으로 이동하고 focus한다.

이 방식은 record ID를 `sessionStorage`, 로그 또는 새 저장소에 복제하지 않는다. URL에는 이미 상세 경로에 노출되는 동일한 opaque ID만 fragment로 사용한다. schema와 IndexedDB store는 변경하지 않는다.

### sessionStorage scroll snapshot

scroll 위치와 record 식별자를 저장하면 구현은 단순하지만, 오래된 상태·다중 탭·새로고침 문제와 기존 U7의 저장 최소화 결정에 어긋난다. 채택하지 않는다.

### Parallel Route로 목록 유지

목록 DOM을 상세 뒤에 유지하면 복원이 가장 정확하지만 App Router 구조와 페이지 소유권을 크게 바꾼다. 데모 마감 범위를 넘으므로 채택하지 않는다.

## Milestone 1 · 기록 목록 복원

### 컴포넌트 경계

기록 anchor 생성과 해석은 작은 순수 모듈이 소유한다.

- 입력: opaque `interviewId`
- 출력: DOM id와 `/records#...` 내부 href
- 허용: 정해진 prefix와 `encodeURIComponent()` 결과
- 거절: 빈 fragment, 다른 prefix, 목록에 없는 대상

`RecordListScreen`은 ready records가 렌더된 뒤에만 fragment를 해석한다. 일치하는 record link가 있으면 `scrollIntoView({ block: "center" })` 후 `focus({ preventScroll: true })`한다. 일치하지 않으면 목록 상단과 현재 focus를 유지하고 오류를 표시하거나 로그로 남기지 않는다.

`RecordDetailScreen`의 ready·not-found·corrupt·error 상태가 제공하는 `기록 목록으로` 링크는 다음 규칙을 따른다.

- ready: 현재 record anchor가 있는 `/records#...`
- record ID를 안전하게 확인할 수 없는 상태: `/records`
- profile 수정의 기존 `returnTo` 계약은 변경하지 않음

의료진 화면의 `기록 상세로 돌아가기`는 동일 record 상세를 유지한다. 상세에서 목록으로 돌아갈 때 anchor 복원이 적용된다.

### 브라우저 Back

목록에서 상세로 들어갈 때 기존 `Link`의 history push를 유지한다. 브라우저 Back·뒤로가기 제스처를 가로채거나 `popstate` sentinel을 만들지 않는다. 브라우저가 이전 목록 history entry의 scroll을 복원하는지 Chromium E2E로 검증한다.

브라우저가 복원한 scroll 위치와 앱 링크의 anchor 복원은 별도 계약이다.

- browser Back: 이전 history entry의 scroll 위치
- 앱의 목록 복귀 링크: 같은 record가 보이고 focus된 위치

### 검증

- 여러 완료 기록으로 목록을 viewport보다 길게 만든다.
- 아래쪽 record를 열기 전 scroll 위치를 기록한다.
- browser Back 뒤 같은 record가 viewport에 있고 scroll 위치가 허용 오차 안에서 복원되는지 확인한다.
- 상세의 `기록 목록으로` 링크로 돌아오면 같은 record link가 visible·focused인지 확인한다.
- 상세 → 의료진 → 상세 → 목록에서도 동일 ID가 유지되는지 확인한다.
- 잘못된 fragment와 삭제된 record fragment는 예외 없이 목록으로 수렴한다.
- 393×852에서 horizontal overflow가 없다.

## Milestone 2 · 체크리스트 정합성

### R1~R20 증거표

체크리스트에 R1~R20 증거표를 추가한다. 각 requirement는 다음 셋 중 하나만 가진다.

- `완료`: requirement 문장 전체를 현재 코드와 실행 증거가 충족
- `부분`: 일부 구현 또는 일부 증거만 존재
- `후순위`: 이번 데모 범위에서 명시적으로 구현하지 않음

P0 완료 수는 `완료` 행만 기계적으로 센 값이다. 기존 구현이 비슷해 보여도 requirement의 실제 수치·기능·수정 가능성·actual 경계를 충족하지 않으면 완료로 올리지 않는다.

특히 다음 항목은 엄격하게 판단한다.

- R9 모의 음성 입력
- R11 실제 MedGemma 후속 질문 수 계약
- R14 요약 검토·수정·확정 전체 계약
- R16 사용자 실행형 TTS

### U1~U9와 Day 7

- U1~U9 진행률은 exit evidence 전체가 있는 unit만 완료로 센다.
- U5는 후순위, U8은 conditional-disabled, U9는 부분으로 유지한다.
- Day 5·Day 6·Day 7의 중복되거나 오래된 미완료 항목을 실제 증거에 맞춘다.
- `/interview/new`는 공개 route가 아닌 개발 fixture·시각 회귀 전용 route로 문서화하며 삭제하지 않는다.
- `다음 작업`, 차단 기록, 범위 제외 기록, 작업일지를 같은 변경에서 동기화한다.

## Milestone 3 · U5/U8 결정

### U5 모의 음성·TTS

이번 데모에서는 후순위로 유지한다.

- 실제 마이크·녹음·STT 호출 없음
- 모의 음성 transcript UI 구현 없음
- 사용자 실행형 TTS 구현 없음
- R9와 R16은 완료로 표시하지 않음
- 김영수 Task 1 TTS와 박성훈 Task 1 음성 입력은 Persona matrix 후순위

재개하려면 speech interaction 계약, 브라우저 지원 범위, timer·unmount·reset 취소, TTS·입력 상호배타, keyboard·screen reader·hidden content 검증이 먼저 승인돼야 한다.

### U8 사진

conditional capability를 활성화하지 않는다.

- capture·file selection UI 숨김 유지
- MIME·magic byte·크기·dimension, EXIF 제거, 재인코딩, object URL revoke가 모두 구현되기 전 노출 금지
- attachment lifecycle과 reset, MedGemma multimodal validator, 실제 응답 gate가 모두 통과해야 재개
- 실제 사진·media·multimodal provider 호출 없음

## Milestone 4 · Persona·접근성 검증

### 검증 대상

공개 UI에 Persona 선택기나 fixture 문구를 추가하지 않는다. 테스트 코드에서만 합성 사용자 특성과 기대 행동을 정의한다.

검증하는 7개 조합:

- 김영수: Task 2 오늘 기록·의료진 보기, Task 3 과거 기록·프로필 수정
- 이민정: Task 1 온보딩·문진 완료, Task 2 오늘 기록·의료진 보기, Task 3 과거 기록·프로필 수정
- 박성훈: Task 2 오늘 기록·의료진 보기, Task 3 과거 기록·프로필 수정

후순위 2개 조합:

- 김영수 Task 1: 사용자 실행형 TTS가 없어 완료 불가
- 박성훈 Task 1: 모의 음성 입력이 없어 완료 불가

최종 표기는 `7/9 통과, 2/9 후순위`다.

### 실행 경계

- 실제 `/onboarding`, `/home`, `/interview/manual` 또는 credential-free `/interview/ai`, `/records`, 상세, clinician, `/profile`을 사용한다.
- IndexedDB version 1과 실제 완료 record ID를 사용한다.
- 합성 이름·생년월일·증상만 사용한다.
- 실제 AI·Modal·GPU·media·STT 요청은 0회다.
- 기존 실제 MedGemma 성공 증거를 재실행하지 않는다.
- Persona 이름·fixture·내부 진행률은 공개 body에 노출하지 않는다.

### 접근성 증거

- 모든 7개 조합은 393×852에서 horizontal overflow가 없어야 한다.
- 대표 Task 1~3은 keyboard-only로 완료한다.
- 주요 화면은 h1, 명시적 label, visible focus, 최소 touch target을 유지한다.
- loading·저장 성공·오류는 기존 status·alert 계약을 사용한다.
- 기록 복귀 뒤 같은 record link가 visible·focused다.
- `200% zoom`은 기존 실제 Chrome 수동 증거를 재사용하고 자동 CSS zoom을 증거로 대체하지 않는다.

## 오류·개인정보 경계

- record fragment가 손상되거나 대상이 없으면 예외·raw ID·raw database error를 표시하지 않는다.
- 새 localStorage·cookie·IndexedDB store를 추가하지 않는다.
- record ID, profile, medical content를 sessionStorage와 로그에 저장하지 않는다.
- Persona 검증 실패는 조합별로 기록하며 성공한 조합 수를 부풀리지 않는다.
- 외부 AI·media 요청이 한 건이라도 관찰되면 credential-free Persona gate는 실패다.

## 검증 순서

1. 기록 anchor 순수 계약과 list component RED/GREEN
2. 복수 기록 browser Back·앱 링크 focused Chromium
3. R1~R20·U1~U9 evidence audit와 문서 diff 검사
4. U5/U8 후순위 결정 문서 정합성
5. Persona 7개 조합 focused Chromium
6. lint·typecheck·unit·integration 병렬 milestone gate
7. production build를 포함한 전체 Chromium E2E 한 번
8. 최종 diff·문서 링크·원격 반영 상태 확인

실제 AI·Modal·GPU·media·STT 검증은 실행하지 않는다.

## 완료 조건

- browser Back은 이전 기록 목록 scroll 위치로 돌아간다.
- 앱 목록 복귀 링크는 같은 record를 visible·focused 상태로 복원한다.
- R1~R20·U1~U9·Day 7 수치와 체크가 직접 증거와 일치한다.
- U5와 U8은 구현 완료가 아닌 후순위·conditional-disabled로 명시된다.
- Persona matrix는 7/9 통과와 음성 의존 2/9 후순위를 정확히 표시한다.
- credential-free 7개 조합과 접근성 gate가 통과한다.
- production storage schema와 외부 runtime 상태는 변경하지 않는다.
