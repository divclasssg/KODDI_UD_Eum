> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [구현 단위 U7~U9](./08-units-u7-u9.md)
> 다음: [미확정 결정과 출처 매핑](./10-open-questions-and-appendix.md)
## Verification Contract

### Automated Gates

| Gate | Evidence |
|---|---|
| Lint | ESLint 오류 0건 |
| Types | TypeScript 오류 0건 |
| Unit | state, validators, safety, summary evidence, media, speech 통과 |
| Integration | IndexedDB, snapshot, input switching, Route Handler contracts 통과 |
| E2E | mock contract 기반 상황 1A, 상황 1B AI 비동의·실패 manual, 상황 2~3, reset, 오류 복구, 접근성, speech controls 통과 |
| Actual | opt-in·serial `test:actual`로 세 Persona의 Modal 질문·요약 gate 통과 |
| Build | Next.js production build 성공 |

### Actual MedGemma Gates

- MedGemma 접근 조건, Modal proxy 인증·quota·endpoint health와 Node.js runtime 확인
- Day 1 question gate: 인증 → 한국어 질문 1회 → JSON 추출 → schema 검증 → timeout/error mapping
- Day 3 summary gate: question/answer → evidence-linked S/O → client pre-save validation → user confirmation → completed 저장
- 김영수·이민정·박성훈 fixture의 실제 질문→답변→S/O 요약 완주
- provider/model ID, latency, validation, retry/fallback outcome만 기록하고 payload body는 로그에 남기지 않음
- actual 실패를 deterministic mock 성공과 별도로 보고
- 사진을 노출하는 build는 실제 multimodal flow까지 별도 통과

### Task Gates

- Task 1A: 기본정보 입력, 입력 방식 선택, 실제 AI 문진, 요약 초안 검토·필요 시 수정·확정·completed 저장
- Task 1B: AI 비동의와 provider 실패에서 수동 질문, deterministic summary 검토·확정·completed 저장·기록 상세 확인
- Task 2: 홈, 기록 발견, 오늘 기록 식별, 의료진에게 보여주기
- Task 3: 과거 기록 식별, 상세 확인, 내 정보 이동, 기본정보 수정
- 연속 여정: 동일 `interviewId`와 IndexedDB 상태로 onboarding → Task 1 completed 저장 → 홈 → Task 2 오늘 기록·clinician view까지 연결; Task 3은 같은 current profile과 과거 snapshot을 함께 검증
- 각 gate는 개발자 도구·수동 데이터 편집·UT 실행 console 없이 통과
- Task 1~3 각각을 김영수·이민정·박성훈 fixture로 실행해 `3 Persona × 3 Task` 9개 조합을 통과

### Safety, Privacy, and Accessibility Gates

- 합성 Persona fixture만 사용하며 direct identifier, unknown field, body limit 초과가 provider 호출 전에 거절됨
- 자유 입력은 untrusted data로 전달되고 prompt injection·HTML/script fixture가 명령이나 markup으로 실행되지 않음
- 진단·질병 가능성·치료·복약 지시와 근거 없는 S/O가 거절됨
- 결정론적 위험 fixture가 일반 질문보다 안전 안내를 먼저 표시
- 위험 안내 확인 뒤 안전 종료 상태가 유지되며 일반 질문으로 무단 복귀하지 않음
- AI·음성·사진 동의가 꺼지면 해당 외부 호출이 0건
- reset 뒤 모든 object store가 비고 speech가 중단됨
- reset·navigation 뒤 늦은 AI 응답·모의 음성 timer가 현재 revision에 반영되지 않음
- 비동기 질문·오류·안전·요약 전환이 live region과 focus로 전달됨
- TTS는 자동 실행되지 않고 hidden content를 읽지 않음

### Manual Gates

- Figma 제공 시 대표 화면 visual comparison
- 대상 Chromium의 393px viewport와 큰 desktop viewport 확인
- keyboard-only 상황 1~3 완주
- 대상 desktop Chromium TTS·모의 음성 smoke; Safari TTS text fallback은 비차단 exploratory check이며 실제 휴대폰 동작은 완료 주장에 포함하지 않음
- 공용 기기에서 전체 삭제 후 새 사용자 시작 확인

---

## Definition of Done

### Global

- R1-R20의 P0 요구사항과 세 핵심 과업 gate가 통과한다.
- 실제 MedGemma가 세 Persona fixture에서 질문과 근거 연결 S/O 요약을 생성하고 사용자가 확정한 기록만 completed가 된다.
- 텍스트·칩·모의 음성 입력과 입력 방식 전환이 동작한다.
- 오늘 기록, 의료진 보기, 과거 기록, 내 정보 수정이 연결된다.
- 질문·안전 안내·요약 TTS가 명시적 조작으로 실행되고 모든 종료 조건에서 중단된다.
- AI·음성·저장 오류에서 입력을 잃지 않고 manual fallback으로 완료한다.
- reset 뒤 이전 사용자의 의료데이터가 남지 않는다.
- reset·동의 철회·navigation 뒤 늦은 비동기 응답이 삭제·교체된 상태를 되살리지 않는다.
- 세 Persona가 Task 1~3의 9개 조합을 모두 완주한다.
- 공개 데모에서도 합성 Persona만 사용하고 실제 환자·식별정보는 완료 범위에 포함하지 않는다.
- 사진은 R21 전체를 통과한 경우에만 노출하며 미완성이면 숨긴다.
- AI Persona 참가자·평가자·로그·2/3 판정 코드를 포함하지 않는다.
- 폐기한 실험 코드, dead route, placeholder feature를 제거한다.
- README와 `.env.example`만 보고 mock mode를 실행하고 actual prerequisites를 확인할 수 있다.

### Per Unit

- U1 done: 프로젝트, build, token, 대표 문진 상태가 준비된다.
- U2 done: 동의, profile, snapshot, recovery, reset이 동작한다.
- U3 done: text·choice·measurement와 manual state가 입력을 보존한다.
- U4 done: 실제 MedGemma 질문·요약과 safety·evidence 검증이 동작한다.
- U5 done: 모의 음성, TTS, 비동기 접근성 fallback이 동작한다.
- U6 done: 오늘 기록과 의료진 보기 과업이 완료된다.
- U7 done: 과거 기록과 내 정보 수정 과업이 완료된다.
- U8 done 또는 명시적 제외: actual photo E2E가 통과했거나 flag off 상태로 범위에서 제외된다.
- U9 done: Figma, 세 과업 회귀, 실제 AI evidence, production build, 문서가 완료된다.

### Product Contract Preservation

Google Docs의 새 기준에 따라 P0 범위를 변경했다. 기록 목록·오늘 기록·의료진 보기·과거 기록·내 정보 수정·음성 입력을 P0로 승격하고, 세 Persona의 특성을 UI·문장·입력·접근성 계약으로 반영했다. 참가자·평가자 UT 실행 절차는 계속 후속 단계로 유지했다.

---
