> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: 없음
> 다음: [요구사항과 사용자 흐름](./02-requirements-and-flows.md)
# Task-Aligned Medical Interview App 7-Day Implementation Plan

> 진행 상태는 [구현 체크리스트](../2026-07-16-003-medical-interview-implementation-checklist.md)에서 관리한다. 구현·검증 작업이 끝날 때마다 증거와 함께 체크리스트를 갱신한다.

## Goal Capsule

### Objective

7일 안에 문서의 합성 Persona 데이터를 사용하는 의료 문진 프로토타입을 구현한다. 사용자는 실제 MedGemma 문진을 작성하고, 확정한 결과를 의료진용 화면으로 보여 주며, 이전 기록과 내 정보를 관리할 수 있어야 한다. 텍스트·선택형 입력과 실제 녹음 없는 모의 음성 입력을 제공한다.

이번 결과물은 AI Persona UT 실행 도구가 아니다. 참가자 AI, 평가자 AI, 스크린샷 중계, 로그 채점, 2/3 재현 판정, 의료진 휴리스틱 배포는 앱 구현 이후의 별도 단계로 미룬다.

이번 7일 결과물은 기능 검증용이며 실제 진료 서비스가 아니다. 링크를 아는 외부 사용자가 공개 데모에 접근할 수 있지만 합성 Persona 역할극만 허용하며 실제 환자, 실제 식별정보, 실제 의료기록을 입력하지 않는다.

### Authority Hierarchy

1. 이번 대화의 사용자 지시: UT 실행은 후순위, UI와 실제 기능 구현 우선
2. Google Docs `AI 기반 사용성 사전 점검 / 진행방법`과 하위 탭 6개
3. `docs/superpowers/specs/2026-07-13-medical-interview-pwa-design.md`
4. `docs/superpowers/specs/2026-07-13-medical-interview-pwa-implementation-detail.md`
5. 사용자가 제공할 Figma URL과 필수 UI
6. `docs/superpowers/plans/2026-07-15-medical-interview-pwa-implementation-plan.md` 중 현재 범위와 충돌하지 않는 기술 세부사항

### Execution Profile

- 기간: 7일
- 공식 대상 환경: 데스크톱 Chromium의 393px viewport, 로컬 mock과 공개 외부 데모
- 핵심 과업: 최초 문진, 의료진에게 결과 보여주기, 이전 기록 확인과 내 정보 수정
- AI: Modal custom App에 배포한 `google/medgemma-1.5-4b-it`
- 저장: 브라우저 IndexedDB, 계정·서버 DB 없음
- 음성 출력: 브라우저 Speech Synthesis, 사용자 명시 실행
- 음성 입력: 실제 마이크·녹음·STT 없이 합성 Persona transcript를 채우는 모의 동작
- 디자인: SCSS, Figma 기반 `:root` token, 하이픈 class name
- 데이터 경계: 합성 Persona 데이터만 사용하며 실제 환자·실제 식별정보 입력 금지
- 실행 경계: 공개 익명 데모는 Origin·quota·budget·kill switch를 적용하며 실제 의료 서비스 동작을 주장하지 않는다.

### Stop Conditions

- Modal Workspace budget·proxy 인증·GPU quota와 endpoint 실제 응답을 확인한다. 실패하면 mock 개발은 계속하되 actual MedGemma 완료를 주장하지 않는다.
- Day 3 종료까지 `주요 증상 → 실제 질문 → 답변 → S/O 요약`이 실제 MedGemma로 완주되지 않으면 사진 입력을 중단한다.
- Day 5 종료까지 세 핵심 과업의 route가 모두 연결되지 않으면 사진 입력과 시각 미세조정을 중단하고 기록·의료진 보기·내 정보 수정부터 완성한다.
- Figma URL이 늦어지면 임시 token으로 기능을 진행하고, URL 수신 후 token 값과 사용자가 지정한 필수 UI를 교체한다.
- React Compiler가 Day 1 production build를 깨면 비활성화한다.
- Day 7에는 새 기능을 추가하지 않고 세 과업 회귀와 결함 수정만 수행한다.

---

## Product Contract

### Summary

앱은 짧고 구체적인 질문을 한 번에 하나씩 보여 주고, 사용자가 부담이 적은 입력 방식을 선택해 실제 MedGemma 문진을 완료하게 한다. 완료된 기록은 날짜별로 찾을 수 있고, 의료진에게 보여 줄 수 있는 전용 요약 화면을 제공한다. 사용자는 이전 기록을 다시 열고 기본정보를 수정할 수 있다.

### Problem Frame

새 기준 문서는 앱의 성공을 문진 화면 하나가 아니라 세 개의 연속 과업으로 정의한다. 이전 계획처럼 기록 목록과 내 정보 수정을 P1로 두면 상황 2와 3을 수행할 수 없으므로 UT 대상 앱 자체가 불완전하다. 반대로 참가자·평가자 자동화에 시간을 쓰면 실제 문진, 의료진 보기, 기록 관리가 밀리므로 UT 실행 코드는 범위에서 제외한다.

### Persona-Informed Users

| ID | 사용자 조건 | 구현에 반영할 계약 |
|---|---|---|
| A1 | 78세, 낮은 디지털 숙련도·문해력, 작은 글씨와 긴 문장에 어려움 | 큰 본문과 조작 영역, 쉬운 용어, 기능 사용 전 설명, TTS, 명시적 버튼 라벨 |
| A2 | 24세, 경증 지적장애, 복문·추상 표현·여러 단계 안내에 어려움 | 한 번에 질문 하나, 짧고 구체적인 문장, 예·아니오 중심 선택, 익숙한 위치와 일관된 패턴 |
| A3 | 56세, 뇌졸중 후유증, 긴 발화·긴 입력에 부담 | 칩과 음성 입력 우선 노출, 짧은 답변 허용, 입력 방식 전환 시 내용 보존 |
| A4 | 의료진 | 핵심 증상·기간·측정값·복용약·알레르기·안전 안내와 원문 근거를 빠르게 확인 |
| A5 | 보호자·보조자 | 같은 화면에서 설명을 돕되 사용자 동의와 기록 출처를 대신 결정하지 않음 |
