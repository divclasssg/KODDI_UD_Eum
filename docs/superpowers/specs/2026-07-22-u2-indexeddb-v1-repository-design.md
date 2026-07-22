# U2 IndexedDB v1 Schema와 Repository 계약 설계

## 문서 상태

- 상태: 2026-07-22 승인·구현됨
- 기준 브랜치: `codex/u2-indexeddb-contracts`
- 기준 commit: `ada42c158162356cd58d74e468363a314d58189a`
- 구현 범위: schema, repository, reset, revision guard, integration test
- 후속 범위: onboarding/profile/settings UI 연결, Modal actual, 배포, GPU 호출

## 목표

브라우저에 저장하는 합성·비식별 데모 데이터의 형식과 repository 동작을 고정한다. UI 연결 전에도 동의 경계, 새로고침 복구, 완료 snapshot, 원자적 reset, 늦은 응답 폐기를 독립적으로 검증한다.

실제 환자 정보, 실제 음성, 마이크, 녹음, STT, credential, 실제 AI payload는 사용하지 않는다. 질문 단계 번호와 고정 진행률도 데이터 계약에 추가하지 않는다.

## 상세 설계

1. [Schema와 저장 구조](./2026-07-22-u2-indexeddb-v1-repository-design/01-schema-and-records.md)
2. [Repository·reset·migration 정책](./2026-07-22-u2-indexeddb-v1-repository-design/02-repository-reset-and-migration.md)
3. [대안·쓰기 경계·수용 기준](./2026-07-22-u2-indexeddb-v1-repository-design/03-decisions-and-acceptance.md)

## 승인 요청 결정

- database `koddi-ud-eum`, version `1`
- 8개 store: consent, profile, medical profile, interview, draft, message, summary, attachment
- UTC ISO 8601 millisecond `Z` timestamp
- `draft | review | completed | safety-stopped`와 1부터 증가하는 revision
- 완료 transaction에서 profile·medical profile immutable snapshot capture
- 모든 store를 한 transaction으로 clear하고 0건을 유지하는 reset
- runtime generation + consent/interview/revision transaction guard
- destructive recovery 없는 migration 실패 정책
- `ConsentBlocked`의 IndexedDB·AI 0건
- AI 거부 manual flow의 외부 호출 0건과 로컬 쓰기 허용
