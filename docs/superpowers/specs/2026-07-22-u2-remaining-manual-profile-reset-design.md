# U2 남은 범위와 최소 U3 수동 문진 수직 슬라이스 설계

## 목적

U2의 남은 프로필 수정·전체 데이터 삭제 UI를 완성하고, AI 전송에 동의하지 않은 사용자도 Persona나 fixture 없이 실제 수동 문진을 끝까지 수행할 수 있게 한다. 수동 문진 실행에 필요한 범위만 U3 기반으로 포함하며 AI, Modal, 실제 음성·사진 처리는 포함하지 않는다.

공개 경로는 실제 제품 흐름과 같은 정보 구조를 사용한다. 개발용 `/interview/new`의 Persona와 fixture는 검증 용도로 유지하되 홈이나 실제 사용자 경로에서 노출하거나 주입하지 않는다.

## 범위

### 포함

- 홈의 수동 문진·프로필 수정·전체 삭제 진입점
- Persona 없는 `/interview/manual` 실제 사용자 경로
- IndexedDB 기반 수동 문진 생성, 답변 저장, 새로고침 복원, 요약 검토, 완료
- profile과 medical profile의 원자적 수정
- 모든 store의 원자적 reset과 성공·실패 UI
- reset 전에 진행 중 요청과 timer를 취소하는 runtime operation coordinator
- revision·consent guard를 통한 늦은 쓰기 폐기
- 합성·비식별 fixture를 사용한 unit, integration, E2E 검증

### 제외

- AI 문진과 Modal actual·배포·GPU 호출
- 실제 마이크·STT·TTS·사진 권한과 파일 처리
- Persona 선택·주입 공개 UI
- 응급도 판정, 진단, 치료 권고
- clinician view와 기록 목록의 완성
- 전역 navigation 계약 확정

## 사용자 경로와 책임

### 홈 `/home`

홈은 저장된 프로필과 AI 동의 상태를 복원한다. AI 동의 여부와 무관하게 수동 문진을 사용할 수 있으며, 프로필 수정과 전체 데이터 삭제 화면으로 이동할 수 있다. AI 거부 상태에서는 외부 전송이 없음을 명확히 설명한다.

### 수동 문진 `/interview/manual`

기존 Persona 기반 `/interview/new`와 분리된 실제 사용자 경로다. 가장 최근의 `draft` 또는 `review` 상태 수동 문진이 있으면 복원하고, 없으면 새 문진을 생성한다. 질문 번호, 전체 질문 수, 고정 진행률을 화면에 표시하지 않는다.

### 프로필 `/profile`

현재 profile과 medical profile을 함께 읽고 수정한다. 온보딩과 같은 정규화·검증 규칙을 공유하며 두 record는 한 transaction으로 저장한다. 완료된 과거 문진의 profile snapshot은 수정하지 않는다.

### 데이터 관리 `/settings/data`

삭제 대상과 복구 불가능성을 설명하고 명시적인 최종 확인을 받는다. 성공한 경우에만 삭제 완료 상태를 표시하고 사용자가 온보딩을 다시 시작할 수 있게 한다.

## 수동 질문 세트

질문 세트 식별자는 `manual-intake-v1`이다. 최대 다섯 개 항목을 사용한다.

1. 사용자가 직접 입력하는 주된 불편함
2. 시작 시점
3. 지속 또는 반복 양상
4. 사용자가 느끼는 불편 정도
5. 추가로 전달할 내용

v1은 사용자의 답을 의학적으로 해석해 질문을 동적으로 생략하지 않는다. 선택형 항목은 `잘 모르겠어요`를, 추가 전달 내용은 `추가 내용 없음`을 명시적으로 선택할 수 있다. 질문 snapshot을 draft에 저장해 배포 뒤에도 진행 중 문진의 질문이 임의로 바뀌지 않게 한다.

요약은 저장된 사용자 답변만 근거로 결정론적으로 생성한다. 응급도, 진단, 치료 또는 행동 권고를 생성하지 않는다. 각 요약 항목은 근거 message ID를 보관한다.

## IndexedDB와 repository 계약

database 이름 `koddi-ud-eum`, version `1`, 기존 8개 object store와 index는 변경하지 않는다. `interviews.byStatusUpdatedAt`을 사용해 진행 중 문진 후보를 최신순으로 찾고 `mode: manual`인 aggregate만 복원한다.

`InterviewRepository`에는 가장 최근 진행 중 수동 문진을 읽는 API를 추가한다. 새 schema나 index가 필요하지 않으므로 migration은 발생하지 않는다.

### 생성과 진행 저장

- 생성 시 `interviews`와 첫 `interviewDrafts`를 한 `readwrite` transaction으로 저장한다.
- 마지막 전 답변은 assistant 질문 message, user 답변 message, 다음 질문 draft를 한 transaction으로 저장한다.
- transaction이 완료된 뒤에만 UI가 다음 질문으로 이동한다.
- 성공한 transaction마다 interview와 draft revision을 함께 1 증가시킨다.
- 저장 중 중복 제출을 무시하고 stale revision과 stale runtime generation은 거부한다.
- 마지막 답변은 두 message, 결정론적 summary, `review` 상태 전환을 전용 repository 명령의 한 transaction으로 저장한다. 마지막 답변 저장과 summary 저장 사이에 새로고침이 끼어 같은 질문을 다시 답하게 되는 중간 상태를 만들지 않는다.
- review 상태의 draft는 완료 transaction이 기존 계약대로 제거할 때까지 마지막 질문 snapshot과 빈 입력을 유지한다. review UI는 이 draft를 입력 화면으로 노출하지 않는다.

