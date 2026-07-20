> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [요구사항과 사용자 흐름](./02-requirements-and-flows.md)
> 다음: [기술 결정과 아키텍처](./04-technical-design.md)
### Success Criteria

- 새 문서의 상황 1~3을 실제 앱에서 순서대로 완주한다.
- 김영수·이민정·박성훈 fixture가 각자의 제약에 맞는 UI로 Task 1~3을 각각 완주한다.
- 텍스트·칩·모의 음성 입력이 동작하고 전환 시 답변을 보존한다.
- 오늘 기록 찾기, 의료진에게 보여주기, 과거 기록 확인, 기본정보 수정이 개발자 도구 없이 동작한다.
- 질문·안전 안내·요약 TTS와 text-only fallback이 동작한다.
- AI·저장·음성 오류에서 입력을 잃지 않으며 reset 뒤 이전 의료데이터가 남지 않는다.
- Figma URL이 제공되면 대표 화면과 token을 비교 검수한다.

### Scope Boundaries

#### P0 — Seven-Day Deliverable

- 합성 Persona 데이터만 사용하는 공개·익명 외부 데모 프로토타입
- Next.js·SCSS token·393px 앱 shell
- onboarding, 동의, 최소 기본·의료정보
- 실제 MedGemma 텍스트·칩 문진과 근거 연결 S/O 요약
- 실제 녹음·STT 없는 모의 음성 입력과 명시적 TTS, 지원 실패 fallback
- home, 기록 목록, 오늘/과거 기록 상세
- 의료진에게 보여주기 화면
- 내 정보 수정과 snapshot 보존
- IndexedDB 복구와 전체 삭제
- Persona 기반 쉬운 문장·큰 조작 영역·접근성 상태

#### Conditional P0 — Core Gates Passed Only

- 사진 촬영·선택·압축·저장·삭제
- 사진을 포함한 실제 MedGemma multimodal 질문

사진은 Day 3 실제 텍스트 문진과 Day 5 세 핵심 과업이 먼저 통과한 경우에만 착수한다. 일부만 구현된 사진 버튼은 노출하지 않는다.

#### Deferred — UT Execution and Non-Core Features

- 참가자 Persona 실행, screenshot relay, Think Aloud 로그
- 평가자 AI, Synthetic SUS, 이슈 분류와 2/3 재실행
- 간호사 휴리스틱 평가지 배포·집계
- 3열 Persona/앱/UT 결과 콘솔
- 실환자·실제 식별정보 사용, LAN 직접 공개, 운영 의료 서비스
- PIN, 공개 계정, 서버 DB, 저장 암호화, 접근통제·감사·보존 정책, PDF/JSON export, 영상, service worker cache

### Sources

- Figma `Prototype`의 `최종 prototype` 섹션과 [필수 UI 목록](../../superpowers/specs/2026-07-19-final-prototype-ui-inventory.md)
- [Modal MedGemma 외부 데모 설계](../../superpowers/specs/2026-07-20-modal-medgemma-external-demo-design.md)
- Google Docs `AI 기반 사용성 사전 점검 / 진행방법`, tab `t.f6puiwno2s1`
- Google Docs `01_공통_시스템프롬프트_참가자용.md`, tab `t.bui34eeigyls`
- Google Docs `02_Persona1_김영수.md`, tab `t.5lf20r67mzc6`
- Google Docs `03_Persona2_이민정.md`, tab `t.i22q7728cz6o`
- Google Docs `04_Persona3_박성훈.md`, tab `t.cc29ebhxm29`
- Google Docs `05_Task_공통.md`, tab `t.j188icvqg4sa`
- Google Docs `06_평가자_프롬프트.md`, tab `t.ac7xy23xzd9k`
- `docs/superpowers/specs/2026-07-13-medical-interview-pwa-design.md`
- `docs/superpowers/specs/2026-07-13-medical-interview-pwa-implementation-detail.md`
- Google MedGemma 배포: `https://developers.google.com/health-ai-developer-foundations/medgemma/get-started`
- MedGemma 1.5 model card: `https://developers.google.com/health-ai-developer-foundations/medgemma/model-card`

---
