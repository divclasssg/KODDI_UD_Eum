# KODDI UD 이음 문서

이 파일은 구현에 필요한 문서를 찾는 단일 진입점이다. 상위 문서와 상세 문서는 모두 200줄 이하로 유지한다.

## 현재 구현 기준

1. [7일 구현 계획](./plans/2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
2. [구현 체크리스트](./plans/2026-07-16-003-medical-interview-implementation-checklist.md)
3. [문서 관리 규칙](./documentation-policy.md)
4. [디자인 토큰 구현 명세](./superpowers/specs/2026-07-16-design-token-foundation-design.md)

현재 목표는 AI Persona UT를 실행하는 도구가 아니라, 해당 UT 시나리오를 충족하는 실제 문진 앱을 만드는 것이다. 앱은 실제 MedGemma 문진과 TTS/STT를 포함하며 UT 직접 수행은 후순위다.

## 구현 판단의 우선순위

1. 현재 사용자 지시
2. 2026-07-16 실행 계획과 체크리스트
3. 업데이트된 Google Docs의 `AI 기반 사용성 사전 점검 / 진행방법` 및 하위 6개 탭
4. 2026-07-13 설계 중 위 기준과 충돌하지 않는 내용
5. 2026-07-09~15 과거 참고자료

문서가 충돌하면 위 순서를 따른다. 과거 문서의 Hugging Face, PIN, 완전한 PWA, 사진·영상 필수화 같은 가정은 현재 계획으로 자동 승계하지 않는다.

## 과거 설계 참고자료

- [2026-07-13 제품·화면 설계](./superpowers/specs/2026-07-13-medical-interview-pwa-design.md)
- [2026-07-13 상세 구현 설계](./superpowers/specs/2026-07-13-medical-interview-pwa-implementation-detail.md)
- [2026-07-10 제품·화면 설계](./superpowers/specs/2026-07-10-medical-interview-pwa-design.md)
- [2026-07-10 상세 구현 설계](./superpowers/specs/2026-07-10-medical-interview-pwa-implementation-detail.md)
- [2026-07-09 초기 설계](./superpowers/specs/2026-07-09-medical-interview-pwa-design.md)
- [2026-07-15 이전 구현 계획](./superpowers/plans/2026-07-15-medical-interview-pwa-implementation-plan.md)

과거 문서는 결정 배경과 세부 아이디어를 보존하기 위한 자료다. 현재 범위·일정·기술 선택을 결정하는 문서가 아니다.

## 작업 기록

- [2026-07-16 작업일지](./worklogs/2026-07-16.md)
- [2026-07-15 작업일지](./worklogs/2026-07-15.md)

## 폴더 규칙

- `docs/plans`: 활성 계획, 체크리스트와 그 상세 문서
- `docs/superpowers/specs`: 제품·기술 설계의 과거 버전
- `docs/superpowers/plans`: 과거 실행 계획
- `docs/worklogs`: 날짜별 사실 기록

새 문서를 만들기 전에 기존 상위 문서에 들어갈 링크인지 확인한다. 상세 내용이 200줄을 넘을 가능성이 있으면 처음부터 책임 단위 파일로 나눈다.
