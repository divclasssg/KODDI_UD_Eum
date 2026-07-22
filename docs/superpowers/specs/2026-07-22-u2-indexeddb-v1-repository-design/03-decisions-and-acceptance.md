> [상위 설계](../2026-07-22-u2-indexeddb-v1-repository-design.md)

# 대안·쓰기 경계·수용 기준

## 검토한 접근

1. 문진 단일 레코드 내장형: 한 번의 `put`은 쉽지만 history 조회와 완료 불변 경계가 흐려진다.
2. aggregate 정규화 store: store는 늘지만 reset, index, snapshot, rollback을 직접 검증할 수 있다.
3. append-only event log: 감사 추적은 강하지만 migration·projection·compaction이 현재 범위를 넘는다.

권장안은 2다. 정규화가 부분 저장을 허용한다는 뜻은 아니며 repository aggregate transaction만 쓰기 진입점이다.

## 쓰기 경계

| 상태 | IndexedDB 임상 쓰기 | 외부 AI 호출 | 허용 행동 |
|---|---:|---:|---|
| 최초 local 거부 `ConsentBlocked` | 0건 | 0건 | 동의 재검토, 종료 |
| local 동의 만료·없음 | 금지 | 금지 | 동의 재검토 |
| local 동의 O, AI 거부 | 허용 | 0건 | manual 질문·요약·기록 |
| local 동의 O, AI 동의 O | 허용 | allowlist DTO만 | AI 또는 manual flow |
| reset 뒤 이전 generation | 금지 | 취소·폐기 | 새 onboarding |

AI 거부 manual flow의 금지 경계는 외부 provider/Route 요청에 적용한다. local grant가 유효하면 manual 결과의 로컬 저장은 허용한다.

## Integration test 수용 기준

1. v1 open이 정확히 8개 store와 명시된 key/index를 만든다.
2. 최초 local 거부는 database open·write 0건이다.
3. local 동의가 없으면 profile·interview 쓰기가 실패한다.
4. AI 거부에서 manual 저장은 가능하고 provider spy는 0회다.
5. current question, input draft, history, summary가 새로고침 복원된다.
6. stale revision과 terminal mutation은 원본을 바꾸지 않는다.
7. profile 수정 뒤 기존 completed snapshot은 유지된다.
8. reset 성공 뒤 8개 store가 모두 0건이다.
9. reset abort 시 모든 기존 데이터가 남는다.
10. reset 뒤 늦은 response와 timer가 interview를 되살리지 않는다.
11. migration 실패는 기존 data를 삭제하지 않는다.
12. fixture는 합성 Persona와 비식별 문장만 사용한다.

## 반대 관점 점검

- store 8개는 많지만 체크리스트가 message, draft, summary, attachment의 독립 삭제를 요구한다.
- in-memory generation만으로 multi-tab을 막기 부족해 모든 임상 transaction에서 consent와 interview를 다시 읽는다.
- IndexedDB 자체는 불변성을 지원하지 않아 terminal generic `put` 비공개와 integration test로 강제한다.
- attachment store 선생성은 YAGNI 위험이 있으나 R20 reset과 U2 test가 attachment 0건을 요구해 빈 store만 포함한다.