### 검토와 완료

요약 검토 중 새로고침하면 `review` aggregate와 summary를 복원한다. 사용자가 확인하면 기존 `complete()` transaction으로 상태를 `completed`로 바꾸고 당시 profile과 medical profile을 deep snapshot으로 저장한다. 완료 transaction은 draft를 제거하고 summary를 `confirmed`로 바꾼다.

### 프로필 수정

profile과 medical profile의 `updatedAt`에는 하나의 UTC ISO 8601 millisecond `Z` timestamp를 사용한다. 저장 transaction 안에서 현재 local storage·sensitive health consent를 확인한다. 이름, 생년월일, 성별, 의료 목록, 생활 습관, 선택 측정값은 온보딩과 같은 정규화 규칙을 사용한다.

서울 달력 기준 만 14세 미만이거나 130세를 초과하는 생년월일은 저장하지 않는다. 실패 시 기존 record와 화면 입력을 유지한다. 프로필 수정 후 생성해 완료하는 새 문진만 새 snapshot을 사용한다.

## Runtime 취소와 reset

runtime operation coordinator는 현재 generation, 등록된 `AbortController`, 등록된 timer를 관리한다. 실제 AI·TTS·음성 처리를 새로 구현하지 않지만 이후 기능이 같은 경계에 등록할 수 있는 API를 제공한다.

reset은 다음 순서를 지킨다.

1. 사용자의 최종 확인
2. runtime generation 증가
3. 등록된 요청 abort와 timer clear
4. 8개 store를 하나의 `readwrite` transaction으로 clear
5. transaction 성공 뒤 삭제 완료 상태 표시

transaction이 실패하면 모든 삭제를 rollback하고 현재 화면에 오류를 표시한다. reset 이후 도착한 쓰기는 application runtime generation 검사와 transaction 내부 consent·interview revision 검사를 모두 통과해야 하므로 삭제된 데이터를 복구하지 못한다.

## 오류와 복구 정책

- 프로필을 불러오지 못하면 값을 부분 노출하지 않고 재시도와 홈 이동을 제공한다.
- 프로필 저장 실패 시 입력을 유지한다.
- 수동 문진 저장 실패 시 현재 질문과 입력을 유지하며 다음 질문으로 이동하지 않는다.
- aggregate의 interview, draft, summary revision 또는 message sequence가 불일치하면 새 문진으로 덮어쓰지 않고 복구 오류를 표시한다.
- reset 실패 시 기존 데이터를 유지하고 재시도할 수 있게 한다.
- reset 성공 화면은 저장된 개인정보를 다시 표시하지 않는다.

## 접근성과 공개 데모 경계

- 상태와 오류는 색상만으로 전달하지 않고 `status` 또는 `alert` 의미를 제공한다.
- dialog는 제목, 설명, 취소, 최종 확인을 키보드로 사용할 수 있다.
- 질문에는 접근 가능한 label을 제공하고 저장 중에는 제출을 잠근다.
- 음성·사진 진입점은 기존 제품 위치에 유지하되 실제 권한·파일·외부 IO를 실행하지 않는다.
- 공개 사용자 흐름에 Persona, fixture ID, 역할극 확인을 노출하지 않는다.

## TDD와 검증

### Repository integration RED

- 최신 진행 수동 문진 복원
- 답변 message와 다음 draft의 원자 저장
- deterministic summary의 evidence 일치
- 프로필 수정 뒤 과거 완료 snapshot 불변
- reset abort의 전량 rollback
- reset 이후 stale runtime·revision 쓰기 거부

### Unit·component RED

- 질문 번호·고정 진행률·Persona 미노출
- 저장 중 중복 제출 차단과 저장 실패 입력 보존
- 프로필 정규화와 만 14세 미만 수정 차단
- reset 확인, 취소, 실패, 성공 상태
- 등록된 요청과 timer의 취소

### Chromium E2E

- 온보딩 → 홈 → 수동 문진 → 새로고침 복원 → 요약 → 완료
- 프로필 수정 후 새 완료 기록에만 새 snapshot 반영
- 전체 삭제 뒤 8개 store 0건과 온보딩 재진입
- AI 거부 수동 경로의 외부 요청 0건

### 최종 gate

- `git diff --check`
- lint
- typecheck
- unit·integration 전체
- 관련 Chromium E2E와 기존 E2E 전체
- production build

## 완료 조건

U2는 프로필 수정과 전체 삭제 UI가 실제 repository에 연결되고, AI를 거부한 사용자가 Persona나 fixture 없이 수동 문진을 생성·복원·완료할 수 있을 때 완료로 표시한다. 최소 U3 기반은 이 수직 흐름에 필요한 범위만 완료로 표시하며 U3 전체 입력 체계나 의료 콘텐츠 계약이 끝난 것으로 과장하지 않는다.
