# U2 온보딩·홈 Repository 연결 설계

**상태:** 개정 승인됨
**작성일:** 2026-07-22
**선행 계약:** `2026-07-22-u2-indexeddb-v1-repository-design.md`
**디자인 기준:** Figma `최종 prototype`의 스플래시, 온보딩 1~4, 하단 2·3

## 1. 목표와 범위

IndexedDB v1 repository를 Figma의 전체 온보딩과 홈에 연결한다. 스플래시와 소개, 자격 확인, 동의, 기본 프로필, 프로필 허브, 의료정보 선택·입력·확인은 하나의 온보딩이다. 사용자는 만 14세 이상일 때만 진행할 수 있고 로컬 저장과 민감정보 처리에 동의한 경우에만 동의와 프로필을 원자적으로 저장한다.

이번 범위에는 `/`의 초기 진입 판정, 전체 `/onboarding` 여정, 쓰기 금지 차단 화면, 단일 transaction 완료 저장, `/home` 복원을 포함한다. 프로필 수정, 전체 삭제 UI, 실제 문진 상태 머신, 실제 음성·사진 처리는 후속 슬라이스다.

## 2. 공개 데모와 테스트 데이터 원칙

공개 데모는 실제 제품과 같은 흐름과 문구를 사용한다. Persona 선택, 가상 환자 역할, query parameter 또는 런타임 Persona 주입을 공개 경로에 만들지 않는다. 자동화 테스트에서만 합성·비식별 값을 사용한다.

## 3. 상태와 화면 흐름

```text
splash -> input-intro -> clinician-intro -> eligibility
  -> local-consent(granted) -> sensitive-consent(granted) -> ai-consent
  -> basic-profile -> profile-review -> medical-menu
  -> medical-category -> medical-menu
  -> completion -> 원자적 저장 -> /home

eligibility(under-14) -> age-blocked
local-consent(declined) -> consent-blocked
sensitive-consent(declined) -> consent-blocked
consent-blocked -> 해당 동의 재검토 또는 종료 안내
```

질문 화면에 단계 번호나 고정 진행률은 표시하지 않는다. 소개 화면의 점 표시는 질문 진행률이 아닌 두 소개 화면의 위치 표시에만 사용한다. `이전`은 React 메모리의 draft를 유지한다. 동의 완료 전에는 `localStorage`, `sessionStorage`, cookie, IndexedDB에 기록하지 않아 새로고침 시 처음으로 돌아간다.

## 4. 초기 진입 판정

`/`는 IndexedDB를 열어 새 database를 만들지 않는다. `indexedDB.databases()`로 `koddi-ud-eum` 존재 여부를 먼저 확인한다. database가 없거나 API가 미지원이면 `/onboarding`, 유효한 consent와 profile bundle이 있으면 `/home`, 부분 데이터나 오류가 있으면 복구 안내로 보낸다.

## 5. 자격과 동의 경계

### 만 14세

자격 확인에서 생년월일을 받아 서울 달력 날짜 기준 만 나이를 계산한다. 만 14세 미만이면 `age-blocked`로 이동하고 repository, IndexedDB open, 외부 요청을 호출하지 않는다. 기본 프로필에서 수정한 생년월일이 14세 미만이어도 저장하지 않는다.

### 로컬 저장과 민감정보

로컬 저장은 저장 대상, 브라우저 내부 저장, 전체 삭제 가능성을 설명한다. 민감정보 처리는 별도 화면에서 동의받는다. 어느 하나라도 거부하면 `ConsentBlocked`로 이동하며 프로필·문진·홈 진입점을 제공하지 않는다. consent record에는 `localStorage`와 별도로 `sensitiveHealth.state: granted`와 고지 버전·결정 시간을 저장한다.

### AI 전송

AI 동의는 선택이다. 거부해도 프로필과 의료정보를 로컬에 저장하고 수동 문진을 사용할 수 있다. 이 경로에서는 외부 요청을 시작하지 않는다.

## 6. 입력 계약

기본정보는 다음을 받는다.

- 이름: trim 후 1~40자
- 생년월일: 유효한 `YYYY-MM-DD`, 서울 달력 기준 만 14~130세
- 성별: `female | male | other | unknown`; 라벨은 `여성`, `남성`, `그 외`, `답하지 않음`

