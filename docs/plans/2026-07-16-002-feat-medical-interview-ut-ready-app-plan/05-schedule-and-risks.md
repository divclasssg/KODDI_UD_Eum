> [상위 문서](../2026-07-16-002-feat-medical-interview-ut-ready-app-plan.md)
> 이전: [기술 결정과 아키텍처](./04-technical-design.md)
> 다음: [구현 단위 U1~U3](./06-units-u1-u3.md)
### Seven-Day Schedule

| Day | Must Complete | Exit Evidence | Cut if Missed |
|---|---|---|---|
| Day 1 | Next.js 설정, SCSS token, 대표 문진 화면, 대상 Chromium·loopback과 MedGemma deployment profile 동결 | lint·typecheck·build; Node Route에서 인증→한국어 질문→JSON 추출·schema 검증→timeout/error mapping | React Compiler off, 사진 제외 |
| Day 2 | IndexedDB, 동의, 기본·의료정보, text·choice·measurement, state machine | onboarding→home, 저장·새로고침 복구 | 부가 의료정보 필드 축소 |
| Day 3 | mock/Vertex client, 실제 질문·요약, safety·schema·evidence validator, manual fallback; fixture로 기록 화면 골격 | 상황 1 text/chip actual MedGemma 완주; summary capability gate | 사진 제외 확정 |
| Day 4 | TTS, 음성 입력, 입력 방식 전환, Persona 규칙; fixture 기반 records·clinician view | 세 Persona Task 1, 음성 실패 fallback, 오늘 기록 선택 규칙 | 음성 시각 효과 축소 |
| Day 5 | records 실제 저장 연결, clinician view, profile edit, reset, 비동기 abort/revision guard | 상황 2·3, 저장 실패·reset·늦은 응답 E2E | 설정·고급 필터 제외; 종료 시 사진 착수 여부 결정 |
| Day 6 | Figma 반영, 3 Persona×3 Task, 비동기 접근성·오류 상태; 모든 core gate가 통과한 경우만 사진 E2E | 393px visual·keyboard·screen-reader smoke, optional photo actual | 사진 우선 제외, 이후 미세조정 축소 |
| Day 7 | 상황 1~3 actual rehearsal, TTS/STT·저장·reset 회귀, 버그 수정, README | full tests, actual evidence, production build | 새 기능 금지 |

### Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Vertex quota·billing·endpoint 없음 | 실제 MedGemma P0 미완료 | Day 1 gate, mock/actual 결과 분리, blocker 명시 |
| 실환자용 목표와 로컬 프로토타입 보안 불일치 | 민감정보 노출·잘못된 완료 주장 | 합성 Persona만 허용, loopback 고정, 실환자·공개 배포 금지 |
| AI·STT 늦은 응답이 reset 뒤 상태를 되살림 | 삭제 실패·기록 오염 | AbortController, interview revision/request guard, transactional commit |
| 자유 입력의 prompt injection·markup | 위험한 질문·요약 또는 XSS | untrusted-data prompt 분리, strict schema·allowlist, text-only 렌더링, malicious fixture |
| 7일에 세 과업과 다중 입력을 모두 구현 | 핵심 흐름 품질 저하 | 사진은 conditional, PWA·PIN·export 제외, Day 3·5 gate |
| MedGemma multi-turn·한국어 편차 | 질문 반복·난해한 문장 | stateless context, short/plain validator, Persona fixture |
| 요약 환각 | 의료진 화면에 잘못된 사실 표시 | evidence ID, 수치·단위 대조, invalid summary 거절 |
| 위험 신호 누락 | 안전 안내 실패 | deterministic preflight, 승인된 copy, 실제 진료 대체 금지 |
| 음성 API 미지원·권한 거부 | 입력 경로 중단 | feature detection, explicit consent, text fallback |
| TTS의 주변 노출 | 민감정보 청취 | no autoplay, local voice 우선, page hide/reset cancel |
| 공용 기기 데이터 잔존 | 다음 사용자에게 의료정보 노출 | 전체 삭제, session reset, snapshot namespace |
| 미확정 요약이 의료진 화면에 노출 | 잘못된 임상 참고 | draft/completed 분리, 사용자 확정·transaction 성공 뒤에만 노출 |
| records/profile 재유입으로 일정 팽창 | 실제 AI 품질 검증 부족 | 세 과업에 필요한 최소 필드·route만 구현 |
| 미완성 사진 버튼 | 사용자가 기능을 오해 | end-to-end 통과한 build에서만 노출 |

---

