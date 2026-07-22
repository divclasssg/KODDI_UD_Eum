> [상위 설계](../2026-07-22-u3-interview-state-input-contracts-design.md)

# 식별자·동시성·Stale 폐기

## 네 식별자의 역할

| 값 | 생성 | 저장 | 비교 | 폐기 |
|---|---|---:|---|---|
| `interviewId` | 새 문진 create 때 `crypto.randomUUID()` | O | 모든 aggregate command 대상 | 완료 후 유지, reset 때 record 삭제 |
| `revision` | create `1`, 성공 transaction마다 `+1` | O | transaction 내부 expected/current 비교 | 새 성공 결과로만 교체 |
| `requestId` | application session의 effect마다 UUID | X | pending operation exact match | resolve/reject 처리 뒤 폐기 |
| runtime generation | browser coordinator 시작 `0`, reset·동의 철회 때 `+1` | X | port 호출 전과 repository transaction 진입 전 검사 | invalidation 뒤 이전 값 영구 거부 |

`sessionId`도 application service 생성 시 UUID로 만들며 request collision과 component remount를 구분한다. `OperationToken`은 `{ sessionId, requestId, interviewId?, baseRevision?, runtimeGeneration }`이다.

## 책임 분리

- requestId는 같은 화면 session 안에서 늦게 도착한 success와 failure가 UI를 바꾸지 못하게 한다.
- revision은 같은 durable interview에 대한 두 writer의 충돌을 IndexedDB transaction 안에서 막는다.
- runtime generation은 reset·동의 철회 이전 작업 전체를 무효화한다.
- interviewId는 다른 문진의 응답이 현재 문진으로 섞이는 것을 막는다.

requestId를 IndexedDB에 저장하지 않는다. 중복 command 두 개가 repository까지 도달해도 같은 expected revision을 사용하므로 하나만 commit되고 나머지는 `RevisionConflictError`가 된다. U3에서 네트워크 재전송 idempotency log는 만들지 않는다.

## UI stale success와 stale failure

machine은 result token이 현재 pending token과 정확히 같을 때만 결과를 적용한다. 다음 중 하나라도 다르면 success와 failure를 모두 no-op으로 폐기한다.

- `sessionId` 불일치
- `requestId` 불일치
- `interviewId` 불일치
- `baseRevision`이 pending 기준과 불일치
- `runtimeGeneration` 불일치

폐기한 failure는 alert를 표시하지 않고 retry 상태도 만들지 않는다. 폐기한 success의 aggregate로 현재 draft나 질문을 덮어쓰지 않는다.

## 저장소 stale 쓰기

repository adapter는 write transaction 안에서 다음 순서로 검사한다.

1. runtime coordinator가 token generation을 허용하는지 검사
2. current local/sensitive consent 존재 확인
3. interview record 존재와 interviewId 확인
4. terminal status가 아닌지 확인
5. expected revision과 current revision 일치 확인
6. draft/question snapshot version과 message sequence 검증
7. write 후 transaction complete

reset이 먼저 commit되면 consent와 interview가 없으므로 늦은 쓰기가 실패한다. 늦은 쓰기가 먼저 commit돼도 뒤의 reset transaction이 8개 store를 지운다. reset 실패 시 generation은 이미 바뀌어 이전 작업은 계속 폐기되지만 기존 데이터는 rollback되어 재시도 화면에서 안전하게 다시 읽는다.

## 동시 event 정책

- double submit: 첫 event만 `submitting`, 이후 submit은 no-op.
- draft save + submit: submit을 queue하고 최신 draft persist 성공 뒤 한 번만 submit.
- navigation + save: dirty, saving, submitting, completing이면 route 이동을 차단한다.
- navigation + clean: session을 disposed로 만든 뒤 route effect를 실행한다.
- reset + any operation: generation 증가·AbortController/timer 취소·DB reset, machine은 disposed.
- reload: 새 sessionId/requestId namespace에서 IndexedDB aggregate를 읽는다. persisted revision이 유일한 durable 기준이다.
- unmount: current session을 dispose하고 등록 request를 abort한다. reset generation은 바꾸지 않는다.

## Reload 한계와 보장

IndexedDB transaction 완료 전 브라우저 프로세스가 강제 종료되면 마지막 DOM 입력을 영구 보장할 수 없다. 제품 계약은 이를 숨기지 않는다.

- 모든 draft edit는 단일 직렬 write lane에 즉시 enqueue하고 중간 값은 coalesce한다.
- mode switch는 전체 mode draft를 저장 완료한 뒤 clean으로 확정한다.
- dirty/saving 동안 앱 내부 navigation은 차단한다.
- reload 뒤에는 마지막으로 완료된 draft transaction을 손실 없이 복원한다.
- 강제 종료 직전 아직 commit되지 않은 마지막 keystroke까지 보장한다고 문서화하지 않는다.