의료정보는 키·몸무게, 알레르기, 복용약, 가족력, 개인 병력, 수술력, 흡연, 음주를 받는다. 목록형 항목은 `known` 또는 `unknown`이며 알려진 목록은 빈 항목과 공백을 제거하고 중복을 합친다. 키는 30~250cm, 몸무게는 1~500kg의 유한한 수다. 흡연·음주는 `yes | no | unknown`과 `yes`일 때의 선택 메모로 정규화한다. 비상 연락처는 제3자 개인정보라 v1에서 받지 않는다.

의료정보 선택·입력은 같은 온보딩에 속하지만 모든 항목을 강제하지 않는다. 사용자는 한 항목을 저장한 뒤 메뉴로 돌아가 다른 항목을 추가하거나 종료할 수 있다. 미입력 항목은 `unknown`으로 저장한다.

## 7. 음성·사진 존재 계약

온보딩 소개는 글·음성·사진을 모두 안내한다. 의료정보 입력 화면에는 `음성 입력`과 관련 항목의 `사진 추가` 버튼을 실제 제품 위치에 표시한다. 현재 v1에서 버튼은 숨기거나 비활성화하지 않고 누르면 `현재 데모에서는 준비 중인 기능입니다` 안내를 연다.

- 접근성 이름은 `음성 입력, 준비 중`, `사진 추가, 준비 중`이다.
- 클릭해도 마이크·카메라·파일 권한을 요청하지 않는다.
- 녹음, 파일 선택, attachment 저장, STT, 사진 판독, 외부 요청은 0회다.
- 같은 안내에서 텍스트·선택 입력으로 복귀할 수 있다.
- 실제 처리 없이 성공한 음성 변환 또는 사진 판독 결과로 이동하지 않는다.

## 8. 원자적 완료 저장

`OnboardingRepository.complete()`는 `consents`, `profiles`, `medicalProfiles`를 하나의 `readwrite` transaction으로 열고 세 레코드를 모두 `put`한다. 어느 쓰기라도 실패하면 전체 transaction을 abort한다. UI는 완료 뒤에만 `/home`으로 이동한다.

submit 시작 시 하나의 `YYYY-MM-DDTHH:mm:ss.sssZ` UTC 값을 만들고 consent의 세 결정, profile, medical profile에 공통 사용한다. database 이름·version, 8개 store, key와 index는 변경하지 않는다.

## 9. 홈 계약

홈은 저장된 consent와 profile bundle을 읽어 이름과 이용 가능한 문진 방식을 표시한다. AI 거부 시 외부 전송이 없음을 설명하고 수동 문진을 기본 행동으로 표시한다. 누락·오류 시 저장 내용을 노출하지 않고 온보딩 복구 안내를 제공한다.

## 10. 오류와 접근성

- 오류는 쉬운 문장과 field의 `aria-describedby`로 연결하고 첫 오류에 focus한다.
- 저장 중 중복 submit과 back을 막고 unmount 뒤 navigation/state update를 하지 않는다.
- 주요 버튼은 최소 48px, 본문/control은 18px, visible focus와 텍스트 상태를 갖는다.
- 393px에서 가로 스크롤 없이 완료한다.

## 11. 테스트와 승인 기준

1. unit: 인접 전이, draft 보존, 정확히 14세 경계, 윤년·미래·130세 초과, 동의 거부 쓰기 0건, 의료정보 정규화.
2. integration: 확장 record, 3-store 원자성, 공통 UTC timestamp, rollback, 완료 snapshot 불변성.
3. component: 전체 화면 순서, 구체적 동의, 차단 행동, 오류 focus, 저장 lock, 미디어 준비 중과 권한·파일 IO 0회.
4. E2E: 합성 사용자로 전체 온보딩과 새로고침 복원, AI 요청 0건, Persona 부재.
5. E2E: 만 14세 미만과 두 필수 동의 거부에서 database가 생성되지 않음.

## 12. 의도적으로 미루는 결정

- 실제 음성·마이크·STT와 사진 선택·판독
- 비상 연락처
- 프로필 수정과 동의 철회 UI
- reset UI와 pending AI/timer 취소 orchestration
- manual question set과 deterministic summary
- 기존 `/interview/new`의 demo fixture 정리
