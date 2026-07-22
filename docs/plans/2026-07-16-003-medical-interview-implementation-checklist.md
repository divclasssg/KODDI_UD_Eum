---
title: "Medical Interview App Implementation Checklist"
date: 2026-07-16
type: checklist
status: active
source_plan: 2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md
---

# Medical Interview App Implementation Checklist

> 상태: **활성 현황판**. 완료 표시는 구현과 검증 증거가 모두 있을 때만 변경한다.

## 현재 상태

- 마지막 갱신: 2026-07-22
- 구현 진행률: **3/9 units**
- P0 요구사항: **0/20 검증 완료**
- 자동 검증 gate: **7/7 통과**
- 다음 작업: **U4 safety validator·evidence 검증·완료 저장 여정**
- U2 저장 계획: [IndexedDB v1 repository 구현 계획](../superpowers/plans/2026-07-22-u2-indexeddb-v1-repository-implementation-plan.md)
- U2 화면 연결 계획: [온보딩·홈 구현 계획](../superpowers/plans/2026-07-22-u2-onboarding-home-integration-plan.md), [실제 제품형 v1 개정 계획](../superpowers/plans/2026-07-22-u2-v1-actual-onboarding-revision-plan.md)
- U2 완료 계획: [수동 문진·프로필 수정·reset 구현 계획](../superpowers/plans/2026-07-22-u2-remaining-manual-profile-reset-implementation-plan.md)
- U3 설계·계획: [문진 상태·입력 계약 설계](../superpowers/specs/2026-07-22-u3-interview-state-input-contracts-design.md), [구현 계획](../superpowers/plans/2026-07-22-u3-interview-state-input-contracts-implementation-plan.md)
- 세부 구현 계획: [대표 문진 화면 구현 계획](../superpowers/plans/2026-07-19-interview-screen-implementation-plan.md)
- Modal 계획: [외부 데모 구현 계획](../superpowers/plans/2026-07-20-modal-medgemma-external-demo-implementation-plan.md)
- 음성 계획: [모의 음성 입력 구현 계획](../superpowers/plans/2026-07-20-simulated-voice-input-implementation-plan.md)
- 실행 계획: [7일 구현 계획](./2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
- 전체 문서: [docs/README.md](../README.md)

## 상세 체크리스트

1. [현재 상태와 구현 전 결정](./2026-07-16-003-medical-interview-implementation-checklist/01-status-and-decisions.md)
2. [Day 1 · U1](./2026-07-16-003-medical-interview-implementation-checklist/02-day-1-u1.md)
3. [Day 2 · U2/U3](./2026-07-16-003-medical-interview-implementation-checklist/03-day-2-u2-u3.md)
4. [Day 3 · U4](./2026-07-16-003-medical-interview-implementation-checklist/04-day-3-u4.md)
5. [Day 4 · U5/U6](./2026-07-16-003-medical-interview-implementation-checklist/05-day-4-u5-u6.md)
6. [Day 5 · U6/U7](./2026-07-16-003-medical-interview-implementation-checklist/06-day-5-u6-u7.md)
7. [Day 6 · U8/U9](./2026-07-16-003-medical-interview-implementation-checklist/07-day-6-u8-u9.md)
8. [Day 7 · 검증](./2026-07-16-003-medical-interview-implementation-checklist/08-day-7-verification.md)
9. [후순위·진행·차단 기록](./2026-07-16-003-medical-interview-implementation-checklist/09-deferred-and-logs.md)

## 상태 규칙

- `[x]`: 구현과 exit evidence가 모두 있음
- `[ ]`: 시작 전 또는 완료 증거 없음
- `[ ] 진행 중`: 수정 중이나 exit evidence 없음
- `[ ] 차단`: 결정·외부 조건 필요
- `[ ] 후순위`: 7일 범위 밖
- 구현 turn이 끝날 때 관련 상세 체크리스트와 진행 기록을 같은 변경에서 갱신한다.
- mock 성공과 actual MedGemma 성공을 별도로 기록한다.

## 검증 실행 운영

- 개발 중에는 관련 RED/GREEN test와 영향받은 integration test만 실행한다.
- 전체 lint·typecheck·unit·integration은 milestone 마지막에 병렬로 한 번 실행한다.
- 전체 Chromium E2E와 production build는 `npm run test:e2e`로 최종 통합 지점에서 한 번 실행한다.
- 검증한 commit을 fast-forward merge한 경우 동일 tree에서 전체 gate를 반복하지 않는다.
- 문서 변경만 남은 경우 `git diff --check`와 문서 정합성만 확인한다.
- 검증 뒤 source 변경이 없다면 완료 보고를 위해 동일 gate를 다시 실행하지 않는다.
- 넓은 영향의 schema·build·runtime 변경이나 실제 실패 증거가 있을 때만 추가 전체 검증을 수행하고 이유를 작업일지에 남긴다.
