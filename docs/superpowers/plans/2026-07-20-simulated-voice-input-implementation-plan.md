# 모의 음성 입력 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 실제 마이크·녹음·STT 없이 음성 입력처럼 보이는 상태 전환을 체험하고, 현재 질문 slot과 합성 페르소나에 맞는 답변을 확인·수정한 뒤 명시적으로 제출하게 한다.

**Architecture:** 승인된 `personaId + InterviewSlotId`를 순수 fixture registry의 key로 사용한다. client hook은 `idle → listening → transcribing → ready|unavailable`만 소유하고 timer를 정리한다. transcript는 기존 textarea에 채우되 자동 제출하지 않으며, 접근 가능한 문구가 모의 기능임을 항상 밝힌다.

**Tech Stack:** React 19.2.4, TypeScript strict, SCSS Modules, Vitest fake timers, Testing Library, Playwright Chromium

## 제약

- 이 계획은 Modal 계획 Task 1의 `InterviewSlotId`, `DemoPersonaId`, 질문 `slot` 계약을 먼저 사용한다.
- `navigator.mediaDevices`, `MediaRecorder`, `SpeechRecognition`, Web Audio, STT API를 호출하지 않는다.
- transcript는 합성 fixture이며 사용자 발화를 수집했다고 표현하지 않는다.
- 질문이 바뀌거나 화면이 unmount되면 timer와 진행 상태를 폐기한다.
- transcript 자동 입력 뒤에도 `다음`을 눌러야 한 번 저장된다.
- 새 코드 주석은 한글로 적고 사용자 요청 전 commit·push하지 않는다.

## 작업 순서

1. [ ] [persona·slot transcript registry](./2026-07-20-simulated-voice-input-implementation-plan/01-transcript-registry.md)
2. [ ] [상태 hook과 접근 가능한 UI](./2026-07-20-simulated-voice-input-implementation-plan/02-state-and-ui.md)
3. [ ] [금지 API·E2E·문서 검증](./2026-07-20-simulated-voice-input-implementation-plan/03-verification-and-docs.md)

## 완료 gate

- 세 persona의 승인 slot에서 결정론적 합성 transcript가 입력된다.
- 900ms listening과 700ms transcribing 뒤 ready가 되고 자동 제출하지 않는다.
- unknown slot/누락 fixture는 텍스트 입력으로 돌아가며 내용을 만들지 않는다.
- 진행 중 중복 클릭, 질문 변경, unmount에서 stale transcript가 생기지 않는다.
- 실제 마이크·녹음·STT·외부 음성 네트워크가 0회다.
- keyboard-only, live status, focus, 48px 조작 영역과 전체 빌드가 통과한다.

## 실행 메모

각 task는 실패 테스트를 먼저 실행한다. 계획의 commit 지점은 사용자가 commit을 별도로 요청한 경우에만 실행한다.
