# U3 문진 상태·입력 계약 설계

## 문서 상태

- 상태: **승인·구현 완료**
- 기준: `main@2f69911`
- 작업 브랜치: `codex/u3-interview-state-input-contracts`
- 구현 승인: 2026-07-22 사용자 `구현` 요청
- 범위 밖: commit, push, main merge, Modal actual, 배포, GPU, 실제 AI·음성·사진 처리

## 목표

현재 `/interview/manual`의 수직 흐름을 `UI → application service → pure domain machine → ports` 경계로 재구성한다. 입력 방식 전환, draft 복원, measurement, 중복 제출, stale success·failure 폐기와 reset 이후 데이터 부활 차단을 하나의 검증 가능한 계약으로 만든다.

공개 사용자는 실제 제품 흐름만 사용한다. Persona, fixture 선택, 역할극 확인, 질문 번호, 총 질문 수, 고정 진행률은 공개 경로에 추가하지 않는다. 합성·비식별 데이터만 검증에 사용하고 실제 AI·media operation은 호출하지 않는다.

## 현재 구현 재판정

| 항목 | 판정 | 근거 |
|---|---|---|
| text·choice manual 입력 | 완료 | 수동 질문, 저장 실패 입력 보존, Chromium 완료 흐름 |
| 저장 중 이동·중복 제출 차단 | 부분 완료 | 화면 `pending`으로 버튼은 막지만 pure machine·navigation event 계약은 없음 |
| revision·runtime guard | 부분 완료 | repository revision과 reset generation은 있으나 requestId·UI stale failure 계약 없음 |
| versioned 질문 골격 | 부분 완료 | `manual-intake-v1` ID는 있으나 snapshot input contract version과 완료 질문 snapshot 없음 |
| pure domain machine | 미완료 | React state와 service가 전이를 직접 수행 |
| chip·measurement·input switching | 미완료 | 공통 adapter와 mode별 draft 보존 구조 없음 |
| reload draft 복원 | 부분 완료 | 제출 뒤 다음 질문은 복원되나 미제출 mode별 draft는 복원하지 못함 |
| stale response test | 미완료 | 개발 fixture controller의 숫자 guard는 실제 manual/IndexedDB 계약 증거가 아님 |

## 권장 접근

### 권장안 A — pure machine + application effect runner + 기존 DB 물리 schema 유지

pure machine은 state와 event를 받아 새 state와 effect descriptor를 반환한다. application service가 effect를 ports에 실행하고 결과 event를 다시 machine에 넣는다. IndexedDB database version 1과 8개 store/index는 유지하되, interview·draft의 새 payload는 명시적으로 versioning하고 v1 진행 기록을 읽을 때 정규화한다.

장점은 UI·비동기·저장 경계가 테스트로 분리되고 migration 위험이 낮다는 점이다. 단점은 machine과 effect runner의 직렬화 규칙을 정확히 구현해야 한다는 점이다.

### 대안 B — React reducer 안에 IO orchestration 유지

파일 수와 초기 변경량은 적지만 reducer hook이 router, timer, repository와 request lifecycle을 함께 소유한다. 현재 U1 fixture controller와 같은 이중 상태 체계가 남아 U3의 경계 목표를 충족하지 못하므로 권장하지 않는다.

### 대안 C — append-only event log와 IndexedDB version 2

request idempotency와 감사 추적은 가장 강하지만 새 store/index, projection, migration 실패 복구가 필요하다. 현재 7일 범위와 U2 안정성을 넘어서는 설계이므로 후순위다.

## 상세 설계

1. [상태·event·effect와 계층 경계](./2026-07-22-u3-interview-state-input-contracts-design/01-state-machine-and-boundaries.md)
2. [식별자·동시성·stale 폐기](./2026-07-22-u3-interview-state-input-contracts-design/02-identifiers-concurrency-and-recovery.md)
3. [질문 snapshot·공통 draft·validation](./2026-07-22-u3-interview-state-input-contracts-design/03-question-draft-and-validation.md)
4. [저장 schema·제품 경계·수용 기준](./2026-07-22-u3-interview-state-input-contracts-design/04-storage-product-boundaries-and-acceptance.md)

## 승인 요청 결정

1. 권장안 A를 사용한다.
2. IndexedDB database version은 `1`, object store는 기존 8개, index도 그대로 유지한다.
3. `interviewId`는 문진 생성 시 한 번 만든 durable identity, `revision`은 성공한 aggregate transaction마다 증가하는 durable concurrency token이다.
4. `requestId`는 application session 안의 effect identity이며 저장하지 않는다. runtime generation은 reset·동의 철회 같은 전역 무효화 epoch이며 navigation stale UI와 역할을 섞지 않는다.
5. UI는 event만 dispatch하고 port를 직접 호출하지 않는다. machine은 IO·React·IndexedDB·router를 import하지 않는다.
6. 새 draft는 mode별 값을 동시에 보존하며 active mode만 바꾼다. validation은 순수 함수로 계산하고 결과를 저장하지 않는다.
7. measurement는 raw decimal, unit ID, 측정 시각, `empty | known | unknown`을 갖는다. unknown으로 바꿔도 직전 known 필드는 지우지 않아 되돌릴 수 있다.
8. 기간·강도는 현재 승인된 manual 문구를 chip UI로 바꾼다. 공개 증상 chip 항목은 의료 콘텐츠 승인이 없으므로 임의 추가하지 않는다.
9. 범용 measurement adapter와 합성 통합 fixture는 U3에서 구현하지만 공개 manual 질문에는 승인되지 않은 측정 질문을 추가하지 않는다.
10. 완료 기록은 생성 당시의 immutable question-set snapshot과 완료 당시 profile snapshot을 모두 유지한다.

## 남은 제품 결정 gate

### Gate 1 — 공개 증상 chip

- **권장:** U3에서는 chip adapter를 완성하고 공개 manual에는 기존 기간·강도만 chip으로 전환한다. 증상 목록은 의료 콘텐츠 계약에서 승인한다.
- 대안: 비진단적 공통 증상 목록을 이번 U3에서 승인해 공개한다. 누락·우선순위가 의료적 의미로 해석될 위험이 있다.
- 대안: 자유 텍스트를 chip처럼 보이는 preset 없이 유지한다. 안전하지만 “증상 chip 공개 구현”은 완료로 표시할 수 없다.

### Gate 2 — 공개 measurement 질문

- **권장:** 공통 계약·component·integration test까지만 완료하고 공개 manual 질문에는 넣지 않는다.
- 대안: 사용자가 이미 측정한 체온 같은 단일 값을 optional 질문으로 추가한다. 질문 콘텐츠·단위·정상범위 오해 방지 문구 승인이 추가로 필요하다.
- 대안: profile의 키·몸무게 편집에 새 component를 먼저 재사용한다. U3 문진 입력 증거가 약해진다.

## 승인 후 실행

세부 TDD 순서는 [U3 구현 계획](../plans/2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)에 고정한다. 승인 전에는 source와 test를 변경하지 않는다.
