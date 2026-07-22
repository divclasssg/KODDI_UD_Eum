> [상위 설계](../2026-07-22-u3-interview-state-input-contracts-design.md)

# 저장 Schema·제품 경계·수용 기준

## IndexedDB 결정

`koddi-ud-eum` database version `1`, 기존 8개 object store와 index를 유지한다. 새 store, keyPath, index가 없으므로 `onupgradeneeded`를 발생시키지 않는다.

record format은 물리 database version과 별도로 versioning한다.

- 기존 `InterviewRecordV1`, `InterviewDraftRecordV1`은 읽기 지원한다.
- 신규 생성 interview와 draft는 `schemaVersion: 2` 및 명시적 question/draft contract version을 쓴다.
- v1 in-progress aggregate는 load adapter가 memory에서 V2로 정규화한다.
- 첫 성공 draft/submit transaction에서 interview와 draft를 함께 V2로 올린다.
- completed V1 record는 immutable이므로 자동 수정하지 않는다. 질문 snapshot이 없는 legacy 기록으로 취급한다.
- migration 실패를 이유로 database를 삭제하거나 빈 database로 재생성하지 않는다.

database version을 2로 올리는 조건은 object store/index/keyPath 변경이 실제로 필요해질 때뿐이다. 그 경우 별도 migration 설계·실패 정책 승인을 먼저 받는다.

## Repository 변경

기존 `saveProgress` 위에 application 친화 port adapter를 둔다. lower repository에는 다음 최소 API를 추가한다.

- `persistDraft(token, draft, updatedAt)`
- V1/V2 aggregate parser와 V2 invariant validator
- create 시 immutable question-set snapshot 저장

question-set snapshot은 create에서만 받고 이후 mutation API에는 전달하지 않는다. `persistDraft`는 interview와 draft revision을 한 transaction에서 같이 증가시킨다. message나 summary는 바꾸지 않는다. submit은 current persisted draft revision을 기준으로 message, next draft 또는 final summary를 기존 원자 transaction에 저장한다.

## 외부 AI·media 금지 경계

- AI 거부 manual factory signature에는 AI/media port가 없다.
- `/interview/manual` source graph에서 `/api/ai/`, `fetch`, `getUserMedia`, SpeechRecognition, file input 호출을 금지한다.
- voice/photo 버튼은 접근 가능한 준비 중 dialog만 연다.
- Modal actual, credential, 실제 payload, GPU 호출은 U3 test command에 포함하지 않는다.

## Reset 이후 데이터 부활 방지

reset UI는 먼저 runtime generation을 무효화하고 등록 request/timer를 취소한 뒤 8-store clear transaction을 실행한다. UI machine은 `RESET_OBSERVED`로 disposed가 된다. 늦은 success/failure는 request token mismatch로 UI에서 폐기되고, 늦은 write는 generation 또는 transaction 내부 consent/interview/revision 검사로 저장소에서 거부된다.

## Test 수용 기준

### Pure domain unit

1. 허용·금지 상태 전이가 표와 일치한다.
2. double submit은 submit effect 하나만 만든다.
3. draft save 중 submit은 queue되고 최신 draft로 한 번 실행된다.
4. stale success와 stale failure가 state를 바꾸지 않는다.
5. 저장 실패 뒤 current question과 모든 mode draft가 유지된다.
6. dirty/saving/submitting/completing navigation이 차단된다.

### Input unit·integration

1. text → chip → text 전환 뒤 text와 chip 값이 모두 남는다.
2. measurement known ↔ unknown과 mode 전환 뒤 raw value, unit, measuredAt이 남는다.
3. reload 뒤 마지막 commit된 active mode와 모든 mode draft가 복원된다.
4. option allowlist, single/multiple, unknown 상호배타와 measurement validation이 순수 결과를 반환한다.
5. 기간·강도 chip이 keyboard와 48px target 계약을 지킨다.

### Repository integration

1. database version 1, 8 stores, 기존 index가 그대로다.
2. v1 진행 record를 읽고 첫 V2 write에서 원자적으로 업그레이드한다.
3. stale revision success/failure 모두 aggregate를 바꾸지 않는다.
4. concurrent persist/submit 중 하나만 expected revision으로 commit된다.
5. completed question-set/profile snapshot이 이후 registry/profile 변경과 무관하다.
6. reset 뒤 늦은 draft, submit, complete가 record를 재생성하지 않는다.

### 최소 Chromium E2E

1. AI 거부 onboarding → manual에서 기간·강도 chip과 text 전환 draft 보존 → reload 복원 → 완료.
2. 저장 pending 동안 이동·중복 제출 차단, 저장 실패 후 입력 보존은 component/integration에서 failure injection한다.
3. 공개 경로 Persona/fixture/역할극/질문 번호/고정 진행률 0건.
4. `/api/ai/` request와 실제 media operation 0건.

## 전체 gate

- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- 관련 pure unit·component test
- IndexedDB/repository integration 전체
- 관련 Chromium E2E
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- production build 성공 확인
- 합성·비식별 fixture만 사용했는지 검색 검토
- root `.gitignore`와 `stash@{0}` 보존 확인
