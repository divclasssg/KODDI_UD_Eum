# U7 기록에서 내 정보 수정 설계

## 목표

완료 기록 상세에서 현재 프로필을 수정하고 같은 기록으로 돌아오는 공개 사용자 경로를 제공한다. 과거 기록의 `profileSnapshot`은 변경하지 않고, 수정된 현재 프로필은 이후 새 문진에만 적용한다.

## 범위

### 포함

- `/records/[id]`에서 현재 프로필 수정 진입
- `/profile` 기존 폼과 저장소 재사용
- 기본정보·의료정보 섹션 구분
- 변경 감지, 취소 확인, 저장 상태와 실패 복구
- 허용된 기록 상세 경로로 복귀
- 과거 snapshot 불변과 이후 문진 반영 검증
- 키보드 사용과 393×852 반응형 검증

### 제외

- 과거 기록 내용 또는 snapshot 편집
- 기록 삭제·공유·내보내기
- 프로필 schema migration
- 실제 음성·사진·외부 AI 호출
- 여러 프로필 또는 계정 지원

## 선택한 접근

`/profile?returnTo=/records/{encodedInterviewId}`를 사용한다. 기존 `/profile` 화면과 `ProfileRepository.saveBundle()`을 재사용하고, `returnTo`는 기록 상세 내부 경로만 허용한다.

`sessionStorage` 방식은 탭·새로고침·오래된 상태 문제 때문에 사용하지 않는다. `/records/[id]/profile` 전용 화면도 기존 폼과 검증을 중복하므로 만들지 않는다.

## 화면과 이동

### 기록 상세

- ready 상태에 `내 정보 수정` 링크를 추가한다.
- 링크는 `/profile?returnTo=`와 현재 기록 상세 경로를 사용한다.
- 손상·없음·오류 상태에는 수정 링크를 표시하지 않는다.
- 의료진용 화면에는 프로필 수정 링크를 추가하지 않는다.

### 프로필 화면

- 제목과 기존 필드를 유지한다.
- 기록에서 진입한 경우 “현재 정보만 수정되며 과거 기록은 변경되지 않아요.” 안내를 표시한다.
- 기본정보와 의료정보를 시각적 섹션으로 구분한다.
- 저장 성공 시 허용된 동일 기록 상세로 이동한다.
- 직접 `/profile`로 진입한 경우 저장·취소 후 `/home`으로 이동한다.
- 변경사항이 없으면 취소 시 즉시 복귀한다.
- 변경사항이 있으면 화면 안의 확인 panel에서 변경 폐기를 재확인한다.
- 저장 중에는 저장·취소·이탈 행동을 비활성화한다.

브라우저 자체 Back 취소 API는 추가하지 않는다. 앱이 제공하는 취소·복귀 행동에서만 폐기 확인을 보장하고, full-document unload에는 변경사항이 있을 때 기본 `beforeunload` 경고를 등록한다.

## 데이터와 불변 조건

- 편집 대상은 현재 `profiles/default`와 `medicalProfiles/default`뿐이다.
- `saveBundle()`의 기존 readwrite transaction과 두 store 원자 저장을 유지한다.
- 로드한 `ProfileBundleV1`을 기준 draft로 보관하고 현재 draft와 비교해 변경 여부를 계산한다.
- 저장 성공 후 반환된 bundle을 새 기준값으로 사용한다.
- 저장 실패 시 draft, 오류 표시, `returnTo`를 유지한다.
- `interviews[*].profileSnapshot`은 읽거나 쓰지 않는다.
- 새 문진 생성은 기존처럼 저장 시점의 current profile snapshot을 복제한다.

## 복귀 경로 안전성

허용 형식은 정확히 `/records/{encodedInterviewId}` 한 단계다.

- query·fragment·clinician 하위 경로는 허용하지 않는다.
- `//`, scheme, backslash, control character, 빈 ID는 거절한다.
- `decodeURIComponent()`가 실패하는 ID는 거절한다.
- 허용되지 않은 값은 `/home`으로 정규화한다.
- UI는 정규화된 내부 경로만 router에 전달한다.

복귀한 기록이 삭제됐거나 손상됐으면 기존 기록 상세의 not-found·corrupt 상태를 그대로 사용한다.

## 상태 모델

프로필 화면은 다음 상태를 구분한다.

- `loading`
- `load-error`
- `ready-clean`
- `ready-dirty`
- `discard-confirm`
- `saving`
- `save-error`

`save-error`는 dirty draft를 유지한다. 중복 submit은 무시한다. unmount 뒤 load·save 완료는 navigation이나 화면 state를 바꾸지 않는다.

## 접근성

- 페이지에는 `h1` 하나를 유지한다.
- 기본정보와 의료정보는 각각 제목을 가진 section으로 제공한다.
- 저장 중 `aria-busy`와 버튼 비활성화를 사용한다.
- 저장 실패와 validation 오류는 `role="alert"`로 제공한다.
- 저장 성공 후 이동 전 상태는 `role="status"`로 알린다.
- 폐기 확인 panel은 제목과 명시적 `계속 수정`, `변경사항 버리기` 버튼을 제공한다.
- 모든 행동은 키보드로 실행할 수 있고 최소 44px target을 유지한다.

## 오류와 개인정보

- load 실패는 일반화된 재시도 화면으로 수렴한다.
- save 실패는 원문 오류 없이 “입력한 내용은 그대로 있어요.”를 표시한다.
- profile·medical content, record ID, raw database error를 로그에 기록하지 않는다.
- 외부 AI·media endpoint를 호출하지 않는다.

## 검증

### 단위·컴포넌트

- 허용·거절 `returnTo` 정규화
- 초기 bundle과 draft의 변경 감지
- clean 취소 즉시 복귀
- dirty 취소 확인과 계속 수정·폐기
- 저장 성공 동일 기록 복귀
- 저장 실패 draft 보존
- 중복 저장 차단
- unmount 뒤 늦은 load·save 결과 폐기
- 기록 상세의 인코딩된 프로필 수정 링크

### 통합

- 현재 profile 두 store 원자 저장
- 저장 전후 기존 completed interview snapshot 불변
- 저장 이후 생성한 interview만 새 profile snapshot 사용

### Chromium

AI 전송 비동의 합성 온보딩 → 수동 문진 완료 → 기록 목록 → 동일 ID 상세 → 내 정보 수정 → 저장 → 동일 ID 상세 복귀 → 기존 snapshot 불변 확인 → 새 문진 완료 → 새 snapshot 반영을 한 경로로 검증한다.

추가 계약:

- 393×852 horizontal overflow 0
- 키보드만으로 편집·저장·취소 확인 가능
- `/api/ai/*`, media, STT 요청 0회
- 외부 AI·GPU actual 0회

## 완료 조건

- U7 공개 경로와 모든 상태가 구현된다.
- 과거 snapshot 불변과 이후 문진 반영이 자동 검증된다.
- 관련 unit·integration·Chromium 검증, lint, typecheck, `git diff --check`가 통과한다.
- U5 speech, U8 photo, 공유·내보내기는 후순위로 유지한다.
