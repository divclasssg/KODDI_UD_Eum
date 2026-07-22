# U2 IndexedDB v1 Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 IndexedDB v1 schema와 repository를 TDD로 구현해 동의 경계, 새로고침 복구, 완료 snapshot, 원자적 reset, 늦은 응답 폐기를 integration test로 증명한다.

**Architecture:** native IndexedDB adapter 아래에 consent/profile/interview/local-data repository를 둔다. 한 문진의 durable 변경은 consent와 current revision을 같은 transaction에서 검증하고 reset은 8개 store를 한 transaction으로 clear한다.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript strict, native IndexedDB, Vitest 4.1.10, jsdom, `fake-indexeddb` development-only

## Global Constraints

- 승인 기준은 [U2 IndexedDB v1 설계](../specs/2026-07-22-u2-indexeddb-v1-repository-design.md)다.
- 새로 작성하거나 수정하는 코드 주석은 한글로 적는다.
- 실제 환자 정보·실제 음성·마이크·녹음·STT를 사용하지 않는다.
- 합성 Persona와 비식별 fixture만 사용한다.
- 질문 단계 번호·총 질문 수·고정 진행률을 저장하거나 표시하지 않는다.
- Modal actual, 배포, GPU 호출을 실행하지 않는다.
- credential 값과 실제 payload를 출력하거나 문서화하지 않는다.
- 사용자 승인 전 구현을 시작하지 않는다.
- 별도 요청 전 commit·push·main 병합을 수행하지 않는다.
- root `.gitignore`, `stash@{0}`, `.worktrees/modal-contracts`를 변경하지 않는다.

## 파일 지도

```text
package.json, package-lock.json, vitest.integration.config.ts
src/lib/db/{contracts,errors,schema,database,revision-guard}.ts
src/lib/db/{consent,profile,interview,local-data}-repository.ts
src/lib/privacy/consent.ts
tests/integration/db/{setup,fixtures,schema}.test|ts
tests/integration/db/{consent-profile-repositories,interview-repository}.test.ts
tests/integration/db/reset-revision-guard.test.ts
docs/plans/2026-07-16-003-medical-interview-implementation-checklist*
docs/worklogs/2026-07-22.md
```

## 작업 순서

1. [Integration harness와 schema RED](./2026-07-22-u2-indexeddb-v1-repository-implementation-plan/01-schema-foundation.md)
2. [UTC·Consent·Profile 경계](./2026-07-22-u2-indexeddb-v1-repository-implementation-plan/02-consent-profile.md)
3. [Interview 복원·status·revision](./2026-07-22-u2-indexeddb-v1-repository-implementation-plan/03-interview-restore.md)
4. [완료 snapshot 불변성](./2026-07-22-u2-indexeddb-v1-repository-implementation-plan/04-completed-snapshot.md)
5. [원자적 reset과 늦은 응답 폐기](./2026-07-22-u2-indexeddb-v1-repository-implementation-plan/05-reset-revision-guard.md)
6. [Migration·전체 검증·문서 동기화](./2026-07-22-u2-indexeddb-v1-repository-implementation-plan/06-migration-verification-docs.md)

## 실행 Gate

사용자가 설계와 이 계획을 승인한 다음 구현한다. 첫 증거는 schema integration test가 export 부재로 실패하는 RED여야 한다. production source는 그 뒤에 최소 범위로 작성한다.
